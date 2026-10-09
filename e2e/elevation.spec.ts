import { expect, test, type Page } from '@playwright/test';

const items = (page: Page) =>
  page.evaluate(() => {
    const p = window.__homefit!.store.getState().plan;
    return p.layouts.find((l) => l.id === p.activeLayoutId)!.items;
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('상부장을 놓고 설치 높이를 바꾸면 2D 점선·충돌 제외·새로고침 유지가 동작한다', async ({ page }) => {
  await page.getByLabel('제품 찾기').fill('상부장');
  await page.getByTestId('catalog-card-samsung-upper-cabinet-240-sample').getByRole('button', { name: '추가' }).click();
  await expect.poll(async () => (await items(page)).length).toBe(1);
  const upper = (await items(page))[0];

  await page.getByRole('button', { name: '2D', exact: true }).click();
  const poly = page.getByTestId(`item2d-${upper.id}`);
  await expect(poly).toHaveAttribute('data-elevation', '145');
  await expect(poly).toHaveClass(/item2d-elevated/);

  const props = page.getByTestId('properties-panel');
  const field = props.locator('label', { hasText: '설치 높이' }).locator('input');
  await field.fill('160');
  await field.press('Enter');
  await expect(poly).toHaveAttribute('data-elevation', '160');

  // 벽(w5, x=350)에서 떨어진 거실 안쪽으로 상부장을 옮겨 벽 충돌을 배제한 뒤 비교한다
  await page.evaluate((id) => {
    window.__homefit!.store.getState().updateItem(id, { x: 175, y: 100 });
  }, upper.id);

  await page.getByLabel('제품 찾기').fill('');
  await page.getByTestId('catalog-card-table-dining-4').getByRole('button', { name: '추가' }).click();
  await expect.poll(async () => (await items(page)).length).toBe(2);
  await page.evaluate(() => {
    const s = window.__homefit!.store.getState();
    const [u, t] = s.plan.layouts.find((l) => l.id === s.plan.activeLayoutId)!.items;
    s.updateItem(t.id, { x: u.x, y: u.y });
  });
  await expect(page.getByTestId('status-collides')).toHaveCount(0);

  await page.evaluate(() => {
    const s = window.__homefit!.store.getState();
    s.select(s.plan.layouts.find((l) => l.id === s.plan.activeLayoutId)!.items[0].id);
  });
  await props.getByRole('button', { name: '기본값' }).click();
  await expect(poly).toHaveAttribute('data-elevation', '145');
  await page.keyboard.press('Control+z');
  await expect(poly).toHaveAttribute('data-elevation', '160');

  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByTestId(`item2d-${upper.id}`)).toHaveAttribute('data-elevation', '160');
});
