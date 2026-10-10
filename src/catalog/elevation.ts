import type { Item, Plan, Product } from '../model/schema';

export const DEFAULT_CEILING_CM = 230;
const DEFAULT_WALL_MOUNT_CM = 90;

// 천장 높이 = 평면 벽 높이의 최댓값(벽이 없으면 230)
export function ceilingHeightCm(plan: Pick<Plan, 'walls'>): number {
  return plan.walls.length > 0 ? Math.max(...plan.walls.map((w) => w.height)) : DEFAULT_CEILING_CM;
}

// 제품 기본 설치 높이(스펙 §20.1 우선순위)
export function productElevationCm(product: Product, ceiling: number): number {
  if (product.elevation !== undefined) return product.elevation;
  const legacy = product.builderParams?.mountHeight;
  if (typeof legacy === 'number') return legacy;
  if (product.mount === 'wall') return DEFAULT_WALL_MOUNT_CM;
  if (product.mount === 'ceiling') return Math.max(0, ceiling - product.dims.h);
  return 0;
}

export function itemElevationCm(item: Pick<Item, 'elevation'>, product: Product, ceiling: number): number {
  return item.elevation ?? productElevationCm(product, ceiling);
}
