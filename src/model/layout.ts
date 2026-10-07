import type { Item, Plan } from './schema';

// 배치안(A/B)을 도입하기 전까지 아이템 목록은 이 두 함수로만 읽고 쓴다(스펙 §14.4)
export function activeItems(plan: Plan): Item[] {
  return plan.items;
}

export function withActiveItems(plan: Plan, items: Item[]): Plan {
  return { ...plan, items };
}
