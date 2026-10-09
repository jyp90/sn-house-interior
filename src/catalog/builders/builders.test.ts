import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { BuilderId, Product } from '../../model/schema';
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
    const p: Product = { ...CATALOG[0], id: 'ac', builder: 'nope' as BuilderId, dims: { w: 40, d: 40, h: 180 } };
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

  const countNamed = (o: THREE.Object3D, name: string) => {
    let n = 0;
    o.traverse((c) => {
      if (c.name === name) n++;
    });
    return n;
  };

  it('냉장고는 도어 행이 만나는 곳마다 손잡이 홈이 있고 경계 상자는 그대로다', () => {
    const base = CATALOG.find((p) => p.builder === 'fridge')!;
    for (const [split, count] of [['4door', 4], ['2door', 2], ['1door', 1]] as const) {
      const p: Product = { ...base, builderParams: { ...base.builderParams, split } };
      const size = bounds(p).getSize(new THREE.Vector3());
      expect(countNamed(buildProduct(p, p.variants[0].id), 'handle-groove')).toBe(count);
      expect(size.x).toBeCloseTo(p.dims.w / 100, 4);
      expect(size.y).toBeCloseTo(p.dims.h / 100, 4);
      expect(size.z).toBeCloseTo(p.dims.d / 100, 4);
    }
  });

  it('드럼세탁기는 상단 조작부가 있다', () => {
    const p = CATALOG.find((x) => x.builder === 'front-loader')!;
    expect(countNamed(buildProduct(p, p.variants[0].id), 'control-panel')).toBe(1);
  });

  it('하부장은 상판과 문짝 수만큼의 문이 있고, 싱크가 있으면 싱크 홈이 있다', () => {
    const p = CATALOG.find((x) => x.id === 'samsung-sink-base-240-sample')!;
    const g = buildProduct(p, p.variants[0].id);
    expect(countNamed(g, 'door')).toBe(4);
    expect(countNamed(g, 'counter')).toBe(1);
    expect(countNamed(g, 'sink')).toBe(1);
  });

  it('상부장은 상판이 없고 벽걸이 기본 높이 145', () => {
    const p = CATALOG.find((x) => x.id === 'samsung-upper-cabinet-240-sample')!;
    expect(countNamed(buildProduct(p, p.variants[0].id), 'counter')).toBe(0);
    expect(mountHeightCm(p)).toBe(145);
  });

  it('빌트인 가전은 전면 패널만 변형 색이고, 인덕션은 윗면 유리가 있다', () => {
    const dw = CATALOG.find((x) => x.id === 'samsung-dishwasher-sample')!;
    expect(countNamed(buildProduct(dw, dw.variants[0].id), 'front-panel')).toBe(1);
    const hob = CATALOG.find((x) => x.id === 'samsung-induction-sample')!;
    expect(countNamed(buildProduct(hob, hob.variants[0].id), 'cooktop-glass')).toBe(1);
    expect(mountHeightCm(hob)).toBe(87);
  });

  it('스탠드·천장형 에어컨은 토출구가 있고 천장형은 ceiling 기본 높이', () => {
    const stand = CATALOG.find((x) => x.id === 'samsung-stand-ac-sample')!;
    expect(countNamed(buildProduct(stand, stand.variants[0].id), 'vent')).toBe(1);
    const ceil = CATALOG.find((x) => x.id === 'samsung-ceiling-ac-sample')!;
    expect(countNamed(buildProduct(ceil, ceil.variants[0].id), 'vent')).toBe(4);
    expect(mountHeightCm(ceil)).toBe(230 - 25);
  });
});
