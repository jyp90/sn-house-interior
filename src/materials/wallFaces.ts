import { axes, type OBB } from '../geometry/obb';
import { pointInPolygon } from '../geometry/polygon';
import type { Room, Vec2 } from '../model/schema';

export const WALL_TOP_COLOR = '#3f3a33';
const PROBE_CM = 1;
const EPS = 1e-6;

// 벽 측면의 한 구간. s, e는 조각의 로컬 u축 위치(cm, -hw..+hw), room은 그 구간이 마주한 방(없으면 null)
export type FaceSegment = { s: number; e: number; room: Room | null };

function roomAt(p: Vec2, rooms: Room[]): Room | null {
  for (const r of rooms) if (r.polygon && pointInPolygon(p, r.polygon)) return r;
  return null;
}

// 탐침선 o + u·t 가 방 경계와 만나는 t 값들
function crossings(o: Vec2, u: Vec2, v: Vec2, rooms: Room[]): number[] {
  const ts: number[] = [];
  const along = (p: Vec2) => (p.x - o.x) * u.x + (p.y - o.y) * u.y;
  const off = (p: Vec2) => (p.x - o.x) * v.x + (p.y - o.y) * v.y;
  for (const r of rooms) {
    const pts = r.polygon;
    if (!pts) continue;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const da = off(a);
      const db = off(b);
      if (Math.abs(da) < EPS) ts.push(along(a));
      if (Math.abs(db) < EPS) ts.push(along(b));
      if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
        const k = da / (da - db);
        ts.push(along(a) + (along(b) - along(a)) * k);
      }
    }
  }
  return ts;
}

function sideSegments(piece: OBB, sign: 1 | -1, rooms: Room[]): FaceSegment[] {
  const [u, v] = axes(piece);
  const d = sign * (piece.hd + PROBE_CM);
  const o = { x: piece.cx + v.x * d, y: piece.cy + v.y * d };
  const hw = piece.hw;
  const cuts = [-hw, hw, ...crossings(o, u, v, rooms).filter((t) => t > -hw && t < hw)].sort((a, b) => a - b);
  const out: FaceSegment[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const s = cuts[i];
    const e = cuts[i + 1];
    if (e - s < EPS) continue;
    const m = (s + e) / 2;
    const room = roomAt({ x: o.x + u.x * m, y: o.y + u.y * m }, rooms);
    const last = out.at(-1);
    if (last && last.room === room) last.e = e;
    else out.push({ s, e, room });
  }
  return out;
}

// 벽 조각의 두 측면(법선 ±v 방향)을 마주한 방별 구간으로 나눈다. front = +v 쪽.
// 측면에서 벽 두께 절반 + 1cm 떨어진 탐침선이 방 경계와 만나는 곳에서 자르고, 구간 중점이 속한 방(먼저 나온 방 우선)을 고른다
export function wallFaceSegments(piece: OBB, rooms: Room[]): { front: FaceSegment[]; back: FaceSegment[] } {
  return { front: sideSegments(piece, 1, rooms), back: sideSegments(piece, -1, rooms) };
}
