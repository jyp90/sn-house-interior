import { expect, test, type Page } from '@playwright/test';

type P = { x: number; y: number };

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);

async function planToClient(page: Page, p: P): Promise<P> {
  return page.getByTestId('editor2d').evaluate((svg, q) => {
    const m = (svg as SVGSVGElement).getScreenCTM()!;
    const r = new DOMPoint(q.x, q.y).matrixTransform(m);
    return { x: r.x, y: r.y };
  }, p);
}

async function centerOf(page: Page, testId: string): Promise<P> {
  const b = (await page.getByTestId(testId).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test('스위치·조명에 같은 그룹을 적으면 점선·그룹 목록·체크리스트 항목이 생기고 3D도 오류 없이 그린다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();

  await page.getByRole('button', { name: '전기', exact: true }).click();
  await page.getByRole('button', { name: '스위치', exact: true }).click();
  const swAt = await planToClient(page, { x: 100, y: 25 });
  await page.mouse.click(swAt.x, swAt.y);
  await page.getByRole('button', { name: '조명', exact: true }).click();
  const liAt = await planToClient(page, { x: 200, y: 200 });
  await page.mouse.click(liAt.x, liAt.y);
  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(2);
  const [sw, li] = (await getPlan(page)).fixtures;
  expect(sw).toMatchObject({ kind: 'switch', wallId: 'w1' });
  expect(li).toMatchObject({ kind: 'light' });

  await page.getByRole('button', { name: '선택', exact: true }).click();
  const panel = page.getByTestId('properties-panel');
  for (const f of [sw, li]) {
    const c = await centerOf(page, `fixture-${f.id}`);
    await page.mouse.click(c.x, c.y);
    await expect(panel.getByRole('heading', { name: f.kind === 'switch' ? '스위치' : '조명' })).toBeVisible();
    await panel.getByLabel('스위치 그룹').fill('거실');
    await panel.getByLabel('스위치 그룹').press('Enter');
    await expect.poll(async () => (await getPlan(page)).fixtures.find((x) => x.id === f.id)?.group).toBe('거실');
  }

  await expect(page.getByTestId(`switch-link-${sw.id}-${li.id}`)).toBeVisible();
  await expect(page.getByTestId('switch-groups')).toContainText('거실 — 스위치 1 · 조명 1');

  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  await expect(
    page.getByTestId('checklist').locator('[data-testid^="checklist-auto-switch-"]').filter({ hasText: '스위치 회로 전달: 거실(스위치 1·조명 1)' }),
  ).toHaveCount(1);

  await page.getByRole('button', { name: '배치', exact: true }).click();
  // 배치 모드에서는 점선을 그리지 않는다
  await expect(page.getByTestId(`switch-link-${sw.id}-${li.id}`)).toHaveCount(0);
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await page.waitForTimeout(300);
  expect(errors).toEqual([]);
});
