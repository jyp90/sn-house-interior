import { describe, expect, it } from 'vitest';
import { clearSyncConfig, DEFAULT_SYNC, formatSyncStatus, readSyncConfig, SYNC_KEY, syncCommitMessage, writeSyncConfig } from './sync';

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe('sync config', () => {
  it('기본값', () => {
    expect(readSyncConfig(fakeStorage())).toEqual(DEFAULT_SYNC);
    expect(readSyncConfig(undefined)).toEqual(DEFAULT_SYNC);
    expect(DEFAULT_SYNC).toEqual({ repo: 'jyp90/sn-house-interior', branch: 'main', path: 'home/plan.json', token: '', lastSha: null, lastAt: null });
  });

  it('저장·읽기·지우기', () => {
    const s = fakeStorage();
    const cfg = { ...DEFAULT_SYNC, token: 'ghp_x', lastSha: 'abcdef1234', lastAt: 1_700_000_000_000 };
    expect(writeSyncConfig(cfg, s)).toBe(true);
    expect(JSON.parse(s.map.get(SYNC_KEY)!)).toEqual(cfg);
    expect(readSyncConfig(s)).toEqual(cfg);
    clearSyncConfig(s);
    expect(s.map.has(SYNC_KEY)).toBe(false);
    expect(readSyncConfig(s)).toEqual(DEFAULT_SYNC);
  });

  it('깨진 JSON이나 이상한 값은 기본값', () => {
    expect(readSyncConfig(fakeStorage({ [SYNC_KEY]: '{not json' }))).toEqual(DEFAULT_SYNC);
    expect(readSyncConfig(fakeStorage({ [SYNC_KEY]: '42' }))).toEqual(DEFAULT_SYNC);
    expect(readSyncConfig(fakeStorage({ [SYNC_KEY]: JSON.stringify({ repo: 7, branch: 'dev', lastSha: 5, lastAt: 'x' }) }))).toEqual({ ...DEFAULT_SYNC, branch: 'dev' });
  });

  it('저장소 예외는 무시한다', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readSyncConfig(broken)).toEqual(DEFAULT_SYNC);
    expect(writeSyncConfig(DEFAULT_SYNC, broken)).toBe(false);
    expect(writeSyncConfig(DEFAULT_SYNC, undefined)).toBe(false);
    expect(() => clearSyncConfig(broken)).not.toThrow();
  });
});

describe('formatSyncStatus / syncCommitMessage', () => {
  it('동기화 전후 상태 문구', () => {
    expect(formatSyncStatus(DEFAULT_SYNC)).toBe('마지막 동기화 없음');
    const at = new Date(2026, 9, 10, 9, 5).getTime();
    expect(formatSyncStatus({ lastSha: 'abcdef1234567', lastAt: at })).toBe('마지막 동기화 09:05 · abcdef1');
  });

  it('커밋 메시지', () => {
    expect(syncCommitMessage(new Date(2026, 9, 10, 14, 7))).toBe('chore(plan): sync from app (2026-10-10 14:07)');
  });
});
