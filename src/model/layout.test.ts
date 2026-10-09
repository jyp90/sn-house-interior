import { describe, expect, it } from 'vitest';
import { activeItems, activeLayout, compareItems, itemNumbers, nextLayoutName, withActiveItems } from './layout';
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

describe('nextLayoutName / compareItems', () => {
  it('처음 비는 알파벳 이름을 고른다', () => {
    expect(nextLayoutName(['A안'])).toBe('B안');
    expect(nextLayoutName(['A안', 'C안'])).toBe('B안');
  });

  it('비교 대상은 활성 배치안이 아닌 존재하는 배치안만', () => {
    const b = { id: 'layout-b', name: 'B안', items: [{ id: 'x', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 }] };
    const plan = { ...SAMPLE_PLAN, layouts: [...SAMPLE_PLAN.layouts, b] };
    expect(compareItems(plan, 'layout-b')).toBe(b.items);
    expect(compareItems(plan, 'layout-a')).toEqual([]);
    expect(compareItems(plan, 'nope')).toEqual([]);
    expect(compareItems(plan, null)).toEqual([]);
  });
});

describe('itemNumbers', () => {
  it('배치 순서대로 1부터 매기고, 제품을 찾을 수 없는 아이템은 건너뛴다', () => {
    const sofa = { id: 's', productId: 'sofa-3seat', variantId: 'gray', x: 100, y: 100, rotation: 0 };
    const ghost = { id: 'g', productId: 'no-such-product', variantId: 'x', x: 150, y: 100, rotation: 0 };
    const table = { id: 't', productId: 'table-dining-4', variantId: 'oak', x: 200, y: 100, rotation: 0 };
    const plan = withActiveItems(SAMPLE_PLAN, [sofa, ghost, table]);
    expect(itemNumbers(plan)).toEqual(new Map([['s', 1], ['t', 2]]));
  });
});
