import { DEDICATED_RADIUS_CM, fixtureSummary, missingDedicatedCircuit } from '../electrical/fixtures';
import { wallReferenceText } from '../geometry/wallReference';
import { activeItems } from '../model/layout';
import type { ChecklistState, Plan, Product } from '../model/schema';
import { conflictLines } from '../validation/describe';
import { validatePlan, type ItemStatus } from '../validation/validate';
import { DEFAULT_CHECKLIST, PHASES, type ChecklistItem } from './defaults';

type Resolve = (productId: string) => Product | undefined;

export function autoChecklist(plan: Plan, resolve: Resolve, status: Record<string, ItemStatus>): ChecklistItem[] {
  const placed = activeItems(plan).flatMap((item) => {
    const product = resolve(item.productId);
    return product ? [{ item, product }] : [];
  });
  const out: ChecklistItem[] = [];

  const dedicated = placed.filter((p) => p.product.power?.dedicatedCircuit);
  if (dedicated.length > 0) {
    const missing = new Set(missingDedicatedCircuit(plan, resolve));
    const missingNames = dedicated.filter((p) => missing.has(p.item.id)).map((p) => p.product.name);
    const warn = missingNames.length > 0 ? ` (${DEDICATED_RADIUS_CM}cm 이내 전용회로 콘센트 없음: ${missingNames.join(', ')})` : '';
    out.push({ id: 'auto-circuit', phase: 'carpentry', auto: true, text: `전용회로 확인: ${dedicated.map((p) => p.product.name).join(', ')}${warn}` });
  }

  if (plan.fixtures.length > 0) {
    out.push({ id: 'auto-outlets', phase: 'carpentry', auto: true, text: `콘센트 위치 공유: ${fixtureSummary(plan.fixtures)} — 전기 계획도 참고` });
  }

  for (const { item, product } of placed) {
    if (!product.builtIn) continue;
    const { w, d, h } = product.dims;
    out.push({
      id: `auto-builtin-${item.id}`,
      phase: product.category === 'kitchen' ? 'kitchen' : 'carpentry',
      auto: true,
      text: `빌트인 치수 전달: ${product.name} ${w}×${d}×${h}cm, ${wallReferenceText(plan, item, product)}`,
    });
  }

  for (const { item, product } of placed) {
    const st = status[item.id];
    if (!st || !(st.clearanceBlocked || st.blocksDoor)) continue;
    const lines = conflictLines(st, plan).filter((line) => !line.startsWith('충돌'));
    out.push({ id: `auto-door-${item.id}`, phase: 'carpentry', auto: true, text: `문 열림 간섭 해결: ${product.name} — ${lines.join(' / ')}` });
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
