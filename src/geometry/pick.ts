import { activeItems } from '../model/layout';
import type { Plan, Product, Vec2 } from '../model/schema';
import { axes, itemObb, type OBB } from './obb';

export function pointInObb(o: OBB, p: Vec2): boolean {
  const [u, v] = axes(o);
  const dx = p.x - o.cx;
  const dy = p.y - o.cy;
  return Math.abs(dx * u.x + dy * u.y) <= o.hw && Math.abs(dx * v.x + dy * v.y) <= o.hd;
}

export function itemsAtPoint(plan: Plan, p: Vec2, resolve: (productId: string) => Product | undefined): string[] {
  return activeItems(plan)
    .filter((item) => {
      const dims = resolve(item.productId)?.dims ?? { w: 50, d: 50 };
      return pointInObb(itemObb(item.x, item.y, item.rotation, dims.w, dims.d), p);
    })
    .map((item) => item.id)
    .reverse();
}
