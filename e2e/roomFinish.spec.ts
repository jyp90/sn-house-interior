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

test('색 선택기는 선택을 마칠 때 한 번만 저장한다(되돌리기 1단계)', async ({ page }) => {
  const room = await drawArea(page, SQUARE);
  const pastLen = () => page.evaluate(() => window.__homefit!.store.getState().past.length);
  const before = await pastLen();
  const input = page.getByTestId('properties-panel').getByLabel('바닥재 색');
  // 색 선택기를 끄는 동안처럼 input 이벤트가 여러 번 온 뒤 change 한 번
  await input.evaluate((el: HTMLInputElement) => {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    for (const c of ['#111111', '#222222', '#333333']) {
      setValue.call(el, c);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  expect(await pastLen()).toBe(before);
  await input.fill('#123456');
  expect(await pastLen()).toBe(before + 1);
  const plan = await getPlan(page);
  expect(plan.rooms.find((r) => r.id === room.id)!.floor!.color).toBe('#123456');
});

async function dragPlan(page: Page, from: P, to: P) {
  const a = await planToClient(page, from);
  const b = await planToClient(page, to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.mouse.up();
}

test('벽 위에 놓인 꼭짓점 손잡이도 잡아서 옮길 수 있다', async ({ page }) => {
  const room = await drawArea(page, SQUARE);
  // 꼭짓점 1을 칸막이 벽(w5, x=350) 한가운데로 옮긴다
  await dragPlan(page, SQUARE[1], { x: 350, y: 150 });
  let plan = await getPlan(page);
  expect(plan.rooms.find((r) => r.id === room.id)!.polygon![1]).toEqual({ x: 350, y: 150 });
  const wallsBefore = plan.walls;
  // 벽 위의 손잡이를 다시 잡아 끈다: 벽이 아니라 꼭짓점이 움직여야 한다
  await dragPlan(page, { x: 350, y: 150 }, { x: 320, y: 120 });
  plan = await getPlan(page);
  expect(plan.rooms.find((r) => r.id === room.id)!.polygon![1]).toEqual({ x: 320, y: 120 });
  expect(plan.walls).toEqual(wallsBefore);
});

test('「영역 다시 그리기」를 다시 누르면 그리던 점을 버리고 새로 그린다', async ({ page }) => {
  const room = await drawArea(page, SQUARE);
  const redraw = page.getByTestId('properties-panel').getByRole('button', { name: '영역 다시 그리기' });
  await redraw.click();
  await clickPlan(page, { x: 100, y: 100 });
  await clickPlan(page, { x: 200, y: 100 });
  await redraw.click();
  const pts: P[] = [{ x: 60, y: 60 }, { x: 250, y: 60 }, { x: 250, y: 250 }, { x: 60, y: 250 }];
  for (const p of pts) await clickPlan(page, p);
  await clickPlan(page, pts[0]);
  const plan = await getPlan(page);
  expect(plan.rooms.find((r) => r.id === room.id)!.polygon).toEqual(pts);
});

test('「영역 없는 방 자동 인식」이 닫힌 벽에서 방 영역을 만들고 벽지 프리셋이 3D까지 이어진다 (spec §35)', async ({ page }) => {
  await page.getByRole('button', { name: '구조' }).click();
  await page.getByRole('button', { name: '영역 없는 방 자동 인식' }).click();
  await expect(page.getByTestId('banner')).toContainText('2개 방의 영역을 인식했습니다.');
  await expect(page.getByTestId('room-area-r1')).toBeVisible();
  await expect(page.getByTestId('room-area-r2')).toBeVisible();
  let plan = await getPlan(page);
  const sorted = (pts: P[]) => [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  expect(sorted(plan.rooms[0].polygon!)).toEqual(sorted([{ x: 10, y: 10 }, { x: 344, y: 10 }, { x: 344, y: 390 }, { x: 10, y: 390 }]));
  // 모든 방에 영역이 생기면 버튼은 비활성
  await expect(page.getByRole('button', { name: '영역 없는 방 자동 인식' })).toBeDisabled();

  // 거실 선택 → 벽지 프리셋 「베이지」
  await clickPlan(page, { x: 100, y: 300 });
  expect(await page.evaluate(() => window.__homefit!.store.getState().selectedId)).toBe('r1');
  const props = page.getByTestId('properties-panel');
  await props.getByRole('button', { name: '베이지' }).click();
  plan = await getPlan(page);
  expect(plan.rooms[0].wall!.material).toBe('wallpaper');

  await page.getByRole('button', { name: '배치' }).click();
  await page.getByRole('button', { name: '3D 탑뷰' }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});
