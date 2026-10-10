import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
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
    return undefined; // 사생활 보호 모드 등에서 접근 자체가 throw
  }
}

function remainingLabel(until: number, now: number): string {
  const min = Math.max(1, Math.ceil((until - now) / 60_000));
  return `${min}분 뒤 다시 시도할 수 있습니다.`;
}

/** 진입 PIN 잠금 화면(스펙 §42, §46). 한 번 풀면 localStorage 만료 시각으로 7일 동안 기억한다 */
export function Gate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(() => isUnlocked(local(), Date.now()));
  const [state, setState] = useState(() => readGateState(local()));
  const [pin, setPin] = useState('');
  const [wrong, setWrong] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const status = gateStatus(state, now);
  const busy = useRef(false);


  // 잠긴 동안 남은 시간을 1분마다 갱신
  useEffect(() => {
    if (unlocked || status.kind !== 'locked') return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [unlocked, status.kind]);

  if (unlocked) return <>{children}</>;

  // 폼 제출과 입력창 blur(폰에서 키보드를 닫을 때) 둘 다 여기로 온다. 동시에 두 번 세지 않도록 진행 중이면 무시한다
  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy.current || pin.length === 0) return;
    const t = Date.now();
    setNow(t);
    if (gateStatus(state, t).kind === 'locked') return;
    busy.current = true;
    try {
      const ok = (await hashPin(pin)) === PIN_HASH;
      const next = recordAttempt(state, ok, t);
      writeGateState(local(), next);
      setState(next);
      setPin('');
      if (ok) {
        markUnlocked(local(), t);
        setUnlocked(true);
      } else {
        setWrong(true);
      }
    } finally {
      busy.current = false;
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
          enterKeyHint="done"
          onChange={(e) => setPin(e.target.value)}
          onBlur={() => void submit()}
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
