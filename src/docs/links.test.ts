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

import { clearStoredDocLinks, DOC_LINKS_KEY, docLinksStore, effectiveDocLinks, readStoredDocLinks, writeStoredDocLinks } from './links';

function memStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

describe('docLinks 브라우저 저장 (spec §43)', () => {
  it('JSON 문자열을 검증해 정규화된 목록만 저장하고 다시 읽는다', () => {
    const st = memStorage();
    const r = writeStoredDocLinks(JSON.stringify([...raw, { mode: 'export', label: 'bad', url: 'http://x' }]), st);
    expect(r).toEqual({ ok: true, links: parseDocLinks(raw) });
    expect(JSON.parse(st.m.get(DOC_LINKS_KEY)!)).toHaveLength(2);
    expect(readStoredDocLinks(st)).toEqual(parseDocLinks(raw));
  });

  it('깨진 JSON·유효 항목 0개는 오류 문구와 함께 저장하지 않는다', () => {
    const st = memStorage();
    expect(writeStoredDocLinks('{nope', st)).toEqual({ ok: false, error: 'JSON 형식이 아닙니다.' });
    expect(writeStoredDocLinks('[]', st)).toEqual({ ok: false, error: '저장할 링크가 없습니다(mode·label·https URL 확인).' });
    expect(writeStoredDocLinks('[{"mode":"export","label":"x","url":"http://plain"}]', st).ok).toBe(false);
    expect(st.m.size).toBe(0);
  });

  it('저장소 값이 깨져 있으면 빈 목록, 지우면 다시 빈 목록', () => {
    const st = memStorage();
    st.setItem(DOC_LINKS_KEY, 'garbage');
    expect(readStoredDocLinks(st)).toEqual([]);
    writeStoredDocLinks(JSON.stringify(raw), st);
    clearStoredDocLinks(st);
    expect(readStoredDocLinks(st)).toEqual([]);
    expect(readStoredDocLinks(null)).toEqual([]);
  });

  it('저장된 목록이 있으면 virtual(dev) 목록보다 우선한다', () => {
    const virtual = parseDocLinks([{ mode: 'checklist', label: 'dev', url: 'https://dev' }]);
    expect(effectiveDocLinks(virtual, [])).toEqual({ links: virtual, stored: false });
    expect(effectiveDocLinks(virtual, parseDocLinks(raw))).toEqual({ links: parseDocLinks(raw), stored: true });
  });

  it('저장·지우기마다 구독자에게 알린다', () => {
    const st = memStorage();
    let n = 0;
    const off = docLinksStore.subscribe(() => n++);
    writeStoredDocLinks(JSON.stringify(raw), st);
    clearStoredDocLinks(st);
    off();
    clearStoredDocLinks(st);
    expect(n).toBe(2);
  });
});
