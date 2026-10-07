import { describe, expect, it } from 'vitest';
import { fitViewBox, panBy, zoomAt } from './viewBox';

describe('viewBox', () => {
  it('여백을 두고 화면 비율에 맞춰 평면 전체를 담는다', () => {
    expect(fitViewBox({ minX: 0, minY: 0, maxX: 600, maxY: 400 }, 2)).toEqual({ x: -300, y: -100, w: 1200, h: 600 });
  });

  it('확대해도 커서 아래 점은 그대로다', () => {
    expect(zoomAt({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50 }, 2)).toEqual({ x: 25, y: 25, w: 50, h: 50 });
  });

  it('너무 확대하면 50cm에서 멈춘다', () => {
    expect(zoomAt({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0 }, 100).w).toBe(50);
  });

  it('panBy는 원점을 옮긴다', () => {
    expect(panBy({ x: 0, y: 0, w: 10, h: 10 }, 5, -3)).toEqual({ x: 5, y: -3, w: 10, h: 10 });
  });
});
