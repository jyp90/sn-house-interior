import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('모바일 폭에서는 보기 전용: 패널이 숨고, 선택은 되지만 드래그는 막히며, 체크리스트와 3D 전환은 된다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));

  // 로드 → 왼쪽 패널 숨김, .mobile-info 표시
  await expect(page.locator('.left')).toBeHidden();
  const info = page.getByTestId('mobile-info');
  await expect(info).toBeVisible();
  await expect(info).toContainText('선택된 항목 없음');

  // 소파를 하나 심어 둔다(스토어 액션으로 시드 — 실제 조작은 아래에서 UI로 한다)
  const id = await page.evaluate(() => window.__homefit!.store.getState().addItem('sofa-3seat', 'gray', { x: 100, y: 100 }));

  // 배치 모드, 2D로 전환해서 탭으로 선택
  await page.getByRole('button', { name: '배치', exact: true }).click();
  await page.getByRole('button', { name: '2D', exact: true }).click();
  const item = page.getByTestId(`item2d-${id}`);
  await item.click();
  await expect(info).toContainText('3인 소파');

  // 드래그를 시도해도 좌표는 바뀌지 않는다
  const box = await item.boundingBox();
  if (!box) throw new Error('item2d bounding box missing');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 80, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(
    (itemId) => window.__homefit!.store.getState().plan.layouts[0].items.find((i) => i.id === itemId),
    id,
  );
  expect(after).toMatchObject({ x: 100, y: 100 });

  // 체크리스트 탭에서 체크 가능
  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  const firstCheck = page.locator('.cl-check input').first();
  await firstCheck.check();
  await expect(firstCheck).toBeChecked();

  // 배치 모드로 돌아와 3D로 전환
  await page.getByRole('button', { name: '배치', exact: true }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
