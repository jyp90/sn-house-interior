import { describe, expect, it } from 'vitest';
import { requestUpdate, updateBannerText, waitForRestart } from './selfUpdateClient';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('updateBannerText', () => {
  it('describes each result in Korean', () => {
    expect(updateBannerText({ status: 'up-to-date', head: 'abc1234' })).toEqual({ kind: 'info', text: '이미 최신 코드입니다 (abc1234).' });
    expect(updateBannerText({ status: 'updated', from: 'a', to: 'b', commits: 2, depsInstalled: true }).text).toContain('a → b, 커밋 2개, 패키지 설치함');
    expect(updateBannerText({ status: 'dirty' }).kind).toBe('error');
    expect(updateBannerText({ status: 'error', message: 'x' }).text).toBe('업데이트 실패: x');
  });
});

describe('requestUpdate', () => {
  it('posts with the custom header and returns the body', async () => {
    let init: RequestInit | undefined;
    const r = await requestUpdate(async (_url, i) => {
      init = i;
      return json({ status: 'up-to-date', head: 'abc', boot: 1 });
    });
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['x-homefit-update']).toBe('1');
    expect(r).toEqual({ status: 'up-to-date', head: 'abc', boot: 1 });
  });

  it('turns a network failure into an error result', async () => {
    const r = await requestUpdate(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(r.status).toBe('error');
  });
});

describe('waitForRestart', () => {
  const clock = () => {
    let t = 0;
    return { now: () => t, sleep: async (ms: number) => void (t += ms) };
  };

  it('waits through failures until the boot id changes', async () => {
    const replies: (Response | Error)[] = [json({ boot: 1 }), new Error('down'), json({}, 502), json({ boot: 2 })];
    const fetchFn = async () => {
      const r = replies.shift()!;
      if (r instanceof Error) throw r;
      return r;
    };
    expect(await waitForRestart(1, { fetchFn, ...clock() })).toBe(true);
    expect(replies).toHaveLength(0);
  });

  it('gives up after the timeout', async () => {
    const fetchFn = async () => json({ boot: 1 });
    expect(await waitForRestart(1, { fetchFn, timeoutMs: 5000, ...clock() })).toBe(false);
  });
});
