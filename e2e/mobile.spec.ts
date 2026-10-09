import { expect, test } from '@playwright/test';

// 스펙 §48: 폰 폭에서도 같은 도구·패널이 1열로 쌓여 전부 보이고(viewport는 기기 폭), 캔버스 핀치로 도면을 확대한다
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('모바일 폭에서는 캔버스 → 속성 → 도구 순 1열이고 도구·패널이 전부 보인다', async ({ page }) => {
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=device-width, initial-scale=1.0');
  await page.getByRole('button', { name: '구조', exact: true }).click();
  await expect(page.locator('.left')).toBeVisible();
  await expect(page.locator('.left').getByRole('button', { name: '벽 그리기' })).toBeVisible();
  await expect(page.locator('.right')).toBeVisible();
  // 1열: 캔버스가 속성보다, 속성이 도구보다 위
  const top = async (sel: string) => (await page.locator(sel).boundingBox())!.y;
  expect(await top('.center')).toBeLessThan(await top('.right'));
  expect(await top('.right')).toBeLessThan(await top('.left'));
  // 가로 스크롤 없음
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole('button', { name: 'JSON 저장' })).toBeVisible();
});

test('두 손가락 핀치로 2D 도면이 확대된다', async ({ page }) => {
  await page.getByRole('button', { name: '구조', exact: true }).click();
  const svg = page.getByTestId('editor2d');
  const before = (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
  await svg.evaluate((el) => {
    // 캔버스 가운데는 샘플 평면의 벽이라(벽이 포인터를 가져간다) 왼쪽 위 빈 곳에서 핀치한다
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width * 0.2;
    const cy = r.top + r.height * 0.2;
    const ev = (type: string, id: number, x: number, y: number) =>
      el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, button: 0, buttons: 1, clientX: x, clientY: y, bubbles: true }));
    ev('pointerdown', 1, cx - 20, cy);
    ev('pointerdown', 2, cx + 20, cy);
    ev('pointermove', 1, cx - 60, cy);
    ev('pointermove', 2, cx + 60, cy);
    ev('pointerup', 1, cx - 60, cy);
    ev('pointerup', 2, cx + 60, cy);
  });
  await expect.poll(async () => (await svg.getAttribute('viewBox'))!.split(' ').map(Number)[2]).toBeLessThan(before[2] * 0.5);
});
