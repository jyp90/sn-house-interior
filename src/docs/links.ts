import type { Mode } from '../ui/uiStore';

// 탭별 참고 문서 링크. 공유 키가 든 URL이라 private/doc-links.local.json에만 두고 로컬 dev에서만 들어온다(스펙 §15.4).
// Pages 등 다른 환경에서는 브라우저 localStorage에 저장한 목록을 쓴다(스펙 §43) — Plan JSON·번들·내보내기에는 절대 들어가지 않는다
type DocLink = { mode: Mode; label: string; url: string; note?: string };

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

export const DOC_LINKS_KEY = 'homefit:doc-links:v1';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const storage = (): StorageLike | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null; // 사생활 보호 모드 등에서 접근 자체가 throw
  }
};

export function readStoredDocLinks(st: StorageLike | null = storage()): DocLink[] {
  try {
    const raw = st?.getItem(DOC_LINKS_KEY);
    return raw ? parseDocLinks(JSON.parse(raw)) : [];
  } catch {
    return []; // 저장소 접근 불가나 손상된 JSON은 "저장된 링크 없음"과 같게 본다
  }
}

type SaveResult = { ok: true; links: DocLink[] } | { ok: false; error: string };

// 사용자가 붙여 넣은 JSON 문자열을 검증해 저장한다. 유효 항목만 남긴 정규화된 목록을 저장한다
export function writeStoredDocLinks(text: string, st: StorageLike | null = storage()): SaveResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON 형식이 아닙니다.' };
  }
  const links = parseDocLinks(parsed);
  if (links.length === 0) return { ok: false, error: '저장할 링크가 없습니다(mode·label·https URL 확인).' };
  try {
    st?.setItem(DOC_LINKS_KEY, JSON.stringify(links));
  } catch {
    return { ok: false, error: '브라우저 저장소에 쓸 수 없습니다.' };
  }
  notify();
  return { ok: true, links };
}

export function clearStoredDocLinks(st: StorageLike | null = storage()): void {
  try {
    st?.removeItem(DOC_LINKS_KEY);
  } catch {
    // 저장소 접근 불가: 지울 것도 없다
  }
  notify();
}

// 저장된 목록이 있으면 그것, 없으면 dev 전용 virtual 목록
export function effectiveDocLinks(virtual: DocLink[], stored: DocLink[] = readStoredDocLinks()): { links: DocLink[]; stored: boolean } {
  return stored.length > 0 ? { links: stored, stored: true } : { links: virtual, stored: false };
}

// useSyncExternalStore용: 저장/지우기마다 구독자에게 알리고, 스냅샷은 저장소 문자열(참조 안정)로 둔다
const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}
export const docLinksStore = {
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot(): string | null {
    try {
      return storage()?.getItem(DOC_LINKS_KEY) ?? null;
    } catch {
      return null; // 저장소 접근 불가 = 저장된 링크 없음
    }
  },
};
