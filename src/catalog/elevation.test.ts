import { describe, expect, it } from 'vitest';
import type { Product } from '../model/schema';
import { ceilingHeightCm, DEFAULT_CEILING_CM, itemElevationCm, productElevationCm } from './elevation';

const base = (over: Partial<Product>): Product => ({
  id: 'x', brand: 't', model: 'm', name: 'n', category: 'kitchen', dims: { w: 60, d: 60, h: 70 },
  variants: [{ id: 'v', label: 'v', colors: {} }], builder: 'box', clearances: [], builtIn: false, mount: 'floor', ...over,
});

describe('ceilingHeightCm', () => {
  it('벽이 없으면 230', () => {
    expect(ceilingHeightCm({ walls: [] })).toBe(DEFAULT_CEILING_CM);
  });
  it('벽 높이의 최댓값', () => {
    const wall = (height: number) => ({ id: 'w' + height, a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 10, height });
    expect(ceilingHeightCm({ walls: [wall(230), wall(250), wall(220)] })).toBe(250);
  });
});

describe('productElevationCm', () => {
  it('floor 제품은 0, wall 제품은 90, ceiling 제품은 천장 − 높이', () => {
    expect(productElevationCm(base({}), 230)).toBe(0);
    expect(productElevationCm(base({ mount: 'wall' }), 230)).toBe(90);
    expect(productElevationCm(base({ mount: 'ceiling', dims: { w: 84, d: 84, h: 25 } }), 230)).toBe(205);
  });
  it('product.elevation이 builderParams.mountHeight보다 우선한다', () => {
    expect(productElevationCm(base({ mount: 'wall', builderParams: { mountHeight: 120 } }), 230)).toBe(120);
    expect(productElevationCm(base({ mount: 'wall', elevation: 145, builderParams: { mountHeight: 120 } }), 230)).toBe(145);
    expect(productElevationCm(base({ elevation: 87 }), 230)).toBe(87);
  });
  it('천장보다 높은 제품은 0에서 멈춘다', () => {
    expect(productElevationCm(base({ mount: 'ceiling', dims: { w: 10, d: 10, h: 300 } }), 230)).toBe(0);
  });
});

describe('itemElevationCm', () => {
  it('item.elevation이 있으면 그 값, 없으면 제품 기본값', () => {
    const p = base({ mount: 'wall', elevation: 145 });
    expect(itemElevationCm({ elevation: 30 }, p, 230)).toBe(30);
    expect(itemElevationCm({}, p, 230)).toBe(145);
    expect(itemElevationCm({ elevation: 0 }, p, 230)).toBe(0);
  });
});
