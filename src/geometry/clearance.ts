import type { Item, Opening, Plan, Product, Vec2, Wall } from '../model/schema';
import { axes, itemObb, localToWorld, type OBB } from './obb';
import { clampToWall, wallDir, wallLength } from './walls';

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

// 문짝 폭: [경첩(o.hinge) 쪽, 반대쪽]. 외여닫이·외짝 슬라이딩은 반대쪽이 0
export function leafWidths(o: Opening): [number, number] {
  if (o.leaves === 'double') return [o.width / 2, o.width / 2];
  if (o.leaves === 'asym') {
    const big = Math.round((o.width * 2) / 3);
    return [big, o.width - big];
  }
  return [o.width, 0];
}

// 문짝마다 열림 영역을 따로 계산한다. 모든 문짝은 같은 쪽(swingIn)으로 연다.
// 슬라이딩(spec §47)은 스윙이 없어 빈 배열 → 충돌 검사·2D 호·3D 바닥 오버레이·PDF 부채꼴이 모두 빠진다
export function doorLeaves(w: Wall, o: Opening): DoorLeaf[] {
  if (o.leaves === 'sliding') return [];
  const [start, end] = clampToWall(o, wallLength(w));
  const clamped: Opening = { ...o, offset: start, width: Math.max(0, end - start) };
  const u = wallDir(w);
  const n = clamped.swingIn ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
  const at = (along: number): Vec2 => ({
    x: w.a.x + u.x * along + n.x * (w.thickness / 2),
    y: w.a.y + u.y * along + n.y * (w.thickness / 2),
  });
  const startLeaf = (width: number): DoorLeaf => ({ hinge: at(clamped.offset), closed: u, open: n, width, swing: sector(at(clamped.offset), u, n, width) });
  const endLeaf = (width: number): DoorLeaf => {
    const closed = { x: -u.x, y: -u.y };
    return { hinge: at(clamped.offset + clamped.width), closed, open: n, width, swing: sector(at(clamped.offset + clamped.width), closed, n, width) };
  };
  const [hingeSide, otherSide] = leafWidths(clamped);
  const leaves = clamped.hinge === 'start' ? [startLeaf(hingeSide), endLeaf(otherSide)] : [endLeaf(hingeSide), startLeaf(otherSide)];
  return leaves.filter((l) => l.width > 0);
}

export function doorSwings(plan: Plan): ClearanceShape[] {
  const walls = new Map(plan.walls.map((w) => [w.id, w]));
  return plan.openings.flatMap((o) => {
    const w = walls.get(o.wallId);
    return w && o.kind === 'door' ? doorLeaves(w, o).map((l) => l.swing) : [];
  });
}

// 외짝 슬라이딩 문짝(spec §47.2): 레일 면(swingIn 쪽 법선)으로 두께/2 + 3cm 띄운 선분.
// a = 경첩 반대쪽 끝, b = hinge 쪽 끝, dir = 열 때 문짝이 밀려가는 단위 벡터(hinge가 end면 +u, start면 -u)
export const SLIDING_RAIL_GAP_CM = 3;
export type SlidingLeaf = { a: Vec2; b: Vec2; dir: Vec2 };

export function slidingLeaf(w: Wall, o: Opening): SlidingLeaf | null {
  if (o.kind !== 'door' || o.leaves !== 'sliding') return null;
  const [start, end] = clampToWall(o, wallLength(w));
  if (end - start <= 0) return null;
  const u = wallDir(w);
  const n = o.swingIn ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
  const off = w.thickness / 2 + SLIDING_RAIL_GAP_CM;
  const at = (along: number): Vec2 => ({ x: w.a.x + u.x * along + n.x * off, y: w.a.y + u.y * along + n.y * off });
  const [aT, bT] = o.hinge === 'end' ? [start, end] : [end, start];
  const dir = o.hinge === 'end' ? u : { x: -u.x, y: -u.y };
  return { a: at(aT), b: at(bT), dir };
}

// 문짝 선 중앙에서 dir로 25cm 화살표(spec §47.3): 자루 from→tip, 화살촉 h1·h2. 2D·PNG/PDF가 같은 점을 쓴다
export const SLIDE_ARROW_CM = 25;
export type SlideArrow = { from: Vec2; tip: Vec2; h1: Vec2; h2: Vec2 };

export function slideArrow({ a, b, dir }: SlidingLeaf): SlideArrow {
  const from = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const tip = { x: from.x + dir.x * SLIDE_ARROW_CM, y: from.y + dir.y * SLIDE_ARROW_CM };
  const n = { x: -dir.y, y: dir.x };
  const h1 = { x: tip.x - dir.x * 6 + n.x * 4, y: tip.y - dir.y * 6 + n.y * 4 };
  const h2 = { x: tip.x - dir.x * 6 - n.x * 4, y: tip.y - dir.y * 6 - n.y * 4 };
  return { from, tip, h1, h2 };
}
