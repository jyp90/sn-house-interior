import { activeLayout } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { TextField } from './fields';
import { useUi } from './uiStore';

export function LayoutBar() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const compareId = useUi((s) => s.compareLayoutId);
  const ui = useUi.getState();
  const s = store.getState();
  const active = activeLayout(plan);
  const others = plan.layouts.filter((l) => l.id !== active.id);
  const compare = others.find((l) => l.id === compareId) ?? null;

  const swap = () => {
    if (!compare) return;
    const previous = active.id;
    s.switchLayout(compare.id);
    ui.setCompareLayout(previous);
  };

  return (
    <section className="layout-bar" data-testid="layout-bar">
      <h3>배치안</h3>
      <div className="segmented layout-tabs" role="group" aria-label="배치안">
        {plan.layouts.map((l) => (
          <button key={l.id} type="button" aria-pressed={l.id === active.id} onClick={() => s.switchLayout(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" onClick={() => s.addLayout()}>복제</button>
        <button type="button" className="danger" disabled={plan.layouts.length <= 1} onClick={() => s.removeLayout(active.id)}>삭제</button>
      </div>
      <TextField key={`${active.id}-name`} label="이름" value={active.name} onCommit={(v) => s.renameLayout(active.id, v)} />
      <TextField key={`${active.id}-memo`} label="메모" value={active.memo ?? ''} allowEmpty onCommit={(v) => s.setLayoutMemo(active.id, v)} />
      <label className="field">
        겹쳐 볼 배치안
        <select value={compare?.id ?? ''} onChange={(e) => ui.setCompareLayout(e.target.value || null)}>
          <option value="">없음</option>
          {others.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>
      <button type="button" disabled={!compare} onClick={swap}>비교 대상과 전환</button>
    </section>
  );
}
