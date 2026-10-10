import { expect, test, type Page } from '@playwright/test';

const itemCount = (page: Page) =>
  page.evaluate(() => {
    const p = window.__homefit!.store.getState().plan;
    return p.layouts.find((l) => l.id === p.activeLayoutId)!.items.length;
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('카탈로그에서 가전을 드래그해 배치하고 충돌·삭제·자동저장이 동작한다', async ({ page }) => {
  const viewport = page.locator('.viewport');
  const box = (await viewport.boundingBox())!;
  await page.getByTestId('catalog-card-samsung-bespoke-4door-sample').dragTo(viewport, {
    sourcePosition: { x: 12, y: 12 },
    targetPosition: { x: box.width / 2, y: box.height / 2 },
  });
  await expect.poll(() => itemCount(page)).toBe(1);
  await expect(page.getByTestId('properties-panel')).toContainText('비스포크 냉장고 4도어');

  await page.evaluate(() => {
    const s = window.__homefit!.store.getState();
    const it = s.plan.layouts.find((l) => l.id === s.plan.activeLayoutId)!.items[0];
    s.addItem(it.productId, it.variantId, { x: it.x + 10, y: it.y });
  });
  await expect(page.getByTestId('status-collides')).toBeVisible();

  await page.evaluate(() => {
    const s = window.__homefit!.store.getState();
    s.select(s.plan.layouts.find((l) => l.id === s.plan.activeLayoutId)!.items[1].id);
  });
  await page.keyboard.press('Delete');
  await expect.poll(() => itemCount(page)).toBe(1);

  await page.waitForTimeout(800);
  await page.reload();
  await expect.poll(() => itemCount(page)).toBe(1);
});

test('잘못된 JSON을 열면 오류 배너가 뜨고 배치는 유지된다', async ({ page }) => {
  await page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' }).click();
  await expect.poll(() => itemCount(page)).toBe(1);
  await page.getByTestId('open-json').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 11 })),
  });
  await expect(page.getByTestId('banner')).toContainText('지원하지 않는 파일 버전입니다: 11');
  expect(await itemCount(page)).toBe(1);
});

test('탑뷰 전환 후에도 렌더링이 유지된다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: '3D 탑뷰' }).click();
  await expect(page.getByRole('button', { name: '3D 탑뷰' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.viewport canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
