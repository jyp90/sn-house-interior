import { useEffect, useMemo, useState } from 'react';
import { findProduct } from '../catalog/products';
import { PHASES, type ChecklistItem } from '../checklist/defaults';
import { checklistEntry, checklistItems } from '../checklist/items';
import { activeLayout } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';

type Filter = 'all' | 'open' | 'done';

const FILTERS: [Filter, string][] = [
  ['all', '전체'],
  ['open', '남은 항목'],
  ['done', '완료'],
];

const percent = (done: number, total: number) => (total === 0 ? 0 : Math.round((done / total) * 100));

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="cl-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <div className="cl-bar-fill" style={{ width: `${percent(done, total)}%` }} />
    </div>
  );
}

function MemoField({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  if (!value && !open) {
    return (
      <button type="button" className="cl-memo-add" onClick={() => setOpen(true)}>
        + 메모
      </button>
    );
  }
  const commit = () => {
    const v = text.trim();
    if (v !== value) onCommit(v);
    setText(value);
    setOpen(false);
  };
  return (
    <input
      className="cl-memo"
      aria-label="메모"
      placeholder="메모"
      autoFocus={open && !value}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setText(value);
          setOpen(false);
        }
      }}
    />
  );
}

export function ChecklistView() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const [filter, setFilter] = useState<Filter>('all');
  const items = useMemo(() => checklistItems(plan, (id) => findProduct(plan, id)), [plan]);
  const s = store.getState();
  const isDone = (id: string) => !!checklistEntry(plan, id)?.checked;
  const done = items.filter((i) => isDone(i.id)).length;
  const shown = (i: ChecklistItem) => filter === 'all' || (filter === 'done') === isDone(i.id);

  const phases = PHASES.map((phase) => {
    const all = items.filter((i) => i.phase === phase.id);
    return { ...phase, all, done: all.filter((i) => isDone(i.id)).length, list: all.filter(shown) };
  }).filter((p) => p.all.length > 0);

  return (
    <div className="checklist" data-testid="checklist">
      <header className="cl-head">
        <div className="cl-head-row">
          <div>
            <h2>공사 체크리스트</h2>
            <p className="muted">자동 항목은 현재 배치안({activeLayout(plan).name})과 전기 계획에서 만들어집니다.</p>
          </div>
          <div className="cl-total">
            <strong>{percent(done, items.length)}%</strong>
            <span className="muted">
              {done} / {items.length} 완료
            </span>
          </div>
        </div>
        <Progress done={done} total={items.length} />
        <div className="cl-filters" role="group" aria-label="보기">
          {FILTERS.map(([f, label]) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="cl-body">
        <nav className="cl-nav" aria-label="공정">
          {phases.map((p) => (
            <a
              key={p.id}
              href={`#cl-${p.id}`}
              className={p.done === p.all.length ? 'cl-nav-item complete' : 'cl-nav-item'}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(`cl-${p.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              <span className="cl-nav-label">{p.label}</span>
              <span className="cl-nav-count">
                {p.done}/{p.all.length}
              </span>
              <Progress done={p.done} total={p.all.length} />
            </a>
          ))}
        </nav>

        <div className="cl-sections">
          {phases.every((p) => p.list.length === 0) && (
            <p className="cl-empty">{filter === 'done' ? '아직 완료한 항목이 없습니다.' : '남은 항목이 없습니다. 모두 완료했습니다.'}</p>
          )}
          {phases
            .filter((p) => p.list.length > 0)
            .map((p) => (
              <section key={p.id} id={`cl-${p.id}`} className="cl-section">
                <h3>
                  {p.label}
                  <span className={p.done === p.all.length ? 'cl-pill complete' : 'cl-pill'}>
                    {p.done === p.all.length ? '완료' : `${p.done}/${p.all.length}`}
                  </span>
                </h3>
                <ul className="cl-items">
                  {p.list.map((i) => {
                    const entry = checklistEntry(plan, i.id);
                    const checked = !!entry?.checked;
                    return (
                      <li key={i.id} className={checked ? 'cl-item done' : 'cl-item'} data-testid={`checklist-${i.id}`}>
                        <label className="cl-check">
                          <input type="checkbox" checked={checked} onChange={(e) => s.setChecklistEntry(i.id, { checked: e.target.checked })} />
                          <span className="cl-text">
                            {i.auto && <span className="badge auto">자동</span>}
                            {i.text}
                          </span>
                        </label>
                        <MemoField
                          key={`${i.id}-memo`}
                          value={entry?.memo ?? ''}
                          onCommit={(v) => s.setChecklistEntry(i.id, { memo: v })}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
        </div>
      </div>
    </div>
  );
}
