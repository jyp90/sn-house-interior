import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/products';
import { itemColor } from './itemColor';

describe('itemColor', () => {
  it('패널 → 몸체 → 천 → 프레임 → 나무 순으로 대표색을 고른다', () => {
    const fridge = CATALOG.find((p) => p.id === 'samsung-bespoke-4door-sample')!;
    expect(itemColor(fridge, 'glam-navy')).toBe('#2b3446');
    expect(itemColor(CATALOG.find((p) => p.id === 'sofa-3seat')!, 'gray')).toBe('#8a8f98');
    expect(itemColor(fridge, 'missing')).toBe('#e9e6df');
  });
});
