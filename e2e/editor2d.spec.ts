import { expect, test, type Page } from '@playwright/test';

type P = { x: number; y: number };

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);
const selectedId = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().selectedId);

async function planToClient(page: Page, p: P): Promise<P> {
  return page.evaluate(({ x, y }) => {
    const svg = document.querySelector<SVGSVGElement>('[data-testid="editor2d"]')!;
    const pt = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!);
    return { x: pt.x, y: pt.y };
  }, p);
}

async function clickPlan(page: Page, p: P) {
  const c = await planToClient(page, p);
  await page.mouse.click(c.x, c.y);
}

async function dragBy(page: Page, from: P, dx: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y, { steps: 6 });
  await page.mouse.up();
}

async function centerOf(page: Page, testId: string): Promise<P> {
  const b = (await page.getByTestId(testId).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('구조 모드에서 방을 만들고 문을 달면 내측 치수가 유지된다', async ({ page }) => {
  await page.getByRole('button', { name: '구조' }).click();
  await expect(page.getByTestId('editor2d')).toBeVisible();
  await page.getByRole('button', { name: '방 만들기' }).click();
  await page.getByLabel('이름').fill('서재');
  await page.getByLabel('내측 가로 W').fill('400');
  await page.getByLabel('내측 세로 D').fill('300');
  await page.getByLabel('벽 두께').fill('15');
  await clickPlan(page, { x: 100, y: 100 });

  const plan = await getPlan(page);
  const walls = plan.walls.slice(-4);
  const xs = walls.flatMap((w) => [w.a.x, w.b.x]);
  const ys = walls.flatMap((w) => [w.a.y, w.b.y]);
  expect(Math.max(...xs) - Math.min(...xs) - 15).toBe(400);
  expect(Math.max(...ys) - Math.min(...ys) - 15).toBe(300);
  expect(plan.rooms.some((r) => r.name === '서재')).toBe(true);

  const topWallY = Math.min(...ys);
  await page.getByRole('button', { name: '문', exact: true }).click();
  await clickPlan(page, { x: 300, y: topWallY });
  await expect.poll(async () => (await getPlan(page)).openings.length).toBe(plan.openings.length + 1);
  await expect(page.getByTestId('properties-panel').getByRole('heading', { name: '문' })).toBeVisible();

  const door = (await getPlan(page)).openings.at(-1)!;
  await page.getByRole('button', { name: '선택', exact: true }).click();
  await dragBy(page, await centerOf(page, `opening-gap-${door.id}`), 40);
  await expect.poll(async () => (await getPlan(page)).openings.find((o) => o.id === door.id)!.offset).toBeGreaterThan(door.offset);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).openings.find((o) => o.id === door.id)!.offset).toBe(door.offset);
});

test('벽 그리기는 더블클릭으로 끝나고, 끝점 드래그는 연결된 벽과 함께 움직이며 실행 취소 한 번에 돌아간다', async ({ page }) => {
  await page.getByRole('button', { name: '구조' }).click();
  const before = (await getPlan(page)).walls.length;
  await page.getByRole('button', { name: '벽 그리기' }).click();
  await clickPlan(page, { x: 50, y: 100 });
  await clickPlan(page, { x: 250, y: 100 });
  const end = await planToClient(page, { x: 250, y: 300 });
  await page.mouse.dblclick(end.x, end.y);
  await expect.poll(async () => (await getPlan(page)).walls.length).toBe(before + 2);
  const added = (await getPlan(page)).walls.slice(-2);
  expect(added.every((w) => w.a.x !== w.b.x || w.a.y !== w.b.y)).toBe(true);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).walls.length).toBe(before);

  await page.getByRole('button', { name: '선택', exact: true }).click();
  await clickPlan(page, { x: 300, y: 0 });
  expect(await selectedId(page)).toBe('w1');
  const handle = page.locator('.endpoint-handle').nth(1);
  const hb = (await handle.boundingBox())!;
  await dragBy(page, { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, 40);
  const moved = await getPlan(page);
  const w1 = moved.walls.find((w) => w.id === 'w1')!;
  const w2 = moved.walls.find((w) => w.id === 'w2')!;
  expect(w1.b.x).toBeGreaterThan(600);
  expect(w2.a).toEqual(w1.b);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).walls.find((w) => w.id === 'w1')!.b).toEqual({ x: 600, y: 0 });
});

test('배경 도면을 불러와 축척을 보정하고 새로고침 후에도 유지된다', async ({ page }) => {
  await page.getByRole('button', { name: '구조' }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 400, 300);
    g.strokeStyle = '#000000';
    g.lineWidth = 4;
    g.strokeRect(20, 20, 360, 260);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByTestId('open-background').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByTestId('background-image')).toBeVisible();
  await expect(page.getByTestId('scale-info')).toContainText('축척 미보정');

  await page.getByRole('button', { name: '축척 보정' }).click();
  await clickPlan(page, { x: 50, y: 150 });
  await clickPlan(page, { x: 250, y: 150 });
  await page.getByLabel('실제 길이').fill('400');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByTestId('scale-info')).toContainText('축척 1px = 2.00cm');
  await expect(page.getByTestId('save-status')).toContainText('저장됨');

  await page.reload();
  await page.getByRole('button', { name: '구조' }).click();
  await expect(page.getByTestId('background-image')).toBeVisible();
  await expect(page.getByTestId('scale-info')).toContainText('축척 1px = 2.00cm');
});

test('2D 배치에서 드래그·실행 취소·잠금이 동작한다', async ({ page }) => {
  await page.getByRole('button', { name: '2D' }).click();
  const editor = page.getByTestId('editor2d');
  await expect(editor).toBeVisible();
  const box = (await editor.boundingBox())!;
  await page.getByTestId('catalog-card-sofa-3seat').dragTo(page.locator('.editor2d'), {
    sourcePosition: { x: 12, y: 12 },
    targetPosition: { x: box.width / 2, y: box.height / 2 },
  });
  await expect.poll(async () => (await getPlan(page)).items.length).toBe(1);

  const first = (await getPlan(page)).items[0];
  const start = await centerOf(page, `item2d-${first.id}`);
  await dragBy(page, start, 60);
  await expect.poll(async () => (await getPlan(page)).items[0].x).toBeGreaterThan(first.x);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).items[0].x).toBe(first.x);

  await page.getByLabel('잠금').check();
  await dragBy(page, await centerOf(page, `item2d-${first.id}`), 60);
  expect((await getPlan(page)).items[0]).toMatchObject({ x: first.x, y: first.y, locked: true });
});

test('겹친 물체는 클릭하면 후보 목록에서 고른다', async ({ page }) => {
  await page.getByRole('button', { name: '2D' }).click();
  const add = page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' });
  await add.click();
  await add.click();
  const ids = (await getPlan(page)).items.map((i) => i.id);
  expect(ids).toHaveLength(2);
  const c = await centerOf(page, `item2d-${ids[1]}`);
  await page.mouse.click(c.x, c.y);
  const menu = page.getByTestId('candidates');
  await expect(menu.getByRole('menuitem')).toHaveCount(2);
  await menu.getByRole('menuitem').nth(1).click();
  expect(await selectedId(page)).toBe(ids[0]);
  await expect(menu).toBeHidden();
});

test('스냅 토글·저장 상태·3D 시점 초기화', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: '스냅 켜짐' }).click();
  await expect(page.getByRole('button', { name: '스냅 꺼짐' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('save-status')).toHaveText('변경 없음');
  await page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' }).click();
  await expect(page.getByTestId('save-status')).toContainText('저장됨');
  await page.getByRole('button', { name: '3D 탑뷰' }).click();
  await page.getByRole('button', { name: '시점 초기화' }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
