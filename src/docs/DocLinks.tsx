import { useId, useState, useSyncExternalStore } from 'react';
import docLinksRaw from 'virtual:doc-links';
import { clearStoredDocLinks, docLinksFor, docLinksStore, effectiveDocLinks, parseDocLinks, readStoredDocLinks, writeStoredDocLinks } from './links';
import type { Mode } from '../ui/uiStore';
import './DocLinks.css';

const VIRTUAL = parseDocLinks(docLinksRaw);
const FORMAT_HINT = '형식: [{ "mode": "checklist" | "export", "label": "이름", "url": "https://…", "note": "메모(선택)" }] — 이 브라우저에만 저장됩니다.';

export function DocLinks({ mode, editable = false }: { mode: Mode; editable?: boolean }) {
  useSyncExternalStore(docLinksStore.subscribe, docLinksStore.getSnapshot, () => null);
  const { links: all, stored } = effectiveDocLinks(VIRTUAL, readStoredDocLinks());
  const links = docLinksFor(all, mode);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  if (links.length === 0 && !editable) return null;

  const openForm = () => {
    setText(JSON.stringify(all, null, 2));
    setError(null);
    setOpen(true);
  };
  const save = () => {
    const r = writeStoredDocLinks(text);
    if (r.ok) {
      setOpen(false);
      setError(null);
    } else setError(r.error);
  };
  const clear = () => {
    clearStoredDocLinks();
    setOpen(false);
    setError(null);
  };

  return (
    <div className="doc-links-wrap" data-testid={`doc-links-${mode}`}>
      <nav className="doc-links" aria-label="참고 문서">
        <span className="doc-links-title">{links.length === 0 ? '참고 문서 링크 없음' : '참고 문서'}</span>
        {links.map((l) => (
          <a key={l.url} className="doc-link" href={l.url} target="_blank" rel="noreferrer noopener">
            <span className="doc-link-label">{l.label}</span>
            {l.note && <span className="doc-link-note">{l.note}</span>}
            <span className="doc-link-arrow" aria-hidden="true">↗</span>
          </a>
        ))}
        {editable && (
          <button type="button" className="doc-links-edit" aria-expanded={open} aria-controls={formId} onClick={() => (open ? setOpen(false) : openForm())}>
            {stored ? '링크 편집' : '링크 설정'}
          </button>
        )}
      </nav>
      {editable && open && (
        <div className="doc-links-form" id={formId}>
          <textarea aria-label="참고 문서 링크 JSON" rows={6} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
          <p className="muted">{FORMAT_HINT}</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="doc-links-actions">
            <button type="button" onClick={save}>
              저장
            </button>
            <button type="button" onClick={clear} disabled={!stored}>
              지우기
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
