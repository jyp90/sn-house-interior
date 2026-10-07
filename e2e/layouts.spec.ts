import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type P = { x: number; y: number };

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);
const itemsOf = (plan: Awaited<ReturnType<typeof getPlan>>) => plan.layouts.find((l) => l.id === plan.activeLayoutId)!.items;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function centerOf(page: Page, testId: string): Promise<P> {
  const b = (await page.getByTestId(testId).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function dragBy(page: Page, from: P, dx: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y, { steps: 6 });
  await page.mouse.up();
}

const addSofa = (page: Page) => page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('B안에서 옮겨도 A안은 그대로이고, 같은 시점에서 겹쳐 보며 전환한다', async ({ page }) => {
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await addSofa(page);
  const original = itemsOf(await getPlan(page))[0];
  const bar = page.getByTestId('layout-bar');
  await bar.getByRole('button', { name: '복제' }).click();
  await expect(bar.getByRole('button', { name: 'B안' })).toHaveAttribute('aria-pressed', 'true');

  const b = itemsOf(await getPlan(page))[0];
  await dragBy(page, await centerOf(page, `item2d-${b.id}`), 80);
  await expect.poll(async () => itemsOf(await getPlan(page))[0].x).toBeGreaterThan(original.x);

  await bar.getByLabel('겹쳐 볼 배치안').selectOption({ label: 'A안' });
  await expect(page.getByTestId('compare-ghosts')).toBeVisible();
  const viewBox = await page.getByTestId('editor2d').getAttribute('viewBox');
  await bar.getByRole('button', { name: '비교 대상과 전환' }).click();
  await expect(bar.getByRole('button', { name: 'A안' })).toHaveAttribute('aria-pressed', 'true');
  expect(itemsOf(await getPlan(page))[0].x).toBe(original.x);
  await expect(page.getByTestId('compare-ghosts')).toBeVisible();
  expect(await page.getByTestId('editor2d').getAttribute('viewBox')).toBe(viewBox);
});

test('2D·3D PNG를 내보낸다', async ({ page }) => {
  await addSofa(page);
  const [d2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '2D PNG' }).click()]);
  expect(d2.suggestedFilename()).toBe('homefit-샘플-평면-A안-2d.png');
  const png2 = readFileSync((await d2.path())!);
  expect([...png2.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(png2.length).toBeGreaterThan(5000);

  const [d3] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '3D PNG' }).click()]);
  expect(d3.suggestedFilename()).toBe('homefit-샘플-평면-A안-3d.png');
  const png3 = readFileSync((await d3.path())!);
  expect([...png3.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(png3.length).toBeGreaterThan(5000);
});

test('이력: 지금 저장한 버전으로 복원하고 실행 취소로 되돌린다', async ({ page }) => {
  await page.getByRole('button', { name: '이력' }).click();
  const panel = page.getByTestId('history-panel');
  await panel.getByLabel('버전 이름').fill('처음');
  await panel.getByRole('button', { name: '지금 버전 저장' }).click();
  await panel.getByRole('button', { name: '닫기' }).click();

  await addSofa(page);
  await expect.poll(async () => itemsOf(await getPlan(page)).length).toBe(1);

  await page.getByRole('button', { name: '이력' }).click();
  await expect(panel.getByText('처음')).toBeVisible();
  await panel.getByRole('button', { name: '복원' }).first().click();
  await expect.poll(async () => itemsOf(await getPlan(page)).length).toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => itemsOf(await getPlan(page)).length).toBe(1);
});

test('충돌 배지를 누르면 무엇과 겹치는지 보여준다', async ({ page }) => {
  await addSofa(page);
  await addSofa(page);
  // 전제: 샘플 평면 중앙에 놓인 3인 소파(폭 210)는 x=350 칸막이 벽 w5에 걸친다
  const sofa = itemsOf(await getPlan(page))[1];
  expect(sofa.x - 105).toBeLessThan(350);
  expect(sofa.x + 105).toBeGreaterThan(350);
  await page.getByTestId('status-collides').click();
  const details = page.getByTestId('conflict-details');
  await expect(details).toContainText('충돌:');
  await expect(details).toContainText('3인 소파');
  await expect(details).toContainText('벽');
});
