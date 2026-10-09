import { expect, test } from '@playwright/test';

// 참고 문서 링크를 브라우저에 저장해 Pages 등 private/ 없는 환경에서도 보이게 한다 (spec §43)
test('체크리스트 탭에서 링크 JSON을 저장하면 칩이 보이고 새로고침·내보내기 탭에도 남으며, 지우면 사라진다', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await page.getByRole('button', { name: '체크리스트', exact: true }).click();

  const wrap = page.getByTestId('doc-links-checklist');
  await expect(wrap).toContainText('참고 문서 링크 없음');
  await wrap.getByRole('button', { name: '링크 설정' }).click();
  const box = wrap.getByLabel('참고 문서 링크 JSON');
  await box.fill('{nope');
  await wrap.getByRole('button', { name: '저장' }).click();
  await expect(wrap.getByRole('alert')).toHaveText('JSON 형식이 아닙니다.');

  await box.fill(
    JSON.stringify([
      { mode: 'checklist', label: '상담 메모', url: 'https://example.com/a', note: '나만 보기' },
      { mode: 'export', label: '견적 요청서', url: 'https://example.com/b' },
      { mode: 'export', label: '거부됨', url: 'http://example.com/c' },
    ]),
  );
  await wrap.getByRole('button', { name: '저장' }).click();
  await expect(wrap.getByLabel('참고 문서 링크 JSON')).toHaveCount(0);
  const chip = wrap.getByRole('link', { name: /상담 메모/ });
  await expect(chip).toHaveAttribute('href', 'https://example.com/a');
  await expect(chip).toHaveAttribute('target', '_blank');
  await expect(wrap).toContainText('나만 보기');
  await expect(wrap.getByRole('link', { name: /견적 요청서/ })).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  await expect(page.getByTestId('doc-links-checklist').getByRole('link', { name: /상담 메모/ })).toBeVisible();
  await page.getByRole('button', { name: '내보내기', exact: true }).click();
  const exp = page.getByTestId('doc-links-export');
  await expect(exp.getByRole('link', { name: /견적 요청서/ })).toHaveAttribute('href', 'https://example.com/b');
  await expect(exp.getByRole('link', { name: /거부됨/ })).toHaveCount(0);
  await expect(exp.getByRole('button', { name: /링크 (설정|편집)/ })).toHaveCount(0);

  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  await page.getByTestId('doc-links-checklist').getByRole('button', { name: '링크 편집' }).click();
  await page.getByTestId('doc-links-checklist').getByRole('button', { name: '지우기' }).click();
  await expect(page.getByTestId('doc-links-checklist')).toContainText('참고 문서 링크 없음');
  expect(await page.evaluate(() => localStorage.getItem('homefit:doc-links:v1'))).toBeNull();
});
