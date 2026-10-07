import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { planBounds, planCenter } from './bounds';

describe('planBounds', () => {
  it('벽 끝점으로 범위를 구한다', () => {
    expect(planBounds(SAMPLE_PLAN)).toEqual({ minX: 0, minY: 0, maxX: 600, maxY: 400 });
    expect(planCenter(SAMPLE_PLAN)).toEqual({ x: 300, y: 200 });
  });

  it('벽이 없으면 기본 600×400 범위를 쓴다', () => {
    expect(planBounds({ ...SAMPLE_PLAN, walls: [] })).toEqual({ minX: 0, minY: 0, maxX: 600, maxY: 400 });
  });
});
