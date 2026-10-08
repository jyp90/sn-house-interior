import { describe, expect, it } from 'vitest';
import { docLinksFor, parseDocLinks } from './links';

const raw = [
  { mode: 'export', label: '견적 요청서', url: 'https://claude.ai/artifact/a', note: '업체 공유용' },
  { mode: 'checklist', label: '상담 체크리스트', url: 'https://claude.ai/artifact/b' },
];

describe('docLinks', () => {
  it('탭(모드)별로 문서 링크를 고른다', () => {
    const links = parseDocLinks(raw);
    expect(docLinksFor(links, 'export').map((l) => l.label)).toEqual(['견적 요청서']);
    expect(docLinksFor(links, 'checklist').map((l) => l.label)).toEqual(['상담 체크리스트']);
    expect(docLinksFor(links, 'structure')).toEqual([]);
  });

  it('형식이 틀리거나 https가 아닌 항목은 버린다', () => {
    expect(parseDocLinks(null)).toEqual([]);
    expect(parseDocLinks([{ mode: 'export', label: 'x', url: 'javascript:alert(1)' }, { mode: 'nope', label: 'y', url: 'https://a' }, ...raw])).toHaveLength(2);
  });
});
