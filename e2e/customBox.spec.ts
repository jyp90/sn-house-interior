import { expect, test, type Page } from '@playwright/test';

const items = (page: Page) =>
  page.evaluate(() => {
    const p = window.__homefit!.store.getState().plan;
    return p.layouts.find((l) => l.id === p.activeLayoutId)!.items;
  });

function polygonWidth(points: string): number {
  const xs = points
    .trim()
    .split(/\s+/)
    .map((pair) => Number(pair.split(',')[0]));
  return Math.max(...xs) - Math.min(...xs);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('사용자 정의 박스의 치수를 고치고 메모를 남기면 2D·새로고침에 반영된다', async ({ page }) => {
  const form = page.locator('.custom-box');
  await form.locator('label', { hasText: '이름' }).locator('input').fill('수납장');
  await form.getByRole('button', { name: '추가' }).click();

  await expect.poll(async () => (await items(page)).length).toBe(1);
  const created = (await items(page))[0];

  await page.getByRole('button', { name: '2D', exact: true }).click();
  const poly = page.getByTestId(`item2d-${created.id}`);
  await expect(poly).toBeVisible();
  const before = await poly.getAttribute('points');

  const props = page.getByTestId('properties-panel');
  const wField = props.locator('label', { hasText: '폭 W' }).locator('input');
  await wField.fill('120');
  await wField.press('Enter');

  await expect.poll(async () => page.evaluate(() => {
    const p = window.__homefit!.store.getState().plan;
    return p.customProducts[0]?.dims.w;
  })).toBe(120);
  await expect.poll(async () => poly.getAttribute('points')).not.toBe(before);
  await expect.poll(async () => polygonWidth((await poly.getAttribute('points'))!)).toBeCloseTo(120, 0);

  const noteField = props.locator('label', { hasText: '메모' }).locator('textarea');
  await noteField.fill('콘센트 확인');
  await noteField.blur();

  await expect.poll(async () => (await items(page)).find((i) => i.id === created.id)?.note).toBe('콘센트 확인');

  // 잠그면 치수 필드는 비활성화되지만 메모는 계속 편집할 수 있다
  await page.getByLabel('잠금').check();
  await expect(wField).toBeDisabled();
  await expect(noteField).toBeEnabled();
  await page.getByLabel('잠금').uncheck();
  await expect(wField).toBeEnabled();

  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await expect.poll(async () => (await items(page)).find((i) => i.id === created.id)?.note).toBe('콘센트 확인');
  await expect.poll(async () => page.evaluate(() => {
    const p = window.__homefit!.store.getState().plan;
    return p.customProducts[0]?.dims.w;
  })).toBe(120);
});
