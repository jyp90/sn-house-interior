import { expect, test } from '@playwright/test';

// 스펙 §44: 모바일 전용 화면은 일부러 두지 않는다. 좁은 기기에서도 PC 레이아웃이 그대로 나오고(viewport 폭 1200), 안내 문구가 보이며, 캔버스 핀치로 도면을 확대한다
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('모바일 폭에서도 PC 레이아웃·도구 패널이 그대로 나오고 안내 문구가 보인다', async ({ page }) => {
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', 'width=1200');
  await page.getByRole('button', { name: '구조', exact: true }).click();
  await expect(page.locator('.left')).toBeVisible();
  await expect(page.locator('.left').getByRole('button', { name: '벽 그리기' })).toBeVisible();
  await expect(page.locator('.right')).toBeVisible();
  await expect(page.getByTestId('mobile-note')).toContainText('일부러 두지 않았습니다');
  await expect(page.getByRole('button', { name: 'JSON 저장' })).toBeVisible();
});

test('두 손가락 핀치로 2D 도면이 확대된다', async ({ page }) => {
  await page.getByRole('button', { name: '구조', exact: true }).click();
  const svg = page.getByTestId('editor2d');
  const before = (await svg.getAttribute('viewBox'))!.split(' ').map(Number);
  await svg.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
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
