import { describe, expect, it } from 'vitest';
import { activeItems, withActiveItems } from './layout';
import { SAMPLE_PLAN } from './samplePlan';

describe('layout', () => {
  it('withActiveItems는 원본을 바꾸지 않고 새 평면을 돌려준다', () => {
    const items = [{ id: 'i', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 }];
    const next = withActiveItems(SAMPLE_PLAN, items);
    expect(activeItems(next)).toBe(items);
    expect(activeItems(SAMPLE_PLAN)).toEqual([]);
    expect(next).not.toBe(SAMPLE_PLAN);
  });
});
