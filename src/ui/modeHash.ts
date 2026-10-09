import { MODES } from './modes';
import type { Mode } from './uiStore';

// 상단 탭(모드)을 URL hash에 반영한다. GitHub Pages 정적 호스팅이라 path 대신 hash를 쓴다.
export function modeFromHash(hash: string): Mode | null {
  const key = hash.startsWith('#') ? hash.slice(1) : hash;
  const found = MODES.find(([m]) => m === key);
  return found ? found[0] : null;
}

export function modeToHash(mode: Mode): string {
  return `#${mode}`;
}

// 초기 hash → 모드 복원, 모드 변경 → hash 갱신(replaceState: 탭 전환마다 히스토리를 쌓지 않음), 뒤로가기 → 모드 반영
export function syncModeWithHash(ui: { getState(): { mode: Mode; setMode(m: Mode): void }; subscribe(fn: (s: { mode: Mode }, prev: { mode: Mode }) => void): () => void }): void {
  const initial = modeFromHash(window.location.hash);
  if (initial && initial !== ui.getState().mode) ui.getState().setMode(initial);
  else if (!initial) window.history.replaceState(null, '', modeToHash(ui.getState().mode));
  ui.subscribe((s, prev) => {
    if (s.mode !== prev.mode && window.location.hash !== modeToHash(s.mode)) {
      window.history.replaceState(null, '', modeToHash(s.mode));
    }
  });
  window.addEventListener('hashchange', () => {
    const m = modeFromHash(window.location.hash);
    if (m && m !== ui.getState().mode) ui.getState().setMode(m);
  });
}
