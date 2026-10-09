import { expect, test, type Page } from '@playwright/test';

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('자동 항목이 배치에서 만들어지고, 체크와 메모가 새로고침 후에도 남는다', async ({ page }) => {
  await page.getByTestId('catalog-card-samsung-grande-washer-sample').getByRole('button', { name: '추가' }).click();
  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  const list = page.getByTestId('checklist');
  await expect(list.locator('[data-testid^="checklist-auto-circuit-"]').filter({ hasText: '전용회로 확인: 그랑데 드럼세탁기' })).toHaveCount(1);
  await expect(page.getByTestId('properties-panel')).toHaveCount(0);

  const row = list.getByTestId('checklist-i-demo-1');
  await row.getByRole('checkbox').check();
  // 체크 직후 저장 상태 표시 등으로 레이아웃이 밀리면 마우스가 행을 벗어나 호버 전용 버튼이 숨는다 → 다시 올려 누른다
  await expect(async () => {
    await row.hover();
    await row.getByRole('button', { name: '+ 메모' }).click({ timeout: 1000 });
  }).toPass();
  await row.getByLabel('메모').fill('거실 붙박이장 포함');
  await row.getByLabel('메모').press('Enter');
  await expect.poll(async () => (await getPlan(page)).checklist).toEqual([{ itemId: 'i-demo-1', checked: true, memo: '거실 붙박이장 포함' }]);
  await expect(page.getByTestId('save-status')).toContainText('저장됨');

  await page.reload();
  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  await expect(page.getByTestId('checklist-i-demo-1').getByRole('checkbox')).toBeChecked();
  await expect(page.getByTestId('checklist-i-demo-1').getByLabel('메모')).toHaveValue('거실 붙박이장 포함');
});
