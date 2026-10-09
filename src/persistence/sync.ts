// GitHub 동기화 설정(스펙 §45.1): 이 기기 브라우저의 localStorage에만 둔다. 토큰은 Plan·PNG/PDF·번들·커밋 어디에도 들어가지 않는다.
import { defaultStorage } from './storage';

export const SYNC_KEY = 'homefit:sync:v1';

export type SyncConfig = {
  repo: string;
  branch: string;
  path: string;
  token: string;
  lastSha: string | null;
  lastAt: number | null;
};

export const DEFAULT_SYNC: SyncConfig = {
  repo: 'jyp90/sn-house-interior',
  branch: 'main',
  path: 'home/plan.json',
  token: '',
  lastSha: null,
  lastAt: null,
};

export const REMOTE_CHANGED_TEXT = 'GitHub에 새 평면이 있습니다. 「동기화」에서 불러오세요.';
export const SYNC_TOKEN_HELP = '이 기기 브라우저에만 저장됩니다. 저장소 contents 쓰기 권한의 fine-grained 토큰';

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const str = (v: unknown, fallback: string) => (typeof v === 'string' ? v : fallback);

export function readSyncConfig(storage: StorageLike | undefined = defaultStorage()): SyncConfig {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(SYNC_KEY);
  } catch {
    return { ...DEFAULT_SYNC };
  }
  if (!raw) return { ...DEFAULT_SYNC };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...DEFAULT_SYNC };
  }
  if (typeof parsed !== 'object' || parsed === null) return { ...DEFAULT_SYNC };
  const p = parsed as Record<string, unknown>;
  return {
    repo: str(p.repo, DEFAULT_SYNC.repo),
    branch: str(p.branch, DEFAULT_SYNC.branch),
    path: str(p.path, DEFAULT_SYNC.path),
    token: str(p.token, DEFAULT_SYNC.token),
    lastSha: typeof p.lastSha === 'string' ? p.lastSha : null,
    lastAt: typeof p.lastAt === 'number' && Number.isFinite(p.lastAt) ? p.lastAt : null,
  };
}

export function writeSyncConfig(cfg: SyncConfig, storage: StorageLike | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SYNC_KEY, JSON.stringify(cfg));
    return true;
  } catch {
    return false;
  }
}

export function clearSyncConfig(storage: StorageLike | undefined = defaultStorage()): void {
  try {
    storage?.removeItem(SYNC_KEY);
  } catch {
    // 저장소를 못 쓰는 환경(사생활 창 등)은 조용히 넘어간다
  }
}

const two = (n: number) => String(n).padStart(2, '0');

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

export function formatSyncStatus(cfg: Pick<SyncConfig, 'lastSha' | 'lastAt'>): string {
  if (!cfg.lastSha || cfg.lastAt === null) return '마지막 동기화 없음';
  const d = new Date(cfg.lastAt);
  return `마지막 동기화 ${two(d.getHours())}:${two(d.getMinutes())} · ${shortSha(cfg.lastSha)}`;
}

export function syncCommitMessage(date: Date): string {
  const stamp = `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`;
  return `chore(plan): sync from app (${stamp})`;
}
