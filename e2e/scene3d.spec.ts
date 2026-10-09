import { expect, test } from '@playwright/test';

test('3D 방 이름 라벨이 모든 방에 보이고 라벨 루트 경고가 없다', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();

  await page.getByRole('button', { name: '배치', exact: true }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const labels = page.locator('.viewport .room-label');
  await expect(labels).toHaveCount(2);
  await expect(labels).toHaveText(['거실', '방']);
  for (const l of await labels.all()) await expect(l).toBeVisible();

  // 가구를 추가하면 선택되고 벽 간격 라벨이 뜬다
  await page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' }).click();
  await expect(page.locator('.viewport .dist-label').first()).toBeVisible();
  await expect(page.locator('.viewport .dist-label').first()).toHaveText(/^\d+cm$/);

  // 빈 곳을 눌러 선택을 풀면 간격 라벨이 사라진다
  await page.locator('.viewport canvas').click({ position: { x: 5, y: 5 } });
  await expect.poll(() => page.evaluate(() => window.__homefit!.store.getState().selectedId)).toBeNull();
  await expect(page.locator('.viewport .dist-label')).toHaveCount(0);

  expect(errors.filter((e) => /synchronously unmount a root/.test(e))).toEqual([]);
});

test('첫 로드에서 3D 캔버스가 r3f 기본 크기(300x150)로 깜빡이지 않고 뷰포트를 바로 채운다 (spec §30.4)', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: '배치', exact: true }).click();
  await page.getByRole('button', { name: '3D', exact: true }).click();
  const canvas = page.locator('.viewport canvas');
  const viewport = page.locator('.viewport');
  await expect(canvas).toBeVisible();
  const [canvasBox, viewportBox] = await Promise.all([canvas.boundingBox(), viewport.boundingBox()]);
  expect(canvasBox).not.toBeNull();
  expect(viewportBox).not.toBeNull();
  expect(Math.abs(canvasBox!.width - viewportBox!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(canvasBox!.height - viewportBox!.height)).toBeLessThanOrEqual(2);
});
