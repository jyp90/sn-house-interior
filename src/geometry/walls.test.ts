import { describe, expect, it } from 'vitest';
import type { Opening, Wall } from '../model/schema';
import { wallObb, wallPieces, wallSolidObbs } from './walls';

const wall: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 };
const opening = (o: Partial<Opening>): Opening => ({
  id: 'o', wallId: 'w', kind: 'door', offset: 100, width: 80, height: 210, sill: 0, hinge: 'start', swingIn: true, ...o,
});

describe('wallObb', () => {
  it('양 끝을 두께 절반만큼 늘린다', () => {
    const o = wallObb(wall);
    expect(o).toMatchObject({ cx: 200, cy: 0, hw: 205, hd: 5 });
    expect(o.angle).toBeCloseTo(0);
  });

  it('길이 0인 벽도 NaN 없이 처리한다', () => {
    const o = wallObb({ ...wall, b: { x: 0, y: 0 } });
    expect([o.cx, o.cy, o.hw, o.hd, o.angle].every(Number.isFinite)).toBe(true);
  });
});

describe('wallSolidObbs', () => {
  it('문은 벽을 두 구간으로 나눈다', () => {
    const parts = wallSolidObbs(wall, [opening({})]);
    expect(parts).toHaveLength(2);
    expect(parts[0].cx).toBeCloseTo(47.5);
    expect(parts[0].hw).toBeCloseTo(52.5);
    expect(parts[1].cx).toBeCloseTo(292.5);
    expect(parts[1].hw).toBeCloseTo(112.5);
  });

  it('창턱이 높은 창은 바닥에서 벽을 끊지 않는다', () => {
    expect(wallSolidObbs(wall, [opening({ kind: 'window', sill: 90, height: 120 })])).toHaveLength(1);
  });

  it('창턱이 10cm 미만인 창(발코니 미닫이)은 벽을 끊는다', () => {
    expect(wallSolidObbs(wall, [opening({ kind: 'window', sill: 0 })])).toHaveLength(2);
  });
});

describe('wallPieces', () => {
  it('창은 좌우 전체높이 + 창 아래 + 창 위 조각을 만든다', () => {
    const pieces = wallPieces(wall, [opening({ kind: 'window', offset: 100, width: 100, sill: 90, height: 120 })]);
    expect(pieces).toHaveLength(4);
    const below = pieces.find((p) => p.y0 === 0 && p.y1 === 90);
    const above = pieces.find((p) => p.y0 === 210 && p.y1 === 230);
    expect(below?.obb.cx).toBeCloseTo(150);
    expect(above?.obb.hw).toBeCloseTo(50);
  });

  it('문은 좌우 전체높이 + 문 위 조각을 만든다', () => {
    const pieces = wallPieces(wall, [opening({})]);
    expect(pieces).toHaveLength(3);
    expect(pieces.some((p) => p.y0 === 210 && p.y1 === 230)).toBe(true);
  });
});
