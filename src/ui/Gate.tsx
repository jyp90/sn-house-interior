import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import {
  gateStatus,
  hashPin,
  isUnlocked,
  markUnlocked,
  PIN_HASH,
  readGateState,
  recordAttempt,
  writeGateState,
} from '../persistence/gate';

function local(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}
function session(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export function remainingLabel(until: number, now: number): string {
  const min = Math.max(1, Math.ceil((until - now) / 60_000));
  return `${min}분 뒤 다시 시도할 수 있습니다.`;
}

/** 진입 PIN 잠금 화면(스펙 §42). 탭 안에서 한 번 풀면 sessionStorage로 기억한다 */
export function Gate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => isUnlocked(session()));
  const [state, setState] = useState(() => readGateState(local()));
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const status = gateStatus(state, now);

  // 잠긴 동안 남은 시간을 1분마다 갱신
  useEffect(() => {
    if (unlocked || status.kind !== 'locked') return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [unlocked, status.kind]);

  if (unlocked) return <>{children}</>;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = Date.now();
    setNow(t);
    if (gateStatus(state, t).kind === 'locked') return;
    const ok = (await hashPin(pin)) === PIN_HASH;
    const next = recordAttempt(state, ok, t);
    writeGateState(local(), next);
    setState(next);
    setPin('');
    if (ok) {
      markUnlocked(session());
      setUnlocked(true);
    } else {
      setWrong(true);
    }
  };

  const locked = status.kind === 'locked';
  const message =
    status.kind === 'locked'
      ? `${remainingLabel(status.until, now)} 5회 틀려 1시간 동안 잠겼습니다.`
      : wrong
        ? `비밀번호가 틀렸습니다. ${status.remaining}회 남았습니다.`
        : '';
  return (
    <div className="gate" data-testid="gate">
      <form className="gate-card" onSubmit={submit}>
        <h1 className="gate-title">우리 집 인테리어</h1>
        <p className="gate-hint">비밀번호를 입력하세요.</p>
        <input
          className="gate-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          aria-label="비밀번호"
          maxLength={8}
          autoFocus
          disabled={locked}
          value={pin}
          onChange={(e) => setPin(e.target.value)}
        />
        <button type="submit" className="gate-submit" disabled={locked || pin.length === 0}>
          들어가기
        </button>
        <p className="gate-status" role="status" aria-live="polite">
          {message}
        </p>
      </form>
    </div>
  );
}
