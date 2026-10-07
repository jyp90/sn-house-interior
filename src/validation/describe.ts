import { findProduct } from '../catalog/products';
import { activeItems } from '../model/layout';
import type { Plan } from '../model/schema';
import type { Conflict, ItemStatus } from './validate';

const TYPE_LABEL: Record<Conflict['type'], string> = {
  collides: '충돌',
  clearance: '문 열림 공간 부족',
  blocksDoor: '방문 열림 간섭',
};

function targetName(plan: Plan, c: Conflict): string {
  if (c.target.kind === 'wall') return '벽';
  if (c.target.kind === 'door') return '문';
  const item = activeItems(plan).find((i) => i.id === c.target.id);
  return (item && findProduct(plan, item.productId)?.name) || '알 수 없는 제품';
}

export function conflictLines(status: ItemStatus, plan: Plan): string[] {
  return (Object.keys(TYPE_LABEL) as Conflict['type'][]).flatMap((type) => {
    const names = [...new Set(status.conflicts.filter((c) => c.type === type).map((c) => targetName(plan, c)))];
    return names.length ? [`${TYPE_LABEL[type]}: ${names.join(', ')}`] : [];
  });
}
