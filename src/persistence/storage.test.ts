import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { createPlanStore } from '../model/store';
import { backupInvalidPlan, loadFromStorage, readStoredPlan, saveToStorage, startAutosave, STORAGE_KEY } from './storage';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

function throwingStorage(): Storage {
  const s = memoryStorage();
  s.getItem = () => { throw new Error('SecurityError'); };
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  return s;
}

afterEach(() => vi.useRealTimers());

describe('storage', () => {
  it('저장한 평면을 다시 읽는다', () => {
    const st = memoryStorage();
    expect(saveToStorage(SAMPLE_PLAN, st)).toBe(true);
    expect(loadFromStorage(st)).toEqual(SAMPLE_PLAN);
  });

  it('저장소가 throw하면 null/false를 돌려준다', () => {
    const st = throwingStorage();
    expect(loadFromStorage(st)).toBeNull();
    expect(saveToStorage(SAMPLE_PLAN, st)).toBe(false);
  });

  it('깨진 데이터는 null', () => {
    const st = memoryStorage();
    st.setItem(STORAGE_KEY, '{not json');
    expect(loadFromStorage(st)).toBeNull();
  });

  it('autosave는 디바운스 후 마지막 상태만 저장하고 결과를 알린다', () => {
    vi.useFakeTimers();
    const st = memoryStorage();
    const store = createPlanStore(SAMPLE_PLAN);
    const results: boolean[] = [];
    const stop = startAutosave(store, { storage: st, delayMs: 500, onResult: (ok) => results.push(ok) });
    const id = store.getState().addItem('p', 'v', { x: 0, y: 0 });
    store.getState().updateItem(id, { x: 50 });
    vi.advanceTimersByTime(499);
    expect(st.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(1);
    expect(loadFromStorage(st)?.items[0].x).toBe(50);
    expect(results).toEqual([true]);
    stop();
  });

  it('autosave 저장 실패를 알린다', () => {
    vi.useFakeTimers();
    const store = createPlanStore(SAMPLE_PLAN);
    const results: boolean[] = [];
    startAutosave(store, { storage: throwingStorage(), onResult: (ok) => results.push(ok) });
    store.getState().addItem('p', 'v', { x: 0, y: 0 });
    vi.advanceTimersByTime(500);
    expect(results).toEqual([false]);
  });

  it('pagehide 시 대기 중인 저장을 즉시 실행한다', () => {
    vi.useFakeTimers();
    const st = memoryStorage();
    const store = createPlanStore(SAMPLE_PLAN);
    const target = new EventTarget();
    const results: boolean[] = [];
    const stop = startAutosave(store, { storage: st, delayMs: 500, target, onResult: (ok) => results.push(ok) });
    const id = store.getState().addItem('p', 'v', { x: 0, y: 0 });
    store.getState().updateItem(id, { x: 50 });
    target.dispatchEvent(new Event('pagehide'));
    expect(loadFromStorage(st)?.items[0].x).toBe(50);
    expect(results).toEqual([true]);
    stop();
  });
});

describe('readStoredPlan', () => {
  it('비어있으면 empty', () => {
    expect(readStoredPlan(memoryStorage())).toEqual({ status: 'empty' });
  });

  it('유효한 평면이면 ok', () => {
    const st = memoryStorage();
    saveToStorage(SAMPLE_PLAN, st);
    expect(readStoredPlan(st)).toEqual({ status: 'ok', plan: SAMPLE_PLAN });
  });

  it('스키마가 깨졌으면 invalid를 raw와 함께 돌려준다', () => {
    const st = memoryStorage();
    const raw = JSON.stringify({ version: 1 });
    st.setItem(STORAGE_KEY, raw);
    const r = readStoredPlan(st);
    expect(r.status).toBe('invalid');
    if (r.status === 'invalid') {
      expect(r.raw).toBe(raw);
      expect(r.error.length).toBeGreaterThan(0);
    }
  });

  it('storage가 throw하면 empty', () => {
    expect(readStoredPlan(throwingStorage())).toEqual({ status: 'empty' });
  });
});

describe('backupInvalidPlan', () => {
  it('raw 문자열을 백업 키로 저장하고 키를 돌려준다', () => {
    const st = memoryStorage();
    const key = backupInvalidPlan('{"version":1}', st, 12345);
    expect(key).toBe(`${STORAGE_KEY}:backup-12345`);
    expect(st.getItem(key!)).toBe('{"version":1}');
  });

  it('storage가 throw하면 null', () => {
    expect(backupInvalidPlan('x', throwingStorage(), 1)).toBeNull();
  });
});
