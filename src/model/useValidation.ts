import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { validatePlan, type ItemStatus } from '../validation/validate';
import { usePlan } from './StoreContext';

export function useValidation(): Record<string, ItemStatus> {
  const plan = usePlan((s) => s.plan);
  return useMemo(() => validatePlan(plan, (id) => findProduct(plan, id)), [plan]);
}
