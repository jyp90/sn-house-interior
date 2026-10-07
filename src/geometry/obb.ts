import type { Vec2 } from '../model/schema';

export type OBB = { cx: number; cy: number; hw: number; hd: number; angle: number };

export const deg2rad = (d: number) => (d * Math.PI) / 180;

export function axes(o: OBB): [Vec2, Vec2] {
  const c = Math.cos(o.angle);
  const s = Math.sin(o.angle);
  return [{ x: c, y: s }, { x: -s, y: c }];
}

export function localToWorld(o: OBB, lx: number, ly: number): Vec2 {
  const [u, v] = axes(o);
  return { x: o.cx + u.x * lx + v.x * ly, y: o.cy + u.y * lx + v.y * ly };
}

export function corners(o: OBB): Vec2[] {
  return [
    localToWorld(o, -o.hw, -o.hd),
    localToWorld(o, o.hw, -o.hd),
    localToWorld(o, o.hw, o.hd),
    localToWorld(o, -o.hw, o.hd),
  ];
}

function project(points: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const t = p.x * axis.x + p.y * axis.y;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return [min, max];
}

export function obbOverlap(a: OBB, b: OBB, eps = 0.5): boolean {
  const ca = corners(a);
  const cb = corners(b);
  for (const axis of [...axes(a), ...axes(b)]) {
    const [amin, amax] = project(ca, axis);
    const [bmin, bmax] = project(cb, axis);
    if (Math.min(amax, bmax) - Math.max(amin, bmin) <= eps) return false;
  }
  return true;
}

export function itemObb(x: number, y: number, rotationDeg: number, w: number, d: number): OBB {
  return { cx: x, cy: y, hw: w / 2, hd: d / 2, angle: deg2rad(rotationDeg) };
}
