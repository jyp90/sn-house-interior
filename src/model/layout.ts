import type { Item, Layout, Plan } from './schema';

export const DEFAULT_LAYOUT_ID = 'layout-a';

// 아이템 목록은 이 함수들로만 읽고 쓴다(스펙 §14.4). 구조는 모든 배치안이 공유한다
export function activeLayout(plan: Plan): Layout {
  return plan.layouts.find((l) => l.id === plan.activeLayoutId) ?? plan.layouts[0];
}

export function activeItems(plan: Plan): Item[] {
  return activeLayout(plan).items;
}

export function withActiveItems(plan: Plan, items: Item[]): Plan {
  const id = activeLayout(plan).id;
  return { ...plan, layouts: plan.layouts.map((l) => (l.id === id ? { ...l, items } : l)) };
}
