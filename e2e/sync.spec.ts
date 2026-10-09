import { expect, test, type Page, type Route } from '@playwright/test';

// GitHub Contents API를 메모리 파일 하나로 흉내 낸다(스펙 §45.3). 버튼·입력·confirm은 실제 흐름 그대로다.
const API = 'https://api.github.com/**';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, accept',
};

type Remote = { content: string; sha: string };
type Put = { body: { message: string; content: string; branch: string; sha?: string }; text: string };

function mockGitHub(remote: Remote) {
  const puts: Put[] = [];
  let n = 0;
  const handler = (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'GET') {
      return route.fulfill({
        status: 200,
        headers: CORS,
        json: { content: Buffer.from(remote.content, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n'), sha: remote.sha, encoding: 'base64' },
      });
    }
    if (req.method() === 'PUT') {
      const body = req.postDataJSON() as Put['body'];
      const text = Buffer.from(body.content, 'base64').toString('utf8');
      remote.content = text;
      n += 1;
      remote.sha = `newsha${n}aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`;
      puts.push({ body, text });
      return route.fulfill({ status: 200, headers: CORS, json: { content: { sha: remote.sha } } });
    }
    return route.fulfill({ status: 500, headers: CORS, json: {} });
  };
  return { puts, handler };
}

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);
const title = async (page: Page) => (await getPlan(page)).info.title;

test('저장 → 원격 변경 불러오기·실행 취소 → sha 충돌 confirm → 새로고침 뒤 설정 유지', async ({ page }) => {
  const remote: Remote = { content: '{}', sha: 'aaaaaaa1111111111111111111111111111111111' };
  const gh = mockGitHub(remote);
  await page.route(API, gh.handler);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  const initial = await getPlan(page);
  remote.content = `${JSON.stringify(initial, null, 2)}\n`;
  expect(initial.info.title).toBe('샘플 평면');

  // 열기 → 토큰 없으면 저장 비활성 → 토큰 입력 → 저장
  const syncButton = page.getByRole('button', { name: '동기화', exact: true });
  await syncButton.click();
  await expect(syncButton).toHaveAttribute('aria-pressed', 'true');
  const panel = page.getByTestId('sync-panel');
  await expect(panel).toBeVisible();
  await expect(page.getByTestId('sync-status')).toHaveText('마지막 동기화 없음');
  const save = panel.getByRole('button', { name: 'GitHub에 저장' });
  await expect(save).toBeDisabled();
  await panel.getByLabel('토큰').fill('github_pat_test');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByTestId('banner')).toContainText('GitHub에 저장했습니다(newsha1)');
  await expect(page.getByTestId('sync-status')).toHaveText(/^마지막 동기화 \d\d:\d\d · newsha1$/);
  expect(gh.puts).toHaveLength(1);
  expect(gh.puts[0].body.branch).toBe('main');
  expect(gh.puts[0].body.sha).toBe('aaaaaaa1111111111111111111111111111111111');
  expect(gh.puts[0].body.message).toMatch(/^chore\(plan\): sync from app \(\d{4}-\d\d-\d\d \d\d:\d\d\)$/);
  expect(gh.puts[0].text).toContain('"title": "샘플 평면"');
  expect(gh.puts[0].text.endsWith('\n')).toBe(true);
  expect(JSON.parse(gh.puts[0].text).info.title).toBe('샘플 평면');

  // 원격 내용을 다른 제목으로 바꾼 뒤 불러오기 → 제목 바뀜 → 실행 취소로 복귀
  remote.content = JSON.stringify({ ...initial, info: { ...initial.info, title: '원격 제목' } });
  remote.sha = 'bbbbbbb2222222222222222222222222222222222';
  await panel.getByRole('button', { name: '불러오기' }).click();
  await expect(page.getByTestId('banner')).toContainText('GitHub에서 평면을 불러왔습니다(bbbbbbb)');
  await expect.poll(() => title(page)).toBe('원격 제목');
  await expect(page.getByTestId('sync-status')).toHaveText(/· bbbbbbb$/);
  await page.getByRole('button', { name: '실행 취소' }).click();
  await expect.poll(() => title(page)).toBe('샘플 평면');

  // 원격 sha가 또 바뀐 상태에서 저장 → confirm 수락 → PUT에 새 sha가 실린다
  remote.sha = 'ccccccc3333333333333333333333333333333333';
  const dialogs: string[] = [];
  page.on('dialog', (d) => {
    dialogs.push(d.message());
    void d.accept();
  });
  await save.click();
  await expect(page.getByTestId('banner')).toContainText('GitHub에 저장했습니다(newsha2)');
  expect(dialogs).toEqual(['GitHub의 평면이 마지막 동기화 이후 바뀌었습니다. 지금 평면으로 덮어쓸까요?']);
  expect(gh.puts).toHaveLength(2);
  expect(gh.puts[1].body.sha).toBe('ccccccc3333333333333333333333333333333333');
  expect(JSON.parse(gh.puts[1].text).info.title).toBe('샘플 평면');

  // 새로고침 후 설정(토큰 제외 표시)과 상태 유지
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await page.getByRole('button', { name: '동기화', exact: true }).click();
  const again = page.getByTestId('sync-panel');
  await expect(again.getByLabel('저장소')).toHaveValue('jyp90/sn-house-interior');
  await expect(again.getByLabel('브랜치')).toHaveValue('main');
  await expect(again.getByLabel('파일')).toHaveValue('home/plan.json');
  await expect(again.getByLabel('토큰')).toHaveAttribute('type', 'password');
  await expect(page.getByTestId('sync-status')).toHaveText(/· newsha2$/);
  // 원격 sha와 같으므로 시작 안내 배너 없음
  await expect(page.getByTestId('banner').filter({ hasText: 'GitHub에 새 평면이 있습니다' })).toHaveCount(0);
});

test('confirm 취소면 PUT을 보내지 않고, 시작 시 원격 sha가 다르면 안내한다', async ({ page }) => {
  const remote: Remote = { content: '{}', sha: 'aaaaaaa1111111111111111111111111111111111' };
  const gh = mockGitHub(remote);
  await page.route(API, gh.handler);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  remote.content = `${JSON.stringify(await getPlan(page), null, 2)}\n`;

  await page.getByRole('button', { name: '동기화', exact: true }).click();
  const panel = page.getByTestId('sync-panel');
  await panel.getByLabel('토큰').fill('github_pat_test');
  await panel.getByRole('button', { name: 'GitHub에 저장' }).click();
  await expect(page.getByTestId('sync-status')).toHaveText(/· newsha1$/);
  expect(gh.puts).toHaveLength(1);

  remote.sha = 'ddddddd4444444444444444444444444444444444';
  page.on('dialog', (d) => void d.dismiss());
  await panel.getByRole('button', { name: 'GitHub에 저장' }).click();
  await expect(panel.getByRole('button', { name: 'GitHub에 저장' })).toBeEnabled();
  expect(gh.puts).toHaveLength(1);
  await expect(page.getByTestId('sync-status')).toHaveText(/· newsha1$/);

  await page.reload();
  await expect(page.getByTestId('banner')).toContainText('GitHub에 새 평면이 있습니다. 「동기화」에서 불러오세요.');
});

test('토큰이 틀리면 오류 배너', async ({ page }) => {
  await page.route(API, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 401, headers: CORS, json: { message: 'Bad credentials' } }),
  );
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: '동기화', exact: true }).click();
  const panel = page.getByTestId('sync-panel');
  await panel.getByLabel('토큰').fill('bad');
  await panel.getByRole('button', { name: 'GitHub에 저장' }).click();
  await expect(page.getByRole('alert')).toContainText('토큰이 없거나 권한이 없습니다');
  await panel.getByRole('button', { name: '닫기', exact: true }).last().click();
  await expect(panel).toBeHidden();
});
