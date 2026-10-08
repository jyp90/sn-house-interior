import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('base 경로 빌드에서 PDF를 내려받고 글꼴을 base 아래에서 가져온다', async ({ page }) => {
  const fontStatuses: [string, number][] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('.ttf')) fontStatuses.push([new URL(r.url()).pathname, r.status()]);
  });
  await page.getByRole('button', { name: '내보내기', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByTestId('export-view').getByRole('button', { name: 'PDF 내려받기' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expect(fontStatuses.length).toBeGreaterThanOrEqual(2);
  for (const [path, status] of fontStatuses) {
    expect(path).toMatch(/^\/sn-house-interior\/assets\//);
    expect(status).toBe(200);
  }
});

test('base 경로 빌드에서 글꼴 라이선스 링크가 열린다', async ({ page, request }) => {
  const href = await page.getByRole('link', { name: '글꼴 라이선스' }).getAttribute('href');
  expect(href).toBe('/sn-house-interior/licenses/Pretendard-OFL.txt');
  const res = await request.get(`http://localhost:5181${href}`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('SIL Open Font License, Version 1.1');
});
