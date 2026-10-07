import type { StoreApi } from 'zustand/vanilla';
import type { Plan } from '../model/schema';
import type { PlanState } from '../model/store';
import { parsePlan } from './parse';

export const STORAGE_KEY = 'homefit:plan:v1';

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadFromStorage(storage: Storage | undefined = defaultStorage()): Plan | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const r = parsePlan(JSON.parse(raw));
    return r.ok ? r.plan : null;
  } catch {
    return null;
  }
}

export function saveToStorage(plan: Plan, storage: Storage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}

export function startAutosave(
  store: StoreApi<PlanState>,
  opts: { storage?: Storage; delayMs?: number; onResult?: (ok: boolean) => void } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = store.subscribe((s, prev) => {
    if (s.plan === prev.plan) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      opts.onResult?.(saveToStorage(store.getState().plan, opts.storage ?? defaultStorage()));
    }, opts.delayMs ?? 500);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
