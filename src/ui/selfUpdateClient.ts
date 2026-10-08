import { UPDATE_PATH, type UpdateResult } from '../devserver/selfUpdate';

export type UpdateResponse = UpdateResult & { boot?: number };

export function updateBannerText(r: UpdateResponse): { kind: 'info' | 'error'; text: string } {
  switch (r.status) {
    case 'up-to-date':
      return { kind: 'info', text: `이미 최신 코드입니다 (${r.head}).` };
    case 'updated':
      return {
        kind: 'info',
        text: `새 코드를 받았습니다 (${r.from} → ${r.to}, 커밋 ${r.commits}개${r.depsInstalled ? ', 패키지 설치함' : ''}).\n서버를 다시 시작한 뒤 화면을 새로고침합니다…`,
      };
    case 'dirty':
      return { kind: 'error', text: '커밋하지 않은 코드 변경이 있어 업데이트하지 않았습니다. 터미널에서 정리한 뒤 다시 누르세요.' };
    case 'error':
      return { kind: 'error', text: `업데이트 실패: ${r.message}` };
  }
}

export async function requestUpdate(fetchFn: typeof fetch = fetch): Promise<UpdateResponse> {
  try {
    const res = await fetchFn(UPDATE_PATH, { method: 'POST', headers: { 'x-homefit-update': '1' } });
    const body = (await res.json()) as UpdateResponse;
    return body;
  } catch (e) {
    return { status: 'error', message: `서버에 연결하지 못했습니다 (${String(e)})` };
  }
}

// 서버가 재시작해 boot 값이 바뀔 때까지 기다린다. 재시작 중에는 요청이 실패하므로 무시하고 다시 묻는다.
export async function waitForRestart(
  bootBefore: number | undefined,
  opts: { fetchFn?: typeof fetch; intervalMs?: number; timeoutMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<boolean> {
  const fetchFn = opts.fetchFn ?? fetch;
  const intervalMs = opts.intervalMs ?? 1000;
  const now = opts.now ?? Date.now;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const deadline = now() + (opts.timeoutMs ?? 90_000);
  while (now() < deadline) {
    await sleep(intervalMs);
    try {
      const res = await fetchFn(UPDATE_PATH, { cache: 'no-store' });
      if (res.ok) {
        const { boot } = (await res.json()) as { boot?: number };
        if (boot !== undefined && boot !== bootBefore) return true;
      }
    } catch {
      // 재시작 중
    }
  }
  return false;
}
