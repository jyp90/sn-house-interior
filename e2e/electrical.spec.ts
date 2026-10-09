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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('전용회로 가전 근처에 전용회로 콘센트를 놓으면 경고가 사라진다', async ({ page }) => {
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await page.getByTestId('catalog-card-samsung-grande-washer-sample').getByRole('button', { name: '추가' }).click();
  await expect(page.getByTestId('status-circuit')).toBeVisible();

  await page.getByRole('button', { name: '전기', exact: true }).click();
  await expect(page.getByTestId('circuit-list')).toContainText('150cm 이내 전용회로 콘센트 없음');
  await page.getByRole('button', { name: '전용회로 콘센트', exact: true }).click();
  const at = await planToClient(page, { x: 362, y: 200 });
  await page.mouse.click(at.x, at.y);

  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(1);
  const f = (await getPlan(page)).fixtures[0];
  expect(f).toMatchObject({ kind: 'outlet-dedicated', wallId: 'w5', height: 30 });
  expect(f.pos.x).toBe(356);
  expect(Math.abs(f.pos.y - 200)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('circuit-list')).toContainText('전용회로 콘센트 있음');

  await page.getByRole('button', { name: '배치', exact: true }).click();
  const washer = (await getPlan(page)).layouts[0].items[0];
  const c = await centerOf(page, `item2d-${washer.id}`);
  await page.mouse.click(c.x, c.y);
  await expect(page.getByRole('heading', { name: '그랑데 드럼세탁기' })).toBeVisible();
  await expect(page.getByTestId('status-circuit')).toHaveCount(0);
});

test('설비를 끌면 벽을 따라 붙고, 삭제 후 실행 취소로 되살린다', async ({ page }) => {
  await page.getByRole('button', { name: '전기', exact: true }).click();
  await page.getByRole('button', { name: '콘센트', exact: true }).click();
  const at = await planToClient(page, { x: 100, y: 25 });
  await page.mouse.click(at.x, at.y);
  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(1);
  const f = (await getPlan(page)).fixtures[0];
  expect(f).toMatchObject({ kind: 'outlet', wallId: 'w1', pos: { y: 10 } });

  await page.getByRole('button', { name: '선택', exact: true }).click();
  const from = await centerOf(page, `fixture-${f.id}`);
  const to = await planToClient(page, { x: f.pos.x + 150, y: 22 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await getPlan(page)).fixtures[0].pos.x).toBeGreaterThan(f.pos.x + 100);
  expect((await getPlan(page)).fixtures[0]).toMatchObject({ wallId: 'w1', pos: { y: 10 } });

  await expect(page.getByTestId('properties-panel').getByRole('heading', { name: '콘센트' })).toBeVisible();
  await page.getByTestId('properties-panel').getByRole('button', { name: '삭제' }).click();
  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(1);
});

test('전기 설비는 집 영역 밖에 놓이지 않고, 드래그해도 경계 안에 머문다 (스펙 §38)', async ({ page }) => {
  await page.getByRole('button', { name: '전기', exact: true }).click();
  await page.getByRole('button', { name: '조명', exact: true }).click();
  const outside = await planToClient(page, { x: 650, y: 200 }); // 샘플 집 바깥 면은 -10..610 × -10..410
  await page.mouse.click(outside.x, outside.y);
  await expect(page.getByTestId('banner')).toContainText('집 영역 밖에는 놓을 수 없습니다.');
  expect((await getPlan(page)).fixtures).toHaveLength(0);

  const inside = await planToClient(page, { x: 450, y: 200 });
  await page.mouse.click(inside.x, inside.y);
  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(1);
  const f = (await getPlan(page)).fixtures[0];
  expect(f.pos).toEqual({ x: 450, y: 200 });

  await page.getByRole('button', { name: '선택', exact: true }).click();
  const from = await centerOf(page, `fixture-${f.id}`);
  const to = await planToClient(page, { x: 660, y: 450 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  const moved = (await getPlan(page)).fixtures[0];
  expect(moved.pos).toEqual({ x: 610, y: 410 });
});
