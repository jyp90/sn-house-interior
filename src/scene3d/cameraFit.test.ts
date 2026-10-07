import { describe, expect, it } from 'vitest';
import { fitPerspective, fitTop, fitTopZoom } from './cameraFit';

const b = { minX: 0, minY: 0, maxX: 1000, maxY: 690 };

describe('cameraFit', () => {
  it('탑뷰는 평면 중심 위에서 내려다본다', () => {
    const f = fitTop(b);
    expect(f.target).toEqual([5, 0, 3.45]);
    expect(f.position[0]).toBe(5);
    expect(f.position[1]).toBe(30);
    expect(f.position[2]).toBeCloseTo(3.46);
  });

  it('탑뷰 줌은 평면 전체(여백 15%)가 화면에 들어오게', () => {
    expect(fitTopZoom(b, 1100, 690)).toBeCloseTo(86.96, 1);
  });

  it('원근 시점은 평면 크기에 비례해 물러선다', () => {
    const f = fitPerspective(b);
    expect(f.target).toEqual([5, 0, 3.45]);
    expect(f.position[1]).toBeCloseTo((10 * 1.3 + 2) * 0.8);
  });
});
