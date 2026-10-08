import { expect, test } from '@playwright/test';

// 실제 git pull이 일어나지 않도록 업데이트 API만 가로챈다. 버튼 클릭·배너·새로고침은 실제 흐름 그대로다.
const PATH = '**/__homefit/update';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('업데이트 API는 다른 출처나 헤더 없는 요청을 거부한다', async ({ request }) => {
  expect((await request.post('/__homefit/update')).status()).toBe(403);
  expect((await request.post('/__homefit/update', { headers: { 'x-homefit-update': '1', origin: 'https://evil.example' } })).status()).toBe(403);
  const health = await request.get('/__homefit/update');
  expect(typeof (await health.json()).boot).toBe('number');
});

test('이미 최신이면 알려 주고 버튼이 다시 눌린다', async ({ page }) => {
  await page.route(PATH, (route) =>
    route.request().method() === 'POST' ? route.fulfill({ json: { status: 'up-to-date', head: 'abc1234', boot: 1 } }) : route.fallback(),
  );
  const button = page.getByRole('button', { name: '업데이트', exact: true });
  await button.click();
  await expect(page.getByTestId('banner')).toHaveText(/이미 최신 코드입니다 \(abc1234\)/);
  await expect(button).toBeEnabled();
});

test('변경이 있으면 거부 사유를 보여 준다', async ({ page }) => {
  await page.route(PATH, (route) => route.fulfill({ json: { status: 'dirty' } }));
  await page.getByRole('button', { name: '업데이트', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('커밋하지 않은 코드 변경');
});

test('새 코드를 받으면 서버 재시작을 기다렸다가 새로고침하고, 편집한 평면은 남는다', async ({ page }) => {
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' }).click();
  const count = () => page.evaluate(() => window.__homefit!.store.getState().plan.layouts[0].items.length);
  const before = await count();

  let polls = 0;
  await page.route(PATH, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ json: { status: 'updated', from: 'aaaaaaa', to: 'bbbbbbb', commits: 2, depsInstalled: false, boot: 1 } });
    }
    polls += 1;
    return polls < 2 ? route.abort() : route.fulfill({ json: { boot: 2 } });
  });
  await page.getByRole('button', { name: '업데이트', exact: true }).click();
  await expect(page.getByTestId('banner')).toContainText('aaaaaaa → bbbbbbb, 커밋 2개');
  await expect(page.getByRole('button', { name: '업데이트 중…' })).toBeDisabled();

  await page.waitForEvent('load');
  await expect(page.getByRole('button', { name: '업데이트', exact: true })).toBeEnabled();
  expect(await count()).toBe(before);
});
