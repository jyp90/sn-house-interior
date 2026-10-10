import * as THREE from 'three';
import type { BuilderId, Product, Variant } from '../../model/schema';
import { buildBasin } from './basin';
import { buildBed } from './bed';
import { buildBox } from './box';
import { buildBuiltInAppliance } from './builtInAppliance';
import { buildCabinetRun } from './cabinetRun';
import { buildCeilingAc } from './ceilingAc';
import { buildChair } from './chair';
import { buildCornerCabinet } from './cornerCabinet';
import { buildFridge } from './fridge';
import { buildFrontLoader } from './frontLoader';
import { buildShower } from './shower';
import { buildSofa } from './sofa';
import { buildStandAc } from './standAc';
import { buildTable } from './table';
import { buildToilet } from './toilet';
import { buildTv } from './tv';
import { buildWardrobe } from './wardrobe';

type Builder = (p: Product, v: Variant) => THREE.Group;

const BUILDERS: Record<BuilderId, Builder> = {
  box: buildBox,
  fridge: buildFridge,
  'front-loader': buildFrontLoader,
  tv: buildTv,
  sofa: buildSofa,
  bed: buildBed,
  table: buildTable,
  'stand-ac': buildStandAc,
  'built-in-appliance': buildBuiltInAppliance,
  'cabinet-run': buildCabinetRun,
  'ceiling-ac': buildCeilingAc,
  chair: buildChair,
  'corner-cabinet': buildCornerCabinet,
  wardrobe: buildWardrobe,
  toilet: buildToilet,
  basin: buildBasin,
  shower: buildShower,
};

export function buildProduct(p: Product, variantId: string): THREE.Group {
  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0];
  return (BUILDERS[p.builder] ?? buildBox)(p, variant);
}

// 공유 재질(parts.material 캐시)은 해제하지 않고 지오메트리만 해제한다
export function disposeObject(o: THREE.Object3D): void {
  o.traverse((child) => {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  });
}
