import { describe, expect, it } from 'vitest';
import { activeItems, activeLayout, withActiveItems } from './layout';
import { SAMPLE_PLAN } from './samplePlan';

describe('layout', () => {
  it('withActiveItems는 원본을 바꾸지 않고 새 평면을 돌려준다', () => {
    const items = [{ id: 'i', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 }];
    const next = withActiveItems(SAMPLE_PLAN, items);
    expect(activeItems(next)).toBe(items);
    expect(activeItems(SAMPLE_PLAN)).toEqual([]);
    expect(next).not.toBe(SAMPLE_PLAN);
  });

  it('activeLayoutId가 없으면 첫 배치안을 쓴다', () => {
    const plan = { ...SAMPLE_PLAN, activeLayoutId: 'missing' };
    expect(activeLayout(plan).id).toBe('layout-a');
  });

  it('withActiveItems는 활성 배치안의 아이템만 바꾼다', () => {
    const other = { id: 'layout-b', name: 'B안', items: [] };
    const plan = { ...SAMPLE_PLAN, layouts: [...SAMPLE_PLAN.layouts, other] };
    const items = [{ id: 'i', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 }];
    const next = withActiveItems(plan, items);
    expect(next.layouts[0].items).toBe(items);
    expect(next.layouts[1]).toBe(other);
  });
});
