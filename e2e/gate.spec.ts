import { expect, test } from '@playwright/test';
import { GATE_MAX_ATTEMPTS, GATE_STATE_KEY, GATE_UNLOCK_KEY } from '../src/persistence/gate';

// 샘플 서버(HOMEFIT_SAMPLE=1)는 프리셋이 없어 잠금이 꺼진다. dev의 ?gate=1로 강제한다(스펙 §42.2)
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

test('잠금이 꺼진 기본 서버에서는 앱이 바로 뜬다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('gate')).toHaveCount(0);
  await expect(page.locator('.toolbar')).toBeVisible();
});

test('0809로 들어가고, 같은 탭에서는 새로고침해도 다시 묻지 않는다', async ({ page }) => {
  await page.goto('/?gate=1');
  await expect(page.getByTestId('gate')).toBeVisible();
  await expect(page.locator('.toolbar')).toHaveCount(0);
  const input = page.getByLabel('비밀번호');
  await input.fill('1234');
  await page.getByRole('button', { name: '들어가기' }).click();
  await expect(page.getByRole('status')).toContainText(`비밀번호가 틀렸습니다. ${GATE_MAX_ATTEMPTS - 1}회 남았습니다.`);
  await input.fill('0809');
  await input.press('Enter');
  await expect(page.getByTestId('gate')).toHaveCount(0);
  await expect(page.locator('.toolbar')).toBeVisible();
  expect(await page.evaluate((k) => sessionStorage.getItem(k), GATE_UNLOCK_KEY)).toBe('1');
  await page.reload();
  await expect(page.getByTestId('gate')).toHaveCount(0);
  await expect(page.locator('.toolbar')).toBeVisible();
});

test('5번 틀리면 1시간 잠기고 새로고침해도 유지되며, 잠금이 지나면 다시 입력할 수 있다', async ({ page }) => {
  await page.goto('/?gate=1');
  const input = page.getByLabel('비밀번호');
  const submit = page.getByRole('button', { name: '들어가기' });
  for (let i = 1; i <= GATE_MAX_ATTEMPTS; i++) {
    await input.fill('0000');
    await submit.click();
    if (i < GATE_MAX_ATTEMPTS) await expect(page.getByRole('status')).toContainText(`${GATE_MAX_ATTEMPTS - i}회 남았습니다.`);
  }
  const status = page.getByRole('status');
  await expect(status).toContainText('60분 뒤 다시 시도할 수 있습니다.');
  await expect(status).toContainText('1시간 동안 잠겼습니다.');
  await expect(input).toBeDisabled();
  await expect(submit).toBeDisabled();

  await page.reload();
  await expect(page.getByRole('status')).toContainText('1시간 동안 잠겼습니다.');
  await expect(page.getByLabel('비밀번호')).toBeDisabled();

  // 잠금 시각을 과거로 돌려 만료시킨다(시계 조작 대신 저장값만 바꾼다). 맞는 PIN으로 들어간다
  await page.evaluate((k) => {
    const s = JSON.parse(localStorage.getItem(k)!);
    s.lockedUntil = Date.now() - 1;
    localStorage.setItem(k, JSON.stringify(s));
  }, GATE_STATE_KEY);
  await page.reload();
  const again = page.getByLabel('비밀번호');
  await expect(again).toBeEnabled();
  await again.fill('0809');
  await again.press('Enter');
  await expect(page.locator('.toolbar')).toBeVisible();
});
