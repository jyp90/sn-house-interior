import { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { PlanState } from './store';

export const PlanStoreContext = createContext<StoreApi<PlanState> | null>(null);

export function usePlanStore(): StoreApi<PlanState> {
  const store = useContext(PlanStoreContext);
  if (!store) throw new Error('PlanStoreContext.Provider가 없습니다');
  return store;
}

export function usePlan<T>(selector: (s: PlanState) => T): T {
  return useStore(usePlanStore(), selector);
}
