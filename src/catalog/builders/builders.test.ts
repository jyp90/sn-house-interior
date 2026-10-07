import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Product } from '../../model/schema';
import { CATALOG } from '../products';
import { buildProduct, mountHeightCm } from './index';

function bounds(p: Product) {
  const g = buildProduct(p, p.variants[0].id);
  g.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(g);
}

describe('buildProduct', () => {
  for (const p of CATALOG) {
    it(`${p.id}: 경계 상자가 실제 치수와 같고 바닥에 놓인다`, () => {
      const b = bounds(p);
      const size = b.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(p.dims.w / 100, 4);
      expect(size.y).toBeCloseTo(p.dims.h / 100, 4);
      expect(size.z).toBeCloseTo(p.dims.d / 100, 4);
      expect(b.min.y).toBeCloseTo(0, 4);
      expect(b.min.x).toBeCloseTo(-p.dims.w / 200, 4);
      expect(b.min.z).toBeCloseTo(-p.dims.d / 200, 4);
    });
  }

  it('builder가 아직 없는 제품은 박스로 그린다', () => {
    const p: Product = { ...CATALOG[0], id: 'ac', builder: 'stand-ac', dims: { w: 40, d: 40, h: 180 } };
    const size = bounds(p).getSize(new THREE.Vector3());
    expect(size.y).toBeCloseTo(1.8, 4);
  });

  it('variant id가 없으면 첫 번째 variant로 그린다', () => {
    expect(() => buildProduct(CATALOG[0], 'missing')).not.toThrow();
  });

  it('벽걸이 제품만 설치 높이를 갖는다', () => {
    expect(mountHeightCm(CATALOG.find((p) => p.mount === 'wall')!)).toBe(90);
    expect(mountHeightCm(CATALOG[0])).toBe(0);
  });
});
