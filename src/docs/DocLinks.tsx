import docLinksRaw from 'virtual:doc-links';
import { docLinksFor, parseDocLinks } from './links';
import type { Mode } from '../ui/uiStore';
import './DocLinks.css';

const LINKS = parseDocLinks(docLinksRaw);

export function DocLinks({ mode }: { mode: Mode }) {
  const links = docLinksFor(LINKS, mode);
  if (links.length === 0) return null;
  return (
    <nav className="doc-links" aria-label="참고 문서">
      <span className="doc-links-title">참고 문서</span>
      {links.map((l) => (
        <a key={l.url} className="doc-link" href={l.url} target="_blank" rel="noreferrer noopener">
          <span className="doc-link-label">{l.label}</span>
          {l.note && <span className="doc-link-note">{l.note}</span>}
          <span className="doc-link-arrow" aria-hidden="true">↗</span>
        </a>
      ))}
    </nav>
  );
}
