import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { DEDICATED_RADIUS_CM, FIXTURE_KINDS, FIXTURE_LABEL, fixtureSummary, missingDedicatedCircuit, switchGroups } from '../electrical/fixtures';
import { activeItems, activeLayout } from '../model/layout';
import { usePlan } from '../model/StoreContext';
import { useUi } from './uiStore';

export function ElectricPanel() {
  const plan = usePlan((s) => s.plan);
  const tool = useUi((s) => s.tool);
  const fixtureKind = useUi((s) => s.fixtureKind);
  const ui = useUi.getState();
  const missing = useMemo(() => new Set(missingDedicatedCircuit(plan, (id) => findProduct(plan, id))), [plan]);
  const groups = useMemo(() => switchGroups(plan.fixtures), [plan.fixtures]);
  const needs = activeItems(plan).flatMap((item) => {
    const product = findProduct(plan, item.productId);
    return product?.power?.dedicatedCircuit ? [{ item, product }] : [];
  });

  return (
    <div className="electric">
      <h3>도구</h3>
      <div className="tool-grid">
        <button type="button" aria-pressed={tool === 'select'} onClick={() => ui.setTool('select')}>선택</button>
        {FIXTURE_KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={tool === 'fixture' && fixtureKind === k} onClick={() => ui.setFixtureTool(k)}>
            {FIXTURE_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="muted">벽 가까이(30cm 이내)를 클릭하면 벽면에 붙습니다. 조명은 벽에 붙지 않습니다. 스냅을 끄면 클릭한 자리에 놓입니다. Esc로 선택 도구로 돌아갑니다.</p>
      <h3>배치된 전기 설비</h3>
      <p className="muted">{plan.fixtures.length > 0 ? fixtureSummary(plan.fixtures) : '아직 없습니다.'}</p>
      <h3>스위치 그룹</h3>
      {groups.length === 0 ? (
        <p className="muted">스위치·조명을 선택해 「스위치 그룹」 이름을 같게 적으면 묶입니다.</p>
      ) : (
        <ul className="switch-groups" data-testid="switch-groups">
          {groups.map((g) => {
            const lack = g.lights.length === 0 ? ' · 조명 없음' : g.switches.length === 0 ? ' · 스위치 없음' : '';
            return (
              <li key={g.name} className={lack ? 'warn' : undefined}>
                {g.name} — 스위치 {g.switches.length} · 조명 {g.lights.length}
                {lack}
              </li>
            );
          })}
        </ul>
      )}
      <h3>전용회로가 필요한 가전 ({activeLayout(plan).name})</h3>
      {needs.length === 0 ? (
        <p className="muted">없습니다.</p>
      ) : (
        <ul className="circuit-list" data-testid="circuit-list">
          {needs.map(({ item, product }) => (
            <li key={item.id} className={missing.has(item.id) ? 'error' : undefined}>
              {product.name} — {missing.has(item.id) ? `${DEDICATED_RADIUS_CM}cm 이내 전용회로 콘센트 없음` : '전용회로 콘센트 있음'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
