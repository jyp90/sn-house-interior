// 진입 비밀번호(PIN) 잠금(스펙 §42). 정적 사이트라 해시·실패 횟수가 브라우저에 있다: 가족용 가림막이지 보안 장치가 아니다.
// React 없이 순수 함수만. 화면은 ui/Gate.tsx.

export const GATE_MAX_ATTEMPTS = 5;
export const GATE_LOCK_MS = 60 * 60 * 1000;
export const GATE_STATE_KEY = 'homefit:gate:v1';
export const GATE_UNLOCK_KEY = 'homefit:gate:unlocked:v2';
/** 한 번 맞히면 이 기기 브라우저에서 7일 동안 다시 묻지 않는다(스펙 §46.2) */
export const GATE_UNLOCK_MS = 7 * 24 * 60 * 60 * 1000;
/** SHA-256('0809') hex. PIN 자체는 번들에 두지 않는다 */
export const PIN_HASH = '3bd62f7f9ccb2821f5330bd3a68629ed8b8a1a19370adf7d74636e76a698d430';

interface GateState {
  fails: number;
  lockedUntil: number | null;
}

type GateStatus = { kind: 'open'; remaining: number } | { kind: 'locked'; until: number };

const EMPTY: GateState = { fails: 0, lockedUntil: null };

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function gateStatus(state: GateState, now: number): GateStatus {
  if (state.lockedUntil !== null) {
    if (now < state.lockedUntil) return { kind: 'locked', until: state.lockedUntil };
    return { kind: 'open', remaining: GATE_MAX_ATTEMPTS }; // 잠금 만료: 카운터는 다음 시도에서 0부터
  }
  return { kind: 'open', remaining: GATE_MAX_ATTEMPTS - state.fails };
}

export function recordAttempt(state: GateState, ok: boolean, now: number): GateState {
  const status = gateStatus(state, now);
  if (status.kind === 'locked') return state;
  if (ok) return EMPTY;
  const fails = (state.lockedUntil !== null ? 0 : state.fails) + 1;
  if (fails >= GATE_MAX_ATTEMPTS) return { fails, lockedUntil: now + GATE_LOCK_MS };
  return { fails, lockedUntil: null };
}

export function readGateState(storage: Storage | undefined): GateState {
  try {
    const raw = storage?.getItem(GATE_STATE_KEY);
    if (!raw) return EMPTY;
    const j: unknown = JSON.parse(raw);
    if (typeof j !== 'object' || j === null) return EMPTY;
    const { fails, lockedUntil } = j as Record<string, unknown>;
    if (typeof fails !== 'number' || !Number.isFinite(fails)) return EMPTY;
    if (lockedUntil !== null && (typeof lockedUntil !== 'number' || !Number.isFinite(lockedUntil))) return EMPTY;
    return { fails, lockedUntil: lockedUntil as number | null };
  } catch {
    return EMPTY;
  }
}

export function writeGateState(storage: Storage | undefined, state: GateState): void {
  try {
    storage?.setItem(GATE_STATE_KEY, JSON.stringify(state));
  } catch {
    /* 저장 불가(사생활 보호 모드 등): 새로고침하면 횟수가 초기화될 뿐 */
  }
}

export function isUnlocked(storage: Storage | undefined, now: number): boolean {
  try {
    const raw = storage?.getItem(GATE_UNLOCK_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && now < until;
  } catch {
    return false;
  }
}

export function markUnlocked(storage: Storage | undefined, now: number): void {
  try {
    storage?.setItem(GATE_UNLOCK_KEY, String(now + GATE_UNLOCK_MS));
  } catch {
    /* 저장 불가: 새로고침마다 다시 묻는다 */
  }
}

/** 우리 집 프리셋이 실리는 빌드(dev·Pages)에서 켠다. 테스트·HOMEFIT_SAMPLE=1은 프리셋이 null → 꺼짐. dev에서는 `?gate=1`로 강제(e2e용) */
export function isGateEnabled(o: { preset: boolean; search: string; dev: boolean }): boolean {
  if (o.preset) return true;
  return o.dev && new URLSearchParams(o.search).get('gate') === '1';
}
