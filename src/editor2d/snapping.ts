import type { Vec2, Wall } from '../model/schema';
import { wallDir, wallLength } from '../geometry/walls';

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

function sharedEndpoint(a: Wall, b: Wall): Vec2 | null {
  for (const p of [a.a, a.b]) {
    for (const q of [b.a, b.b]) {
      if (p.x === q.x && p.y === q.y) return p;
    }
  }
  return null;
}

type Line = { p: Vec2; d: Vec2 };

function faceLines(w: Wall): [Line, Line] {
  const u = wallDir(w);
  const n = { x: -u.y, y: u.x };
  const half = w.thickness / 2;
  return [
    { p: { x: w.a.x + n.x * half, y: w.a.y + n.y * half }, d: u },
    { p: { x: w.a.x - n.x * half, y: w.a.y - n.y * half }, d: u },
  ];
}

function lineIntersect(a: Line, b: Line): Vec2 | null {
  const denom = a.d.x * b.d.y - a.d.y * b.d.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((b.p.x - a.p.x) * b.d.y - (b.p.y - a.p.y) * b.d.x) / denom;
  return { x: a.p.x + a.d.x * t, y: a.p.y + a.d.y * t };
}

// 두 벽이 끝점을 공유할 때, 서로의 마감면(중심선에서 두께/2만큼 띄운 선) 교차점들
export function wallFaceCorners(walls: Wall[]): Vec2[] {
  const result: Vec2[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const wa = walls[i];
      const wb = walls[j];
      if (wallLength(wa) === 0 || wallLength(wb) === 0) continue;
      const shared = sharedEndpoint(wa, wb);
      if (!shared) continue;
      const maxThick = Math.max(wa.thickness, wb.thickness);
      for (const fa of faceLines(wa)) {
        for (const fb of faceLines(wb)) {
          const pt = lineIntersect(fa, fb);
          if (!pt) continue;
          if (Math.hypot(pt.x - shared.x, pt.y - shared.y) > 1.5 * maxThick) continue;
          const rp = round(pt);
          const key = `${rp.x},${rp.y}`;
          if (seen.has(key)) continue;
          seen.add(key);
          result.push(rp);
        }
      }
    }
  }
  return result;
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
