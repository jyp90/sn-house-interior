import type { Item, Plan, Product } from '../model/schema';
import { wallDistances } from './distance';
import { itemObb } from './obb';
import { planWallObbs } from './walls';

const SIDES = [
  ['left', '왼쪽'],
  ['right', '오른쪽'],
  ['back', '뒤'],
] as const;

// 업체에 "벽 기준 위치"로 전달하는 문구: 제품 면에서 가장 가까운 벽면까지
export function wallReferenceText(plan: Plan, item: Item, product: Product): string {
  const rays = wallDistances(itemObb(item.x, item.y, item.rotation, product.dims.w, product.dims.d), planWallObbs(plan));
  const parts = SIDES.flatMap(([dir, label]) => {
    const r = rays.find((x) => x.dir === dir);
    return r ? [`${label} 벽까지 ${r.distance}cm`] : [];
  });
  return parts.length > 0 ? parts.join(', ') : '가까운 벽 없음';
}
