import { useEffect } from 'react';
import { findProduct } from '../catalog/products';
import { activeItems } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from './uiStore';

export function CandidatePicker() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const candidates = useUi((s) => s.candidates);
  const items = activeItems(plan);
  const present = candidates ? candidates.ids.filter((id) => items.some((i) => i.id === id)) : [];

  // 후보 목록에 있던 물체가 지워져 1개 이하만 남으면 목록을 닫는다
  useEffect(() => {
    if (candidates && present.length < 2) useUi.getState().clearCandidates();
  });

  if (!candidates || present.length < 2) return null;

  const left = Math.max(8, Math.min(candidates.clientX + 8, window.innerWidth - 240));
  const top = Math.max(8, Math.min(candidates.clientY + 8, window.innerHeight - 48 - 36 * present.length));

  return (
    <div className="candidates" role="menu" aria-label="겹친 물체 선택" data-testid="candidates" style={{ left, top }}>
      <p className="muted">겹친 물체 {present.length}개</p>
      {present.map((id) => {
        const item = items.find((i) => i.id === id)!;
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
