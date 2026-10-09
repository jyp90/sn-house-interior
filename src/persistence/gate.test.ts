import { describe, expect, it } from 'vitest';
import {
  GATE_LOCK_MS,
  GATE_MAX_ATTEMPTS,
  GATE_STATE_KEY,
  GATE_UNLOCK_KEY,
  GATE_UNLOCK_MS,
  gateStatus,
  hashPin,
  isGateEnabled,
  isUnlocked,
  markUnlocked,
  PIN_HASH,
  readGateState,
  recordAttempt,
  writeGateState,
} from './gate';

class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.get(k) ?? null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const T0 = 1_700_000_000_000;

describe('hashPin', () => {
  it('0809의 SHA-256이 PIN_HASH와 같고 다른 값은 다르다', async () => {
    expect(await hashPin('0809')).toBe(PIN_HASH);
    expect(await hashPin('0808')).not.toBe(PIN_HASH);
  });
});

describe('recordAttempt / gateStatus', () => {
  it('실패 5회 전까지는 열려 있고 남은 횟수를 센다', () => {
    let s = readGateState(new MemStorage());
    expect(gateStatus(s, T0)).toEqual({ kind: 'open', remaining: GATE_MAX_ATTEMPTS });
    for (let i = 1; i < GATE_MAX_ATTEMPTS; i++) {
      s = recordAttempt(s, false, T0 + i);
      expect(gateStatus(s, T0 + i)).toEqual({ kind: 'open', remaining: GATE_MAX_ATTEMPTS - i });
    }
  });

  it('5회 실패하면 1시간 잠기고, 지나면 카운터가 0으로 돌아온다', () => {
    let s = readGateState(new MemStorage());
    for (let i = 0; i < GATE_MAX_ATTEMPTS; i++) s = recordAttempt(s, false, T0);
    expect(gateStatus(s, T0)).toEqual({ kind: 'locked', until: T0 + GATE_LOCK_MS });
    expect(gateStatus(s, T0 + GATE_LOCK_MS - 1)).toEqual({ kind: 'locked', until: T0 + GATE_LOCK_MS });
    expect(gateStatus(s, T0 + GATE_LOCK_MS)).toEqual({ kind: 'open', remaining: GATE_MAX_ATTEMPTS });
    // 잠금이 지난 뒤 다시 틀리면 1회부터 센다
    s = recordAttempt(s, false, T0 + GATE_LOCK_MS);
    expect(gateStatus(s, T0 + GATE_LOCK_MS)).toEqual({ kind: 'open', remaining: GATE_MAX_ATTEMPTS - 1 });
  });

  it('성공하면 실패 횟수가 초기화된다', () => {
    let s = readGateState(new MemStorage());
    s = recordAttempt(s, false, T0);
    s = recordAttempt(s, false, T0);
    s = recordAttempt(s, true, T0);
    expect(s).toEqual({ fails: 0, lockedUntil: null });
  });

  it('잠긴 동안의 시도는 상태를 바꾸지 않는다', () => {
    let s = readGateState(new MemStorage());
    for (let i = 0; i < GATE_MAX_ATTEMPTS; i++) s = recordAttempt(s, false, T0);
    const locked = s;
    expect(recordAttempt(s, false, T0 + 1)).toEqual(locked);
    expect(recordAttempt(s, true, T0 + 1)).toEqual(locked);
  });
});

describe('storage', () => {
  it('상태를 localStorage에 쓰고 읽으며, 깨진 값은 초기 상태로 본다', () => {
    const st = new MemStorage();
    writeGateState(st, { fails: 3, lockedUntil: T0 });
    expect(JSON.parse(st.getItem(GATE_STATE_KEY)!)).toEqual({ fails: 3, lockedUntil: T0 });
    expect(readGateState(st)).toEqual({ fails: 3, lockedUntil: T0 });
    st.setItem(GATE_STATE_KEY, '{nope');
    expect(readGateState(st)).toEqual({ fails: 0, lockedUntil: null });
    st.setItem(GATE_STATE_KEY, JSON.stringify({ fails: 'x' }));
    expect(readGateState(st)).toEqual({ fails: 0, lockedUntil: null });
    expect(readGateState(undefined)).toEqual({ fails: 0, lockedUntil: null });
  });

  it('잠금 해제는 만료 시각으로 기억하고 7일 뒤에는 다시 묻는다', () => {
    const st = new MemStorage();
    expect(isUnlocked(st, T0)).toBe(false);
    markUnlocked(st, T0);
    expect(st.getItem(GATE_UNLOCK_KEY)).toBe(String(T0 + GATE_UNLOCK_MS));
    expect(isUnlocked(st, T0)).toBe(true);
    expect(isUnlocked(st, T0 + GATE_UNLOCK_MS - 1)).toBe(true);
    expect(isUnlocked(st, T0 + GATE_UNLOCK_MS)).toBe(false);
    expect(isUnlocked(undefined, T0)).toBe(false);
    st.setItem(GATE_UNLOCK_KEY, 'abc');
    expect(isUnlocked(st, T0)).toBe(false);
    st.setItem(GATE_UNLOCK_KEY, '1'); // 옛 v1 값 형식은 만료로 본다
    expect(isUnlocked(st, T0)).toBe(false);
  });
});

describe('isGateEnabled', () => {
  it('프리셋이 있으면 켜지고, 없으면 dev의 ?gate=1에서만 켜진다', () => {
    expect(isGateEnabled({ preset: true, search: '', dev: false })).toBe(true);
    expect(isGateEnabled({ preset: false, search: '', dev: false })).toBe(false);
    expect(isGateEnabled({ preset: false, search: '?gate=1', dev: true })).toBe(true);
    expect(isGateEnabled({ preset: false, search: '?gate=1', dev: false })).toBe(false);
    expect(isGateEnabled({ preset: false, search: '?x=1', dev: true })).toBe(false);
  });
});
