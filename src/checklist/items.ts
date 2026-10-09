import { ceilingHeightCm, itemElevationCm } from '../catalog/elevation';
import { DEDICATED_RADIUS_CM, fixtureSummary, missingDedicatedCircuit, switchGroups } from '../electrical/fixtures';
import { wallReferenceText } from '../geometry/wallReference';
import { activeItems } from '../model/layout';
import type { ChecklistState, Plan, Product } from '../model/schema';
import { conflictLines } from '../validation/describe';
import { validatePlan, type ItemStatus } from '../validation/validate';
import { DEFAULT_CHECKLIST, PHASES, type ChecklistItem } from './defaults';
import { shortHash } from './hash';

type Resolve = (productId: string) => Product | undefined;

export function autoChecklist(plan: Plan, resolve: Resolve, status: Record<string, ItemStatus>): ChecklistItem[] {
  const placed = activeItems(plan).flatMap((item) => {
    const product = resolve(item.productId);
    return product ? [{ item, product }] : [];
  });
  const out: ChecklistItem[] = [];
  const ceiling = ceilingHeightCm(plan);

  const dedicated = placed.filter((p) => p.product.power?.dedicatedCircuit);
  if (dedicated.length > 0) {
    const missing = new Set(missingDedicatedCircuit(plan, resolve));
    const missingNames = dedicated.filter((p) => missing.has(p.item.id)).map((p) => p.product.name);
    const warn = missingNames.length > 0 ? ` (${DEDICATED_RADIUS_CM}cm 이내 전용회로 콘센트 없음: ${missingNames.join(', ')})` : '';
    const text = `전용회로 확인: ${dedicated.map((p) => p.product.name).join(', ')}${warn}`;
    // 문구 전체 해시: 내용이 바뀌면 이전 체크가 새 항목에 따라오지 않는다(spec §22)
    out.push({ id: `auto-circuit-${shortHash(text)}`, phase: 'carpentry', auto: true, text });
  }

  if (plan.fixtures.length > 0) {
    out.push({ id: 'auto-outlets', phase: 'carpentry', auto: true, text: `콘센트 위치 공유: ${fixtureSummary(plan.fixtures)} — 전기 계획도·전기 설비 목록 참고` });
  }

  const groups = switchGroups(plan.fixtures);
  if (groups.length > 0) {
    const count = (label: string, n: number) => (n > 0 ? `${label} ${n}` : `${label} 없음`);
    const text = `스위치 회로 전달: ${groups.map((g) => `${g.name}(${count('스위치', g.switches.length)}·${count('조명', g.lights.length)})`).join(', ')}`;
    out.push({ id: `auto-switch-${shortHash(text)}`, phase: 'carpentry', auto: true, text });
  }

  for (const { item, product } of placed) {
    if (!product.builtIn) continue;
    const { w, d, h } = product.dims;
    const e = itemElevationCm(item, product, ceiling);
    const text = `빌트인 치수 전달: ${product.name} ${item.verified ? '' : '≈'}${w}×${d}×${h}cm, ${wallReferenceText(plan, item, product)}${e > 0 ? `, 바닥에서 ${e}cm` : ''}`;
    out.push({
      // 빌트인은 제품·치수·확인 여부만 해시: 옮겨도(벽 기준 거리만 바뀌면) 체크·메모가 유지된다
      id: `auto-builtin-${item.id}-${shortHash(`${product.name} ${w}×${d}×${h} ${item.verified ? '확인' : '미확인'}`)}`,
      phase: product.category === 'kitchen' ? 'kitchen' : 'carpentry',
      auto: true,
      text,
    });
  }

  for (const { item, product } of placed) {
    const st = status[item.id];
    if (!st || !(st.clearanceBlocked || st.blocksDoor)) continue;
    const lines = conflictLines(st, plan).filter((line) => !line.startsWith('충돌'));
    const text = `문 열림 간섭 해결: ${product.name} — ${lines.join(' / ')}`;
    out.push({ id: `auto-door-${item.id}-${shortHash(text)}`, phase: 'carpentry', auto: true, text });
  }

  return out;
}

export function checklistItems(plan: Plan, resolve: Resolve): ChecklistItem[] {
  const all = [...DEFAULT_CHECKLIST, ...autoChecklist(plan, resolve, validatePlan(plan, resolve))];
  return PHASES.flatMap((p) => all.filter((i) => i.phase === p.id));
}

export function checklistEntry(plan: Plan, itemId: string): ChecklistState | undefined {
  return plan.checklist.find((c) => c.itemId === itemId);
}
