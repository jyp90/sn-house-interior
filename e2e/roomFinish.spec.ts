import { expect, test, type Page } from '@playwright/test';

type P = { x: number; y: number };

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);

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

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('영역 도구로 방을 그리고 바닥재를 바꾸면 2D 패턴과 3D에 반영된다', async ({ page }) => {
  await page.getByRole('button', { name: '구조' }).click();
  await page.getByRole('button', { name: '영역', exact: true }).click();
  await clickPlan(page, { x: 40, y: 40 });
  await clickPlan(page, { x: 300, y: 40 });
  await clickPlan(page, { x: 300, y: 340 });
  await clickPlan(page, { x: 40, y: 340 });
  await clickPlan(page, { x: 40, y: 40 }); // 첫 점 → 닫기

  let plan = await getPlan(page);
  const room = plan.rooms[plan.rooms.length - 1];
  expect(room.polygon).toHaveLength(4);
  expect(room.name).toBe('방 3');
  await expect(page.getByTestId(`room-area-${room.id}`)).toBeVisible();

  // 「기본 마감」(구조 패널)에도 같은 칩이 있으므로 방 속성 패널로 한정
  const props = page.getByTestId('properties-panel');
  await props.getByRole('button', { name: '월넛' }).click();
  plan = await getPlan(page);
  expect(plan.rooms.find((r) => r.id === room.id)!.floor).toEqual({ material: 'wood', color: '#7a5230' });
  await expect(page.getByTestId(`room-area-${room.id}`)).toHaveAttribute('fill', `url(#floor-${room.id})`);

  await props.getByRole('button', { name: '그레이 포세린' }).click();
  plan = await getPlan(page);
  expect(plan.rooms.find((r) => r.id === room.id)!.floor!.material).toBe('tile');

  await page.getByRole('button', { name: '배치' }).click();
  await page.getByRole('button', { name: '3D 탑뷰' }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();

  // 영역 없이 Enter로 닫으면 오류 배너
  await page.getByRole('button', { name: '구조' }).click();
  await page.getByRole('button', { name: '영역', exact: true }).click();
  await clickPlan(page, { x: 500, y: 100 });
  await clickPlan(page, { x: 560, y: 100 });
  await page.keyboard.press('Enter');
  await expect(page.getByText('영역은 꼭짓점 3개 이상이어야 합니다.')).toBeVisible();
  await page.keyboard.press('Escape');
});

async function drawArea(page: Page, pts: P[]) {
  await page.getByRole('button', { name: '구조' }).click();
  await page.getByRole('button', { name: '영역', exact: true }).click();
  for (const p of pts) await clickPlan(page, p);
  await clickPlan(page, pts[0]);
  const plan = await getPlan(page);
  return plan.rooms[plan.rooms.length - 1];
}

const SQUARE: P[] = [
  { x: 40, y: 40 },
  { x: 300, y: 40 },
  { x: 300, y: 340 },
  { x: 40, y: 340 },
];

test('선택 도구로 방 영역 안을 끌면 방 선택은 유지되고 화면이 이동한다', async ({ page }) => {
  const room = await drawArea(page, SQUARE);
  const svg = page.getByTestId('editor2d');
  const before = await svg.getAttribute('viewBox');
  const a = await planToClient(page, { x: 170, y: 190 });
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 60, a.y + 40, { steps: 5 });
  await page.mouse.up();
  expect(await svg.getAttribute('viewBox')).not.toBe(before);
  expect(await page.evaluate(() => window.__homefit!.store.getState().selectedId)).toBe(room.id);
  await expect(page.getByTestId(`room-area-${room.id}`)).toHaveClass(/room-area-selected/);
});
