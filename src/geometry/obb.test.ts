import { describe, expect, it } from 'vitest';
import { corners, deg2rad, itemObb, obbOverlap, type OBB } from './obb';

const box = (cx: number, cy: number, hw: number, hd: number, deg = 0): OBB => ({ cx, cy, hw, hd, angle: deg2rad(deg) });

describe('obbOverlap', () => {
  it('같은 위치의 사각형은 겹친다', () => {
    expect(obbOverlap(box(0, 0, 10, 10), box(0, 0, 10, 10))).toBe(true);
  });

  it('떨어진 사각형은 겹치지 않는다', () => {
    expect(obbOverlap(box(0, 0, 10, 10), box(30, 0, 10, 10))).toBe(false);
  });

  it('맞닿기만 하면 충돌이 아니다', () => {
    expect(obbOverlap(box(0, 0, 10, 10), box(20, 0, 10, 10))).toBe(false);
  });

  it('AABB는 겹치지만 회전 사각형은 안 겹친다', () => {
    const diagonal = box(0, 0, 50, 5, 45);
    expect(obbOverlap(diagonal, box(30, -30, 5, 5))).toBe(false);
  });

  it('회전 사각형이 대각선 위의 사각형과 겹친다', () => {
    expect(obbOverlap(box(0, 0, 50, 5, 45), box(20, 20, 5, 5))).toBe(true);
  });
});

describe('itemObb', () => {
  it('90° 회전하면 폭과 깊이 방향이 바뀐다', () => {
    const c = corners(itemObb(0, 0, 90, 100, 40));
    const xs = c.map((p) => p.x);
    const ys = c.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(40);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100);
  });
});
