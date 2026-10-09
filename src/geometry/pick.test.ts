import { describe, expect, it } from 'vitest';
import { withActiveItems } from '../model/layout';
import type { Product } from '../model/schema';
import { emptyPlanFields } from '../model/samplePlan';
import { deg2rad } from './obb';
import { itemsAtPoint, pointInObb } from './pick';

const product: Product = {
  id: 'p', brand: 't', model: '', name: 'n', category: 'furniture', dims: { w: 100, d: 50, h: 50 },
  variants: [{ id: 'v', label: 'v', colors: {} }], builder: 'box', clearances: [], builtIn: false, mount: 'floor',
};

describe('pointInObb', () => {
  it('회전한 사각형 안팎을 판정한다', () => {
    const o = { cx: 0, cy: 0, hw: 50, hd: 10, angle: deg2rad(90) };
    expect(pointInObb(o, { x: 0, y: 40 })).toBe(true);
    expect(pointInObb(o, { x: 40, y: 0 })).toBe(false);
  });
});

describe('itemsAtPoint', () => {
  it('겹친 아이템을 위에 그려진 것부터 돌려준다', () => {
    const plan = withActiveItems(
      { version: 5 as const, info: { title: 't' }, walls: [], openings: [], rooms: [], ...emptyPlanFields() },
      [
        { id: 'a', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 },
        { id: 'b', productId: 'p', variantId: 'v', x: 30, y: 0, rotation: 0 },
        { id: 'c', productId: 'p', variantId: 'v', x: 500, y: 0, rotation: 0 },
      ],
    );
    expect(itemsAtPoint(plan, { x: 10, y: 0 }, () => product)).toEqual(['b', 'a']);
    expect(itemsAtPoint(plan, { x: 1000, y: 0 }, () => product)).toEqual([]);
  });
});
