import { describe, expect, it } from 'vitest';
import { fitPerspective, fitTop, fitTopZoom, pdfViewPoses } from './cameraFit';

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

  it('PDF용 시점 3개: 위에서, 오른쪽 앞, 왼쪽 뒤(중심 대칭)', () => {
    const poses = pdfViewPoses({ minX: 0, minY: 0, maxX: 600, maxY: 400 });
    expect(poses.map((p) => p.label)).toEqual(['위에서 본 전체', '오른쪽 앞에서', '왼쪽 뒤에서']);
    for (const p of poses) expect(p.fit.target).toEqual([3, 0, 2]);
    const [top, a, c] = poses.map((p) => p.fit.position);
    expect(top[0]).toBe(3);
    expect(top[2]).toBeCloseTo(2.01);
    expect(top[1]).toBeGreaterThan(6);
    expect(a[0] - 3).toBeCloseTo(-(c[0] - 3));
    expect(a[2] - 2).toBeCloseTo(-(c[2] - 2));
    expect(a[1]).toBeCloseTo(c[1]);
    expect(a[0]).toBeGreaterThan(3);
  });
});
