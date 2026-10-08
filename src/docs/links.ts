import type { Mode } from '../ui/uiStore';

// 탭별 참고 문서 링크. 공유 키가 든 URL이라 private/doc-links.local.json에만 두고 로컬 dev에서만 들어온다(스펙 §15.4)
export type DocLink = { mode: Mode; label: string; url: string; note?: string };

const MODES: Mode[] = ['structure', 'place', 'electric', 'checklist', 'export'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

export function parseDocLinks(raw: unknown): DocLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): DocLink[] => {
    if (!isObject(r) || typeof r.label !== 'string' || typeof r.url !== 'string') return [];
    if (!MODES.includes(r.mode as Mode) || !r.url.startsWith('https://')) return [];
    return [{ mode: r.mode as Mode, label: r.label, url: r.url, ...(typeof r.note === 'string' ? { note: r.note } : {}) }];
  });
}

export function docLinksFor(links: DocLink[], mode: Mode): DocLink[] {
  return links.filter((l) => l.mode === mode);
}
