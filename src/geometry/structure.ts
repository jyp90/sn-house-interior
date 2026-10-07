import type { Opening, Vec2, Wall } from '../model/schema';
import { wallDir, wallLength } from './walls';

export function roomRectWalls(origin: Vec2, w: number, d: number, thickness: number, height: number): Omit<Wall, 'id'>[] {
  // 중심선은 내측보다 두께 절반씩 바깥. 두께가 홀수여도 중심선 크기가 w + thickness가 되도록 한쪽만 반올림한다
  const x0 = Math.round(origin.x - thickness / 2);
  const y0 = Math.round(origin.y - thickness / 2);
  const x1 = x0 + w + thickness;
  const y1 = y0 + d + thickness;
  const tl = { x: x0, y: y0 };
  const tr = { x: x1, y: y0 };
  const br = { x: x1, y: y1 };
  const bl = { x: x0, y: y1 };
  return [
    [tl, tr],
    [tr, br],
    [br, bl],
    [bl, tl],
  ].map(([a, b]) => ({ a, b, thickness, height }));
}

export function fitOpening(wall: Wall, offset: number, width: number): number | null {
  const len = wallLength(wall);
  if (width > len) return null;
  return Math.min(Math.max(0, Math.round(offset)), Math.floor(len - width));
}

export function openingAtPoint(wall: Wall, p: Vec2, width: number): number | null {
  const u = wallDir(wall);
  const t = (p.x - wall.a.x) * u.x + (p.y - wall.a.y) * u.y;
  return fitOpening(wall, t - width / 2, width);
}

export function distanceToWall(w: Wall, p: Vec2): number {
  const len = wallLength(w);
  const u = wallDir(w);
  const t = Math.max(0, Math.min(len, (p.x - w.a.x) * u.x + (p.y - w.a.y) * u.y));
  return Math.hypot(p.x - (w.a.x + u.x * t), p.y - (w.a.y + u.y * t));
}

export function nearestWall(walls: Wall[], p: Vec2, maxDist: number): Wall | null {
  let best: Wall | null = null;
  let bestDist = Infinity;
  for (const w of walls) {
    const d = distanceToWall(w, p);
    if (d <= maxDist && d < bestDist) {
      best = w;
      bestDist = d;
    }
  }
  return best;
}

export function refitOpenings(
  walls: Wall[],
  openings: Opening[],
): { ok: true; openings: Opening[] } | { ok: false; openingId: string } {
  const byId = new Map(walls.map((w) => [w.id, w]));
  const result: Opening[] = [];
  for (const o of openings) {
    const wall = byId.get(o.wallId);
    if (!wall) continue;
    const offset = fitOpening(wall, o.offset, o.width);
    if (offset === null) return { ok: false, openingId: o.id };
    result.push(offset === o.offset ? o : { ...o, offset });
  }
  return { ok: true, openings: result };
}

const same = (p: Vec2, q: Vec2) => p.x === q.x && p.y === q.y;

export function moveEndpoint(walls: Wall[], from: Vec2, to: Vec2): Wall[] {
  return walls.map((w) => {
    if (!same(w.a, from) && !same(w.b, from)) return w;
    return { ...w, a: same(w.a, from) ? { ...to } : w.a, b: same(w.b, from) ? { ...to } : w.b };
  });
}

export function setWallLength(wall: Wall, length: number): Wall {
  const u = wallDir(wall);
  return { ...wall, b: { x: Math.round(wall.a.x + u.x * length), y: Math.round(wall.a.y + u.y * length) } };
}
