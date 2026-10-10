import { axes, corners, type OBB } from './obb';

const WALL_SNAP_CM = 2;

const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;

export function snapToWalls(item: OBB, walls: OBB[], threshold = WALL_SNAP_CM): { cx: number; cy: number } {
  const pts = corners(item);
  const center = { x: item.cx, y: item.cy };
  let best: { gap: number; shift: { x: number; y: number } } | null = null;
  for (const w of walls) {
    const [u, n] = axes(w);
    const wc = { x: w.cx, y: w.cy };
    const us = pts.map((p) => dot(p, u));
    const wu = dot(wc, u);
    if (Math.min(Math.max(...us), wu + w.hw) - Math.max(Math.min(...us), wu - w.hw) <= 0) continue;
    const ns = pts.map((p) => dot(p, n));
    const wn = dot(wc, n);
    const onPositive = dot(center, n) > wn;
    const gap = onPositive ? Math.min(...ns) - (wn + w.hd) : wn - w.hd - Math.max(...ns);
    if (Math.abs(gap) > threshold) continue;
    if (best && Math.abs(best.gap) <= Math.abs(gap)) continue;
    const k = onPositive ? -gap : gap;
    best = { gap, shift: { x: n.x * k, y: n.y * k } };
  }
  if (!best) return { cx: item.cx, cy: item.cy };
  return { cx: item.cx + best.shift.x, cy: item.cy + best.shift.y };
}
