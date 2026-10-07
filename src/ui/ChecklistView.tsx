import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { PHASES } from '../checklist/defaults';
import { checklistEntry, checklistItems } from '../checklist/items';
import { activeLayout } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { TextField } from './fields';

export function ChecklistView() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const items = useMemo(() => checklistItems(plan, (id) => findProduct(plan, id)), [plan]);
  const s = store.getState();
  const isDone = (id: string) => !!checklistEntry(plan, id)?.checked;
  const done = items.filter((i) => isDone(i.id)).length;

  return (
    <div className="checklist" data-testid="checklist">
      <h2>공사 체크리스트</h2>
      <p className="muted">
        전체 {done}/{items.length} 완료 · 자동 항목은 현재 배치안({activeLayout(plan).name})과 전기 계획에서 만들어집니다.
      </p>
      {PHASES.map((phase) => {
        const list = items.filter((i) => i.phase === phase.id);
        return (
          <section key={phase.id}>
            <h3>
              {phase.label} <span className="muted">{list.filter((i) => isDone(i.id)).length}/{list.length}</span>
            </h3>
            <ul className="checklist-items">
              {list.map((i) => {
                const entry = checklistEntry(plan, i.id);
                return (
                  <li key={i.id} data-testid={`checklist-${i.id}`}>
                    <label className="check">
                      <input type="checkbox" checked={!!entry?.checked} onChange={(e) => s.setChecklistEntry(i.id, { checked: e.target.checked })} />
                      {i.auto && <span className="badge auto">자동</span>}
                      <span>{i.text}</span>
                    </label>
                    <TextField key={`${i.id}-memo`} label="메모" value={entry?.memo ?? ''} allowEmpty onCommit={(v) => s.setChecklistEntry(i.id, { memo: v })} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
