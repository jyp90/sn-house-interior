import { describe, expect, it } from 'vitest';
import { wallPieces } from '../geometry/walls';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Room } from '../model/schema';
import { wallFaceSegments, type FaceSegment } from './wallFaces';

const room = (id: string, polygon: Room['polygon']): Room => ({ id, name: id, label: polygon![0], polygon });
const r1 = room('r1', [{ x: 10, y: 10 }, { x: 344, y: 10 }, { x: 344, y: 390 }, { x: 10, y: 390 }]);
const r2 = room('r2', [{ x: 356, y: 10 }, { x: 590, y: 10 }, { x: 590, y: 390 }, { x: 356, y: 390 }]);
const noPoly: Room = { id: 'N', name: 'N', label: { x: 0, y: 0 } };
const rooms = [noPoly, r1, r2];

const plan = SAMPLE_PLAN;
const piecesOf = (id: string) => {
  const w = plan.walls.find((x) => x.id === id)!;
  return wallPieces(w, plan.openings.filter((o) => o.wallId === id));
};
const ids = (segs: FaceSegment[]) => segs.map((s) => s.room?.id ?? null);
const roomSegs = (segs: FaceSegment[]) => segs.filter((s) => s.room);

describe('wallFaceSegments', () => {
  it('두 방에 걸친 아래 벽(w3)은 칸막이 위치(x 344–356)에서 방이 바뀐다', () => {
    const [piece] = piecesOf('w3');
    const { front, back } = wallFaceSegments(piece.obb, rooms);
    const inner = ids(front).some((x) => x) ? front : back;
    const outer = inner === front ? back : front;
    expect(ids(inner)).toEqual([null, 'r2', null, 'r1', null]);
    // w3는 (600,400)→(0,400): 로컬 u = 300 - x
    const at = (id: string) => inner.find((s) => s.room?.id === id)!;
    expect(at('r1').s).toBeCloseTo(300 - 344);
    expect(at('r1').e).toBeCloseTo(300 - 10);
    expect(at('r2').s).toBeCloseTo(300 - 590);
    expect(at('r2').e).toBeCloseTo(300 - 356);
    expect(ids(outer)).toEqual([null]);
  });

  it('구간은 -hw..+hw를 빈틈없이 덮는다', () => {
    const [piece] = piecesOf('w1');
    for (const segs of Object.values(wallFaceSegments(piece.obb, rooms))) {
      expect(segs[0].s).toBeCloseTo(-piece.obb.hw);
      expect(segs.at(-1)!.e).toBeCloseTo(piece.obb.hw);
      for (let i = 1; i < segs.length; i++) expect(segs[i].s).toBe(segs[i - 1].e);
    }
  });

  it('칸막이 벽(w5)은 측면마다 방 구간이 하나씩이고 양쪽 방이 다르다', () => {
    for (const piece of piecesOf('w5')) {
      const { front, back } = wallFaceSegments(piece.obb, rooms);
      expect(roomSegs(front)).toHaveLength(1);
      expect(roomSegs(back)).toHaveLength(1);
      expect(new Set([roomSegs(front)[0].room!.id, roomSegs(back)[0].room!.id])).toEqual(new Set(['r1', 'r2']));
    }
  });

  it('어느 방에도 닿지 않는 벽은 null 구간 하나', () => {
    const piece = { cx: 1000, cy: 1000, hw: 100, hd: 5, angle: 0 };
    expect(wallFaceSegments(piece, rooms)).toEqual({
      front: [{ s: -100, e: 100, room: null }],
      back: [{ s: -100, e: 100, room: null }],
    });
  });

  it('오목한 방(ㄷ자)도 구간마다 맞게 나눈다', () => {
    // 위가 열린 ㄷ자: 바닥 띠 y 200..300, 두 기둥 x 0..100, 200..300
    const u = room('U', [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 200 }, { x: 200, y: 200 },
      { x: 200, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 },
    ]);
    // y=95 수평 벽, 두께 10: 측면 탐침선 y = 89, 101 → 두 기둥만 지난다
    const piece = { cx: 150, cy: 95, hw: 150, hd: 5, angle: 0 };
    const { front, back } = wallFaceSegments(piece, [u]);
    for (const segs of [front, back]) {
      expect(ids(segs)).toEqual(['U', null, 'U']);
      expect(segs[0].e).toBeCloseTo(-50);
      expect(segs[2].s).toBeCloseTo(50);
    }
  });

  it('겹치는 방은 먼저 나온 방이 이긴다', () => {
    const big = room('B', [{ x: -10, y: -10 }, { x: 700, y: -10 }, { x: 700, y: 500 }, { x: -10, y: 500 }]);
    const [piece] = piecesOf('w5');
    const { front, back } = wallFaceSegments(piece.obb, [big, r1, r2]);
    expect(ids(front)).toEqual(['B']);
    expect(ids(back)).toEqual(['B']);
  });
});
