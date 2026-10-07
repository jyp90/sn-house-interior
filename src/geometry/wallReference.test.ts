import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Product } from '../model/schema';
import { wallReferenceText } from './wallReference';

const box: Product = {
  id: 'bi', brand: 'custom', model: '', name: '식기세척기', category: 'kitchen',
  dims: { w: 60, d: 60, h: 85 }, variants: [{ id: 'v', label: '기본', colors: {} }],
  builder: 'box', clearances: [], builtIn: true, mount: 'floor',
};

describe('wallReferenceText', () => {
  it('제품의 왼쪽·오른쪽·뒤 면에서 가장 가까운 벽면까지 거리', () => {
    const item = { id: 'i', productId: 'bi', variantId: 'v', x: 100, y: 60, rotation: 0 };
    expect(wallReferenceText(SAMPLE_PLAN, item, box)).toBe('왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm');
  });

  it('벽이 하나도 없으면 안내 문구', () => {
    const item = { id: 'i', productId: 'bi', variantId: 'v', x: 100, y: 60, rotation: 0 };
    expect(wallReferenceText({ ...SAMPLE_PLAN, walls: [] }, item, box)).toBe('가까운 벽 없음');
  });
});
