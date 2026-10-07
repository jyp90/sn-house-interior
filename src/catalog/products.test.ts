import { describe, expect, it } from 'vitest';
import { ProductSchema } from '../model/schema';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { CATALOG, findProduct } from './products';

describe('CATALOG', () => {
  it('모든 제품이 스키마를 통과하고 id가 고유하다', () => {
    for (const p of CATALOG) expect(ProductSchema.safeParse(p).success, p.id).toBe(true);
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);
  });

  it('findProduct는 사용자 정의 제품을 먼저 찾는다', () => {
    const custom = { ...CATALOG[0], id: 'custom-1', name: '내 박스' };
    const plan = { ...SAMPLE_PLAN, customProducts: [custom] };
    expect(findProduct(plan, 'custom-1')?.name).toBe('내 박스');
    expect(findProduct(plan, CATALOG[0].id)?.id).toBe(CATALOG[0].id);
    expect(findProduct(plan, 'nope')).toBeUndefined();
  });
});
