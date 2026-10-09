import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);
const canvasWidth = (page: Page) => page.locator('.viewport canvas').evaluate((c) => (c as HTMLCanvasElement).width);
// R3F Canvas는 마운트 시 기본 HTML 캔버스 크기(300)로 시작했다가 ResizeObserver 콜백(비동기, 수백 ms 소요)이
// 한 번 실행된 뒤에야 실제 컨테이너 크기로 맞춰진다. 이 지연은 export 모드와 무관하게 항상 있던 특성이라
// 안정된 값을 읽을 때까지 기다린 뒤 비교한다(동등 비교 자체는 그대로 유지).
async function stableCanvasWidth(page: Page): Promise<number> {
  let prev = -1;
  let streak = 0;
  for (let i = 0; i < 100; i++) {
    const next = await canvasWidth(page);
    streak = next === prev ? streak + 1 : 1;
    prev = next;
    if (streak >= 20) return next;
    await page.waitForTimeout(50);
  }
  return prev;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('기본 정보를 넣고 PDF를 내려받으면 쪽수가 맞는 PDF가 저장된다', async ({ page }) => {
  const widthBefore = await stableCanvasWidth(page);
  await page.getByTestId('catalog-card-samsung-grande-washer-sample').getByRole('button', { name: '추가' }).click();
  await page.getByRole('button', { name: '내보내기', exact: true }).click();
  const view = page.getByTestId('export-view');
  await view.getByLabel('주소').fill('테스트시 테스트로 1');
  await view.getByLabel('주소').press('Enter');
  await expect.poll(async () => (await getPlan(page)).info.address).toBe('테스트시 테스트로 1');

  const downloading = page.waitForEvent('download');
  await view.getByRole('button', { name: 'PDF 내려받기' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('sn-house-interior-샘플-평면-A안.pdf');
  await expect(view.getByTestId('pdf-status')).toContainText('PDF를 저장했습니다');
  const pages = Number((await view.getByTestId('pdf-status').textContent())!.match(/\((\d+)쪽\)/)![1]);
  expect(pages).toBeGreaterThanOrEqual(10); // 방 마감표 + 창호 일람 2쪽 추가(spec §25)

  const body = readFileSync((await download.path())!);
  expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const text = body.toString('latin1');
  expect(text).toContain('Pretendard');
  expect(text.match(/\/Type \/Page\b/g)?.length).toBe(pages);
  expect(text.match(/\/Subtype \/Image/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

  await page.getByRole('button', { name: '배치', exact: true }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  expect(await stableCanvasWidth(page)).toBe(widthBefore);
});

test('글꼴을 못 받으면 안내하고, 다시 시도하면 만든다', async ({ page }) => {
  await page.route('**/*.ttf*', (route) => route.abort());
  await page.getByRole('button', { name: '내보내기', exact: true }).click();
  const view = page.getByTestId('export-view');
  await view.getByRole('button', { name: 'PDF 내려받기' }).click();
  await expect(view.getByTestId('pdf-status')).toContainText('글꼴을 불러오지 못했습니다');

  await page.unroute('**/*.ttf*');
  const downloading = page.waitForEvent('download');
  await view.getByRole('button', { name: '다시 시도' }).click();
  await downloading;
  await expect(view.getByTestId('pdf-status')).toContainText('PDF를 저장했습니다');
});
