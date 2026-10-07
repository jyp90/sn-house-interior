import type { Vec2 } from '../model/schema';

export const ENDPOINT_SNAP_CM = 15;

const STEP = Math.PI / 4;
const round = (p: Vec2): Vec2 => ({ x: Math.round(p.x), y: Math.round(p.y) });

export function snapAngle(prev: Vec2, p: Vec2): Vec2 {
  const len = Math.hypot(p.x - prev.x, p.y - prev.y);
  if (len === 0) return { ...prev };
  const a = Math.round(Math.atan2(p.y - prev.y, p.x - prev.x) / STEP) * STEP;
  return round({ x: prev.x + Math.cos(a) * len, y: prev.y + Math.sin(a) * len });
}

export function snapToEndpoint(p: Vec2, endpoints: Vec2[], maxDist = ENDPOINT_SNAP_CM): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDist = Infinity;
  for (const e of endpoints) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d <= maxDist && d < bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best ? { ...best } : null;
}

export function wallToolPoint(raw: Vec2, prev: Vec2 | null, endpoints: Vec2[], snap: boolean): Vec2 {
  if (!snap) return round(raw);
  const endpoint = snapToEndpoint(raw, endpoints);
  if (endpoint) return endpoint;
  return prev ? snapAngle(prev, raw) : round(raw);
}

export function wallSegments(points: Vec2[]): [Vec2, Vec2][] {
  const segments: [Vec2, Vec2][] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.x !== b.x || a.y !== b.y) segments.push([a, b]);
  }
  return segments;
}
