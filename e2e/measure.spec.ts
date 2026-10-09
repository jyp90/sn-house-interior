import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('측정 도구: 3D에서 누르면 2D로 바뀌고 두 점 거리를 보여 주며 Esc로 지운다', async ({ page }) => {
  await page.getByRole('button', { name: '측정', exact: true }).click();
  await expect(page.getByRole('button', { name: '2D', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '측정', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const editor = page.getByTestId('editor2d');
  const box = (await editor.boundingBox())!;
  await editor.click({ position: { x: box.width * 0.3, y: box.height * 0.5 } });
  await editor.click({ position: { x: box.width * 0.6, y: box.height * 0.5 } });
  const m = await page.evaluate(() => window.__homefit!.ui.getState().measure);
  expect(m?.b).not.toBeNull();
  const dist = Math.round(Math.hypot(m!.b!.x - m!.a.x, m!.b!.y - m!.a.y));
  await expect(page.getByTestId('measure-label')).toContainText(`${dist}cm`);
  expect(dist).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('measure')).toHaveCount(0);
  await page.getByRole('button', { name: '측정', exact: true }).click();
  await expect(page.getByRole('button', { name: '측정', exact: true })).toHaveAttribute('aria-pressed', 'false');
});
