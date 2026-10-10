import type { Vec2 } from '../model/schema';
import { axes, corners, localToWorld, type OBB } from './obb';

type DistanceRay = { dir: 'left' | 'right' | 'front' | 'back'; from: Vec2; to: Vec2; distance: number };

const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;

function raySegment(p: Vec2, d: Vec2, q1: Vec2, q2: Vec2): number | null {
  const e = { x: q2.x - q1.x, y: q2.y - q1.y };
  const denom = cross(d, e);
  if (Math.abs(denom) < 1e-9) return null;
  const qp = { x: q1.x - p.x, y: q1.y - p.y };
  const t = cross(qp, e) / denom;
  const s = cross(qp, d) / denom;
  return t >= -1e-6 && s >= 0 && s <= 1 ? Math.max(0, t) : null;
}

export function wallDistances(item: OBB, walls: OBB[], maxDist = 2000): DistanceRay[] {
  const [u, v] = axes(item);
  const probes: [DistanceRay['dir'], Vec2, Vec2][] = [
    ['right', localToWorld(item, item.hw, 0), u],
    ['left', localToWorld(item, -item.hw, 0), { x: -u.x, y: -u.y }],
    ['front', localToWorld(item, 0, item.hd), v],
    ['back', localToWorld(item, 0, -item.hd), { x: -v.x, y: -v.y }],
  ];
  const edges = walls.flatMap((w) => {
    const c = corners(w);
    return c.map((p, i) => [p, c[(i + 1) % 4]] as const);
  });
  const rays: DistanceRay[] = [];
  for (const [dir, from, d] of probes) {
    let best = Infinity;
    for (const [q1, q2] of edges) {
      const t = raySegment(from, d, q1, q2);
      if (t !== null && t < best) best = t;
    }
    if (best <= maxDist) {
      rays.push({ dir, from, to: { x: from.x + d.x * best, y: from.y + d.y * best }, distance: Math.round(best) });
    }
  }
  return rays;
}
