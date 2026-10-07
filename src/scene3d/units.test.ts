import { describe, expect, it } from 'vitest';
import { sectorToCircleArgs, toWorld } from './units';

describe('units', () => {
  it('2D cm를 3D m로 바꾸고 y는 높이가 된다', () => {
    expect(toWorld({ x: 150, y: 250 })).toEqual([1.5, 0, 2.5]);
    expect(toWorld({ x: 0, y: 0 }, 90)).toEqual([0, 0.9, 0]);
  });

  it('2D 부채꼴 각도를 바닥에 눕힌 circleGeometry 각도로 바꾼다', () => {
    // 2D 각도 φ(y-down) → 바닥 원판의 로컬 각도 -φ
    expect(sectorToCircleArgs(0, Math.PI / 2)).toEqual({ thetaStart: -Math.PI / 2, thetaLength: Math.PI / 2 });
  });
});
