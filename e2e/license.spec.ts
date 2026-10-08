import { expect, test } from '@playwright/test';

test('툴바의 글꼴 라이선스 링크가 OFL 전문을 새 탭으로 연다', async ({ page, request }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: '글꼴 라이선스' });
  await expect(link).toHaveAttribute('href', '/licenses/Pretendard-OFL.txt');
  await expect(link).toHaveAttribute('target', '_blank');
  const res = await request.get('/licenses/Pretendard-OFL.txt');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('SIL Open Font License, Version 1.1');
});
