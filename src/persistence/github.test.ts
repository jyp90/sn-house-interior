import { describe, expect, it } from 'vitest';
import { decodeBase64, encodeBase64, errorForStatus, getFile, GITHUB_ERRORS, putFile, type FetchLike } from './github';

type Call = { url: string; init?: RequestInit };

function fakeFetch(respond: (call: Call) => Response | Promise<Response>): { fetchFn: FetchLike; calls: Call[] } {
  const calls: Call[] = [];
  const fetchFn: FetchLike = (url, init) => {
    const call = { url, init };
    calls.push(call);
    return Promise.resolve(respond(call));
  };
  return { fetchFn, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const REF = { repo: 'jyp90/sn-house-interior', branch: 'main', path: 'home/plan.json' };

describe('base64', () => {
  it('한국어와 이모지를 왕복한다', () => {
    const text = '{"title":"우리 집 🏠","memo":"안방·거실"}\n';
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it('GitHub이 끼워 보내는 줄바꿈을 무시한다', () => {
    const b64 = encodeBase64('가나다라마바사아자차카타파하'.repeat(10));
    const wrapped = b64.replace(/(.{20})/g, '$1\n');
    expect(decodeBase64(wrapped)).toBe('가나다라마바사아자차카타파하'.repeat(10));
  });

  it('긴 본문도 변환한다', () => {
    const text = '한'.repeat(100_000);
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });
});

describe('getFile', () => {
  it('GET 경로·ref·헤더를 보내고 base64를 풀어 돌려준다', async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ content: encodeBase64('{"a":"가"}'), sha: 'abc123', encoding: 'base64' }));
    const r = await getFile(REF, fetchFn);
    expect(r).toEqual({ ok: true, text: '{"a":"가"}', sha: 'abc123' });
    expect(calls[0].url).toBe('https://api.github.com/repos/jyp90/sn-house-interior/contents/home/plan.json?ref=main');
    expect(calls[0].init?.method).toBe('GET');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Accept).toBe('application/vnd.github+json');
    expect(headers.Authorization).toBeUndefined();
  });

  it('토큰이 있을 때만 Authorization을 붙인다', async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ content: '', sha: 's' }));
    await getFile({ ...REF, token: 'ghp_x' }, fetchFn);
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer ghp_x');
  });

  it('상태 코드별 한국어 오류', async () => {
    for (const [status, error] of [
      [401, GITHUB_ERRORS.auth],
      [403, GITHUB_ERRORS.auth],
      [404, GITHUB_ERRORS.notFound],
      [409, GITHUB_ERRORS.conflict],
      [422, GITHUB_ERRORS.conflict],
      [500, 'GitHub 오류 (500)'],
    ] as const) {
      const { fetchFn } = fakeFetch(() => json({ message: 'x' }, status));
      expect(await getFile(REF, fetchFn)).toEqual({ ok: false, error });
    }
    expect(errorForStatus(502)).toBe('GitHub 오류 (502)');
  });

  it('네트워크 오류', async () => {
    const fetchFn: FetchLike = () => Promise.reject(new TypeError('Failed to fetch'));
    expect(await getFile(REF, fetchFn)).toEqual({ ok: false, error: GITHUB_ERRORS.network });
  });

  it('본문이 이상하면 오류', async () => {
    const { fetchFn } = fakeFetch(() => json({ sha: 'x' }));
    expect((await getFile(REF, fetchFn)).ok).toBe(false);
  });
});

describe('putFile', () => {
  it('PUT 본문에 message·content·branch·sha를 담고 새 sha를 돌려준다', async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ content: { sha: 'new456' } }, 200));
    const r = await putFile({ ...REF, token: 't', text: '{"t":"집"}\n', sha: 'old123', message: 'chore(plan): sync from app (2026-10-10 09:30)' }, fetchFn);
    expect(r).toEqual({ ok: true, sha: 'new456' });
    expect(calls[0].url).toBe('https://api.github.com/repos/jyp90/sn-house-interior/contents/home/plan.json');
    expect(calls[0].init?.method).toBe('PUT');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer t');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(calls[0].init?.body as string);
    expect(body).toEqual({ message: 'chore(plan): sync from app (2026-10-10 09:30)', content: encodeBase64('{"t":"집"}\n'), branch: 'main', sha: 'old123' });
    expect(decodeBase64(body.content)).toBe('{"t":"집"}\n');
  });

  it('새 파일이면 sha를 보내지 않는다(201)', async () => {
    const { fetchFn, calls } = fakeFetch(() => json({ content: { sha: 'c1' } }, 201));
    expect(await putFile({ ...REF, token: 't', text: '{}', message: 'm' }, fetchFn)).toEqual({ ok: true, sha: 'c1' });
    expect('sha' in JSON.parse(calls[0].init?.body as string)).toBe(false);
  });

  it('오류 문구', async () => {
    const { fetchFn } = fakeFetch(() => json({}, 409));
    expect(await putFile({ ...REF, token: 't', text: '{}', sha: 's', message: 'm' }, fetchFn)).toEqual({ ok: false, error: GITHUB_ERRORS.conflict });
    const bad = fakeFetch(() => json({}, 401));
    expect(await putFile({ ...REF, token: '', text: '{}', message: 'm' }, bad.fetchFn)).toEqual({ ok: false, error: GITHUB_ERRORS.auth });
    const net: FetchLike = () => Promise.reject(new Error('offline'));
    expect(await putFile({ ...REF, token: 't', text: '{}', message: 'm' }, net)).toEqual({ ok: false, error: GITHUB_ERRORS.network });
  });
});
