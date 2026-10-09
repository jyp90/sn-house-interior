import { expect, test, type Page } from '@playwright/test';

type P = { x: number; y: number };

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);

async function planToClient(page: Page, p: P): Promise<P> {
  return page.getByTestId('editor2d').evaluate((svg, q) => {
    const m = (svg as SVGSVGElement).getScreenCTM()!;
    const r = new DOMPoint(q.x, q.y).matrixTransform(m);
    return { x: r.x, y: r.y };
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

test('배치된 가구 목록이 방별로 묶이고, 행을 클릭하면 그 아이템이 선택된다', async ({ page }) => {
  await page.getByRole('button', { name: '배치', exact: true }).click();
  const itemList = page.getByTestId('item-list');
  await expect(itemList).toContainText('배치된 가구 (0)');

  await page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' }).click();
  await page.getByTestId('catalog-card-table-dining-4').getByRole('button', { name: '추가' }).click();
  await expect(itemList).toContainText('방 미지정 (2)');

  // 거실(r1) 영역을 그려서 두 아이템(배치 중심 부근)을 거실 안에 넣는다.
  // planCenter(SAMPLE_PLAN) = (300,200)이고, 이 영역은 (20,20)-(330,20)-(330,380)-(20,380)이므로 중심이 그 안에 든다
  await page.getByRole('button', { name: '구조', exact: true }).click();
  await page.getByTestId('room-r1').click();
  await page.getByTestId('properties-panel').getByRole('button', { name: '영역 그리기' }).click();
  await clickPlan(page, { x: 20, y: 20 });
  await clickPlan(page, { x: 330, y: 20 });
  await clickPlan(page, { x: 330, y: 380 });
  await clickPlan(page, { x: 20, y: 380 });
  await clickPlan(page, { x: 20, y: 20 }); // 첫 점 → 닫기

  let plan = await getPlan(page);
  expect(plan.rooms.find((r) => r.id === 'r1')!.polygon).toHaveLength(4);

  await page.getByRole('button', { name: '배치', exact: true }).click();
  await expect(itemList).toContainText('거실 (2)');

  plan = await getPlan(page);
  const sofa = plan.layouts[0].items.find((i) => i.productId === 'sofa-3seat')!;
  await page.getByTestId(`item-row-${sofa.id}`).click();
  await expect(page.getByTestId('properties-panel').getByRole('heading', { name: '3인 소파' })).toBeVisible();

  // 접기
  const toggle = itemList.getByRole('button', { name: /배치된 가구/ });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#item-list-body')).toBeHidden();
});
