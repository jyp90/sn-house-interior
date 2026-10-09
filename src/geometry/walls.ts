import type { Opening, Plan, Vec2, Wall } from '../model/schema';
import type { OBB } from './obb';

export const FLOOR_CUT_SILL_CM = 10;

export type WallPiece = { obb: OBB; y0: number; y1: number };

export function wallLength(w: Wall): number {
  return Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
}

export function wallDir(w: Wall): Vec2 {
  const len = wallLength(w);
  if (len === 0) return { x: 1, y: 0 };
  return { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
}

// 벽 중심선 위 [s, e] 구간(a점 기준 cm)을 사각형으로
function segmentObb(w: Wall, s: number, e: number): OBB {
  const u = wallDir(w);
  const mid = (s + e) / 2;
  return {
    cx: w.a.x + u.x * mid,
    cy: w.a.y + u.y * mid,
    hw: (e - s) / 2,
    hd: w.thickness / 2,
    angle: Math.atan2(u.y, u.x),
  };
}

export function wallObb(w: Wall): OBB {
  return segmentObb(w, -w.thickness / 2, wallLength(w) + w.thickness / 2);
}

export function clampToWall(o: Opening, len: number): [number, number] {
  return [Math.max(0, o.offset), Math.min(len, o.offset + o.width)];
}

function solidIntervals(w: Wall, cuts: Opening[]): [number, number][] {
  const len = wallLength(w);
  const lo = -w.thickness / 2;
  const hi = len + w.thickness / 2;
  const sorted = cuts
    .map((o) => clampToWall(o, len))
    .filter(([s, e]) => e > s)
    .sort((p, q) => p[0] - q[0]);
  const result: [number, number][] = [];
  let cursor = lo;
  for (const [s, e] of sorted) {
    if (s > cursor) result.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (hi > cursor) result.push([cursor, hi]);
  return result.filter(([s, e]) => e - s > 0.01);
}

export function wallSolidObbs(w: Wall, openings: Opening[]): OBB[] {
  if (wallLength(w) === 0) return [wallObb(w)];
  const cuts = openings.filter((o) => o.kind !== 'window' || o.sill < FLOOR_CUT_SILL_CM);
  return solidIntervals(w, cuts).map(([s, e]) => segmentObb(w, s, e));
}

export function wallPieces(w: Wall, openings: Opening[]): WallPiece[] {
  const len = wallLength(w);
  if (len === 0) return [{ obb: wallObb(w), y0: 0, y1: w.height }];
  const pieces: WallPiece[] = solidIntervals(w, openings).map(([s, e]) => ({
    obb: segmentObb(w, s, e),
    y0: 0,
    y1: w.height,
  }));
  for (const o of openings) {
    const [s, e] = clampToWall(o, len);
    if (e <= s) continue;
    const obb = segmentObb(w, s, e);
    if (o.sill > 0) pieces.push({ obb, y0: 0, y1: Math.min(o.sill, w.height) });
    const top = o.sill + o.height;
    if (top < w.height) pieces.push({ obb, y0: top, y1: w.height });
  }
  return pieces;
}

export function planWallObbsWithIds(plan: Plan): { wallId: string; obb: OBB }[] {
  return plan.walls.flatMap((w) =>
    wallSolidObbs(w, plan.openings.filter((o) => o.wallId === w.id)).map((obb) => ({ wallId: w.id, obb })),
  );
}

export function planWallObbs(plan: Plan): OBB[] {
  return planWallObbsWithIds(plan).map((x) => x.obb);
}

export function openingObb(w: Wall, o: Opening): OBB {
  return segmentObb(w, o.offset, o.offset + o.width);
}
