import { describe, expect, it } from 'vitest';
import { pointsAttr, sectorPath, shapePath } from './svg';

describe('svg', () => {
  it('pointsAttr는 소수 둘째 자리까지', () => {
    expect(pointsAttr([{ x: 0, y: 0 }, { x: 1.2345, y: 2 }])).toBe('0,0 1.23,2');
  });

  it('sectorPath는 시계 방향(y 아래) 호를 그린다', () => {
    expect(sectorPath({ x: 0, y: 0 }, 10, 0, Math.PI / 2)).toBe('M 0 0 L 10 0 A 10 10 0 0 1 0 10 Z');
  });

  it('shapePath는 사각형 영역을 닫힌 경로로', () => {
    expect(shapePath({ kind: 'rect', obb: { cx: 0, cy: 0, hw: 10, hd: 5, angle: 0 } })).toBe('M -10 -5 L 10 -5 L 10 5 L -10 5 Z');
  });
});
