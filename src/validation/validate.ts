import { itemClearances, doorSwings } from '../geometry/clearance';
import { itemObb, obbOverlap, type OBB } from '../geometry/obb';
import { planWallObbs } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Plan, Product } from '../model/schema';

export type ItemStatus = { collides: boolean; clearanceBlocked: boolean; blocksDoor: boolean };

const OK: ItemStatus = { collides: false, clearanceBlocked: false, blocksDoor: false };

export function validatePlan(plan: Plan, resolve: (productId: string) => Product | undefined): Record<string, ItemStatus> {
  const walls = planWallObbs(plan);
  const doors = doorSwings(plan).map((s) => s.obb);
  const placed = activeItems(plan).flatMap((item) => {
    const product = resolve(item.productId);
    if (!product) return [];
    return [{ item, product, fp: itemObb(item.x, item.y, item.rotation, product.dims.w, product.dims.d) }];
  });
  const floor = placed.filter((p) => p.product.mount === 'floor');
  const hitsAny = (shape: OBB, others: OBB[]) => others.some((o) => obbOverlap(shape, o));

  const result: Record<string, ItemStatus> = {};
  for (const item of activeItems(plan)) result[item.id] = OK;
  for (const p of placed) {
    if (p.product.mount === 'wall') {
      result[p.item.id] = { ...OK, collides: hitsAny(p.fp, walls) };
      continue;
    }
    const others = floor.filter((o) => o.item.id !== p.item.id).map((o) => o.fp);
    const clearances = itemClearances(p.item, p.product).map((c) => c.obb);
    result[p.item.id] = {
      collides: hitsAny(p.fp, walls) || hitsAny(p.fp, others),
      clearanceBlocked: clearances.some((c) => hitsAny(c, walls) || hitsAny(c, others)),
      blocksDoor: hitsAny(p.fp, doors),
    };
  }
  return result;
}
