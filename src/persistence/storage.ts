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

export type ReadStoredPlanResult =
  | { status: 'empty' }
  | { status: 'ok'; plan: Plan }
  | { status: 'invalid'; raw: string; error: string };

export function readStoredPlan(storage: Storage | undefined = defaultStorage()): ReadStoredPlanResult {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(STORAGE_KEY);
  } catch {
    return { status: 'empty' };
  }
  if (!raw) return { status: 'empty' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return { status: 'invalid', raw, error: e instanceof Error ? e.message : 'JSON 형식이 아닙니다' };
  }
  const r = parsePlan(json);
  return r.ok ? { status: 'ok', plan: r.plan } : { status: 'invalid', raw, error: r.error };
}

export function loadFromStorage(storage: Storage | undefined = defaultStorage()): Plan | null {
  const r = readStoredPlan(storage);
  return r.status === 'ok' ? r.plan : null;
}

export function backupInvalidPlan(
  raw: string,
  storage: Storage | undefined = defaultStorage(),
  now: number = Date.now(),
): string | null {
  const key = `${STORAGE_KEY}:backup-${now}`;
  try {
    if (!storage) return null;
    storage.setItem(key, raw);
    return key;
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
  opts: { storage?: Storage; delayMs?: number; onResult?: (ok: boolean) => void; target?: EventTarget } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const save = () => {
    timer = undefined;
    opts.onResult?.(saveToStorage(store.getState().plan, opts.storage ?? defaultStorage()));
  };
  const unsubscribe = store.subscribe((s, prev) => {
    if (s.plan === prev.plan) return;
    clearTimeout(timer);
    timer = setTimeout(save, opts.delayMs ?? 500);
  });
  const target = opts.target ?? (typeof globalThis.addEventListener === 'function' ? globalThis : undefined);
  const onPageHide = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    save();
  };
  target?.addEventListener('pagehide', onPageHide);
  return () => {
    clearTimeout(timer);
    unsubscribe();
    target?.removeEventListener('pagehide', onPageHide);
  };
}
