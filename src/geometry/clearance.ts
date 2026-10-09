import type { Item, Opening, Plan, Product, Vec2, Wall } from '../model/schema';
import { axes, itemObb, localToWorld, type OBB } from './obb';
import { wallDir } from './walls';

export type SectorShape = { kind: 'sector'; center: Vec2; radius: number; start: number; end: number; obb: OBB };
export type ClearanceShape = { kind: 'rect'; obb: OBB } | SectorShape;

// 문짝 하나: hinge에서 closed 방향(벽 면을 따라)으로 닫혀 있고 open 방향으로 90° 열린다
export type DoorLeaf = { hinge: Vec2; closed: Vec2; open: Vec2; width: number; swing: SectorShape };

// hinge에서 closed 방향으로 닫혀 있던 문이 open 방향으로 90° 열린다
function sector(hinge: Vec2, closed: Vec2, open: Vec2, r: number): SectorShape {
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

// 문짝 폭: [경첩(o.hinge) 쪽, 반대쪽]. 외여닫이는 반대쪽이 0
export function leafWidths(o: Opening): [number, number] {
  if (o.leaves === 'double') return [o.width / 2, o.width / 2];
  if (o.leaves === 'asym') {
    const big = Math.round((o.width * 2) / 3);
    return [big, o.width - big];
  }
  return [o.width, 0];
}

// 문짝마다 열림 영역을 따로 계산한다. 모든 문짝은 같은 쪽(swingIn)으로 연다
export function doorLeaves(w: Wall, o: Opening): DoorLeaf[] {
  const u = wallDir(w);
  const n = o.swingIn ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
  const at = (along: number): Vec2 => ({
    x: w.a.x + u.x * along + n.x * (w.thickness / 2),
    y: w.a.y + u.y * along + n.y * (w.thickness / 2),
  });
  const startLeaf = (width: number): DoorLeaf => ({ hinge: at(o.offset), closed: u, open: n, width, swing: sector(at(o.offset), u, n, width) });
  const endLeaf = (width: number): DoorLeaf => {
    const closed = { x: -u.x, y: -u.y };
    return { hinge: at(o.offset + o.width), closed, open: n, width, swing: sector(at(o.offset + o.width), closed, n, width) };
  };
  const [hingeSide, otherSide] = leafWidths(o);
  const leaves = o.hinge === 'start' ? [startLeaf(hingeSide), endLeaf(otherSide)] : [endLeaf(hingeSide), startLeaf(otherSide)];
  return leaves.filter((l) => l.width > 0);
}

export function doorSwings(plan: Plan): ClearanceShape[] {
  const walls = new Map(plan.walls.map((w) => [w.id, w]));
  return plan.openings.flatMap((o) => {
    const w = walls.get(o.wallId);
    return w && o.kind === 'door' ? doorLeaves(w, o).map((l) => l.swing) : [];
  });
}
