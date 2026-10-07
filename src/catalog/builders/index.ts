import * as THREE from 'three';
import type { BuilderId, Product, Variant } from '../../model/schema';
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

export function mountHeightCm(p: Product): number {
  if (p.mount !== 'wall') return 0;
  return (p.builderParams?.mountHeight as number | undefined) ?? 90;
}

// 공유 재질(parts.material 캐시)은 해제하지 않고 지오메트리만 해제한다
export function disposeObject(o: THREE.Object3D): void {
  o.traverse((child) => {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  });
}
