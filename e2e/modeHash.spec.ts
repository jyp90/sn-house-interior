import { expect, test } from '@playwright/test';

test('페이지 타이틀과 탭 hash: 탭을 누르고 새로고침해도 같은 탭에 머문다', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('우리집 인테리어 by 송뇽');
  await expect(page).toHaveURL(/#place$/);

  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  await expect(page).toHaveURL(/#checklist$/);
  await page.reload();
  await expect(page.getByRole('button', { name: '체크리스트', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // 주소창에 직접 hash를 넣어도 해당 탭으로 열린다
  await page.goto('/#structure');
  await expect(page.getByRole('button', { name: '구조', exact: true })).toHaveAttribute('aria-pressed', 'true');

  // 알 수 없는 hash는 기본 탭(배치)으로
  await page.goto('/#nope');
  await page.reload();
  await expect(page.getByRole('button', { name: '배치', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/#place$/);
});
