import { expect, test, type Page } from '@playwright/test';

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('배치 탭에서 놓은 가구는 구조·전기 탭의 2D에 없고 배치로 돌아오면 다시 보인다 (스펙 §51.2)', async ({ page }) => {
  await page.getByRole('button', { name: '배치', exact: true }).click();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await page.getByTestId('catalog-card-samsung-grande-washer-sample').getByRole('button', { name: '추가' }).click();
  await expect.poll(async () => (await getPlan(page)).layouts[0].items.length).toBe(1);
  const washer = (await getPlan(page)).layouts[0].items[0];
  const poly = page.getByTestId(`item2d-${washer.id}`);
  const svg = page.getByTestId('editor2d');
  await expect(poly).toBeVisible();
  // 배치 탭: 가구 간격 표시(세탁기 앞 60cm)도 함께 그려진다
  await expect(svg.locator('.overlays2d')).toHaveCount(1);
  await expect(svg.locator('.clearance')).toHaveCount(1);

  await page.getByRole('button', { name: '구조', exact: true }).click();
  await expect(poly).toHaveCount(0);
  await expect(svg.locator('.items2d')).toHaveCount(0);
  await expect(svg.locator('.overlays2d')).toHaveCount(0);
  await expect(svg.locator('.clearance')).toHaveCount(0);

  await page.getByRole('button', { name: '전기', exact: true }).click();
  await expect(poly).toHaveCount(0);
  await expect(svg.locator('.items2d')).toHaveCount(0);
  await expect(svg.locator('.overlays2d')).toHaveCount(0);

  await page.getByRole('button', { name: '배치', exact: true }).click();
  await expect(page.getByTestId(`item2d-${washer.id}`)).toBeVisible();
  await expect(svg.locator('.overlays2d')).toHaveCount(1);
  expect((await getPlan(page)).layouts[0].items).toHaveLength(1);
});
