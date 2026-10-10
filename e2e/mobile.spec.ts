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

test('모바일 폭에서 체크리스트·내보내기 탭은 가로로 밀리지 않는다 (스펙 §49)', async ({ page }) => {
  for (const tab of ['체크리스트', '내보내기']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const panel = page.locator('.page-panel:visible');
    await expect(panel).toBeVisible();
    const { scrollW, clientW } = await panel.evaluate((el) => ({ scrollW: el.scrollWidth, clientW: el.clientWidth }));
    expect(scrollW, tab).toBeLessThanOrEqual(clientW);
  }
  // 체크리스트 머리(제목·진행률)도 화면 폭 안에 있다
  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  const head = (await page.locator('.cl-head').boundingBox())!;
  expect(head.x).toBeGreaterThanOrEqual(0);
  expect(head.x + head.width).toBeLessThanOrEqual(390);
});

test('두 손가락 핀치로 2D 도면이 확대된다', async ({ page }) => {
  await page.getByRole('button', { name: '구조', exact: true }).click();
  const svg = page.getByTestId('editor2d');
  // 탭이 보이면 캔버스 크기가 잡히면서 평면 전체 맞춤이 한 번 더 일어난다. 그 뒤에 핀치해야 맞춤이 핀치를 덮지 않는다
  await expect.poll(() => svg.evaluate((el) => {
    const [, , w, h] = el.getAttribute('viewBox')!.split(' ').map(Number);
    const r = el.getBoundingClientRect();
    return Math.abs(w / h - r.width / r.height) < 0.01;
  })).toBe(true);
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

test('모바일 폭에서도 저장 버튼이 보이고 누르면 이 브라우저에 바로 저장된다 (스펙 §52)', async ({ page }) => {
  await expect(page.getByTestId('save-status')).toHaveText('변경 없음');
  const save = page.getByRole('button', { name: '저장', exact: true });
  await expect(save).toBeVisible();
  await save.click();
  await expect(page.getByTestId('save-status')).toContainText('저장됨');
  await expect(page.getByText('이 기기 브라우저에 저장했습니다')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('homefit:plan:v1'))).not.toBeNull();
});
