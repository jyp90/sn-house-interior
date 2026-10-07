import { findProduct } from '../catalog/products';
import { activeItems } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from './uiStore';

export function CandidatePicker() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const candidates = useUi((s) => s.candidates);
  if (!candidates) return null;
  const items = activeItems(plan);
  return (
    <div className="candidates" role="menu" aria-label="겹친 물체 선택" data-testid="candidates" style={{ left: candidates.clientX + 8, top: candidates.clientY + 8 }}>
      <p className="muted">겹친 물체 {candidates.ids.length}개</p>
      {candidates.ids.map((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return null;
        return (
          <button
            key={id}
            type="button"
            role="menuitem"
            onClick={() => {
              store.getState().select(id);
              useUi.getState().clearCandidates();
            }}
          >
            {findProduct(plan, item.productId)?.name ?? '알 수 없는 제품'}
            {item.locked ? ' (잠금)' : ''}
          </button>
        );
      })}
    </div>
  );
}
