import * as THREE from 'three';
import type { BuilderId, Product, Variant } from '../../model/schema';
import { DEFAULT_CEILING_CM, productElevationCm } from '../elevation';
import { buildBed } from './bed';
import { buildBox } from './box';
import { buildFridge } from './fridge';
import { buildFrontLoader } from './frontLoader';
import { buildSofa } from './sofa';
import { buildTable } from './table';
import { buildTv } from './tv';

export type Builder = (p: Product, v: Variant) => THREE.Group;

const BUILDERS: Partial<Record<BuilderId, Builder>> = {
  box: buildBox,
  fridge: buildFridge,
  'front-loader': buildFrontLoader,
  tv: buildTv,
  sofa: buildSofa,
  bed: buildBed,
  table: buildTable,
};

export function buildProduct(p: Product, variantId: string): THREE.Group {
  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0];
  return (BUILDERS[p.builder] ?? buildBox)(p, variant);
}

// 제품 기본 설치 높이. 평면이 없는 곳(테스트·카탈로그)용; 화면은 itemElevationCm을 쓴다
export function mountHeightCm(p: Product): number {
  return productElevationCm(p, DEFAULT_CEILING_CM);
}

// 공유 재질(parts.material 캐시)은 해제하지 않고 지오메트리만 해제한다
export function disposeObject(o: THREE.Object3D): void {
  o.traverse((child) => {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  });
}
