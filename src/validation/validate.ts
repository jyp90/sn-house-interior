import { doorSwing, itemClearances } from '../geometry/clearance';
import { itemObb, obbOverlap, type OBB } from '../geometry/obb';
import { planWallObbsWithIds } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Plan, Product } from '../model/schema';

export type ConflictTarget = { kind: 'item' | 'wall' | 'door'; id: string };
export type Conflict = { type: 'collides' | 'clearance' | 'blocksDoor'; target: ConflictTarget };
export type ItemStatus = { collides: boolean; clearanceBlocked: boolean; blocksDoor: boolean; conflicts: Conflict[] };

type Obstacle = { target: ConflictTarget; obb: OBB };

function statusOf(conflicts: Conflict[]): ItemStatus {
  return {
    collides: conflicts.some((c) => c.type === 'collides'),
    clearanceBlocked: conflicts.some((c) => c.type === 'clearance'),
    blocksDoor: conflicts.some((c) => c.type === 'blocksDoor'),
    conflicts,
  };
}

export function validatePlan(plan: Plan, resolve: (productId: string) => Product | undefined): Record<string, ItemStatus> {
  const walls: Obstacle[] = planWallObbsWithIds(plan).map(({ wallId, obb }) => ({ target: { kind: 'wall', id: wallId }, obb }));
  const wallById = new Map(plan.walls.map((w) => [w.id, w]));
  const doors: Obstacle[] = plan.openings.flatMap((o) => {
    const w = wallById.get(o.wallId);
    return w && o.kind === 'door' ? [{ target: { kind: 'door' as const, id: o.id }, obb: doorSwing(w, o).obb }] : [];
  });
  const placed = activeItems(plan).flatMap((item) => {
    const product = resolve(item.productId);
    if (!product) return [];
    return [{ item, product, fp: itemObb(item.x, item.y, item.rotation, product.dims.w, product.dims.d) }];
  });
  const floor = placed.filter((p) => p.product.mount === 'floor');

  const result: Record<string, ItemStatus> = {};
  for (const item of activeItems(plan)) result[item.id] = statusOf([]);
  for (const p of placed) {
    const conflicts: Conflict[] = [];
    const seen = new Set<string>();
    const add = (type: Conflict['type'], shape: OBB, obstacles: Obstacle[]) => {
      for (const o of obstacles) {
        const key = `${type}:${o.target.kind}:${o.target.id}`;
        if (seen.has(key) || !obbOverlap(shape, o.obb)) continue;
        seen.add(key);
        conflicts.push({ type, target: o.target });
      }
    };
    if (p.product.mount === 'wall') {
      add('collides', p.fp, walls);
      result[p.item.id] = statusOf(conflicts);
      continue;
    }
    const others: Obstacle[] = floor
      .filter((o) => o.item.id !== p.item.id)
      .map((o) => ({ target: { kind: 'item', id: o.item.id }, obb: o.fp }));
    add('collides', p.fp, walls);
    add('collides', p.fp, others);
    for (const c of itemClearances(p.item, p.product)) {
      add('clearance', c.obb, walls);
      add('clearance', c.obb, others);
    }
    add('blocksDoor', p.fp, doors);
    result[p.item.id] = statusOf(conflicts);
  }
  return result;
}
