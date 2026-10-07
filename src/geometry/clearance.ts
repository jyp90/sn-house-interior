import type { Item, Opening, Plan, Product, Vec2, Wall } from '../model/schema';
import { axes, itemObb, localToWorld, type OBB } from './obb';
import { wallDir } from './walls';

export type ClearanceShape =
  | { kind: 'rect'; obb: OBB }
  | { kind: 'sector'; center: Vec2; radius: number; start: number; end: number; obb: OBB };

// hinge에서 closed 방향으로 닫혀 있던 문이 open 방향으로 90° 열린다
function sector(hinge: Vec2, closed: Vec2, open: Vec2, r: number): ClearanceShape {
  // [0, 2π)로 정규화: atan2(-0, -1)은 -π가 된다
  const a = (Math.atan2(closed.y, closed.x) + 2 * Math.PI) % (2 * Math.PI);
  const cross = closed.x * open.y - closed.y * open.x;
  const [start, end] = cross > 0 ? [a, a + Math.PI / 2] : [a - Math.PI / 2, a];
  return {
    kind: 'sector',
    center: hinge,
    radius: r,
    start,
    end,
    obb: {
      cx: hinge.x + (closed.x + open.x) * (r / 2),
      cy: hinge.y + (closed.y + open.y) * (r / 2),
      hw: r / 2,
      hd: r / 2,
      angle: a,
    },
  };
}

export function itemClearances(item: Item, product: Product): ClearanceShape[] {
  const { w, d } = product.dims;
  const fp = itemObb(item.x, item.y, item.rotation, w, d);
  const [u, v] = axes(fp);
  return product.clearances.map((c) => {
    if (c.kind === 'front') {
      const center = localToWorld(fp, 0, d / 2 + c.depth / 2);
      return { kind: 'rect', obb: { cx: center.x, cy: center.y, hw: w / 2, hd: c.depth / 2, angle: fp.angle } };
    }
    if (c.hinge === 'left') return sector(localToWorld(fp, -w / 2, d / 2), u, v, c.radius);
    return sector(localToWorld(fp, w / 2, d / 2), { x: -u.x, y: -u.y }, v, c.radius);
  });
}

export function doorSwing(w: Wall, o: Opening): ClearanceShape {
  const u = wallDir(w);
  const n = o.swingIn ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
  const along = o.hinge === 'start' ? o.offset : o.offset + o.width;
  const hinge = {
    x: w.a.x + u.x * along + n.x * (w.thickness / 2),
    y: w.a.y + u.y * along + n.y * (w.thickness / 2),
  };
  const closed = o.hinge === 'start' ? u : { x: -u.x, y: -u.y };
  return sector(hinge, closed, n, o.width);
}

export function doorSwings(plan: Plan): ClearanceShape[] {
  const walls = new Map(plan.walls.map((w) => [w.id, w]));
  return plan.openings.flatMap((o) => {
    const w = walls.get(o.wallId);
    return w && o.kind === 'door' ? [doorSwing(w, o)] : [];
  });
}
