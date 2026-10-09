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
  const props = page.getByTestId('properties-panel');
  const heightField = props.locator('label', { hasText: '설치 높이' }).locator('input');
  const xField = props.locator('label', { hasText: 'X' }).locator('input');
  const yField = props.locator('label', { hasText: 'Y' }).locator('input');

  await page.getByLabel('제품 찾기').fill('상부장');
  await page.getByTestId('catalog-card-kitchen-upper-240').getByRole('button', { name: '추가' }).click();
  await expect.poll(async () => (await items(page)).length).toBe(1);
  const upper = (await items(page))[0];

  await page.getByRole('button', { name: '2D', exact: true }).click();
  const poly = page.getByTestId(`item2d-${upper.id}`);
  await expect(poly).toHaveAttribute('data-elevation', '145');
  await expect(poly).toHaveClass(/item2d-elevated/);

  await heightField.fill('160');
  await heightField.press('Enter');
  await expect(poly).toHaveAttribute('data-elevation', '160');

  // 벽(w5, x=350)에서 떨어진 거실 안쪽으로 상부장을 옮겨 벽 충돌을 배제한 뒤 비교한다
  // (상부장은 추가 직후 자동 선택되어 있으므로 속성 패널의 X/Y를 바로 쓴다)
  await xField.fill('175');
  await xField.press('Enter');
  await yField.fill('100');
  await yField.press('Enter');
  await expect.poll(async () => (await items(page)).find((i) => i.id === upper.id)?.x).toBe(175);
  await expect.poll(async () => (await items(page)).find((i) => i.id === upper.id)?.y).toBe(100);

  await page.getByLabel('제품 찾기').fill('');
  await page.getByTestId('catalog-card-table-dining-4').getByRole('button', { name: '추가' }).click();
  await expect.poll(async () => (await items(page)).length).toBe(2);
  const table = (await items(page)).find((i) => i.id !== upper.id)!;
  // 식탁도 추가 직후 자동 선택되므로 같은 속성 패널의 X/Y로 상부장 바로 아래에 둔다
  await xField.fill('175');
  await xField.press('Enter');
  await yField.fill('100');
  await yField.press('Enter');
  await expect.poll(async () => (await items(page)).find((i) => i.id === table.id)?.x).toBe(175);
  await expect.poll(async () => (await items(page)).find((i) => i.id === table.id)?.y).toBe(100);
  await expect(page.getByTestId('status-collides')).toHaveCount(0);

  // 겹친 상부장을 다시 선택한다: 식탁(140cm)보다 넓은 상부장(240cm)의 드러난 왼쪽 끝을 클릭
  const box = await poly.boundingBox();
  if (!box) throw new Error('상부장 2D 외곽선을 찾을 수 없습니다');
  await poly.click({ position: { x: box.width * 0.08, y: box.height / 2 } });
  const candidates = page.getByTestId('candidates');
  await expect(candidates.or(heightField)).toBeVisible();
  if (await candidates.isVisible().catch(() => false)) {
    await page.getByRole('menuitem', { name: '상부장 240' }).click();
  }
  await expect(heightField).toHaveValue('160');

  await heightField.fill('0');
  await heightField.press('Enter');
  await expect(page.getByTestId('status-collides')).toBeVisible();

  await heightField.fill('160');
  await heightField.press('Enter');
  await expect(page.getByTestId('status-collides')).toHaveCount(0);

  await props.getByRole('button', { name: '기본값' }).click();
  await expect(poly).toHaveAttribute('data-elevation', '145');
  await page.keyboard.press('Control+z');
  await expect(poly).toHaveAttribute('data-elevation', '160');

  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByTestId(`item2d-${upper.id}`)).toHaveAttribute('data-elevation', '160');
});
