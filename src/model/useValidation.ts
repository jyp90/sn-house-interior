import { findProduct } from '../catalog/products';
import { validatePlan, type ItemStatus } from '../validation/validate';
import type { Plan } from './schema';
import { usePlan } from './StoreContext';

// 평면 객체 정체성을 키로 한 캐시: 2D·3D·속성 패널·목록 패널이 같은 평면에 대해 validatePlan을 한 번만 돌린다 (spec §30)
const cache = new WeakMap<Plan, Record<string, ItemStatus>>();

export function planValidation(plan: Plan): Record<string, ItemStatus> {
  let status = cache.get(plan);
  if (!status) {
    status = validatePlan(plan, (id) => findProduct(plan, id));
    cache.set(plan, status);
  }
  return status;
}

export function useValidation(): Record<string, ItemStatus> {
  return planValidation(usePlan((s) => s.plan));
}
