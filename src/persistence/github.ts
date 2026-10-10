// GitHub Contents API로 저장소의 파일 하나를 읽고 쓴다(스펙 §45.1). React 없음, fetch 주입 가능.
// 토큰은 호출 인자로만 받고 어디에도 남기지 않는다.

const GITHUB_API = 'https://api.github.com';

type GitHubFileRef = { repo: string; branch: string; path: string; token?: string };
type GetFileResult = { ok: true; text: string; sha: string } | { ok: false; error: string };
type PutFileResult = { ok: true; sha: string } | { ok: false; error: string };
type PutFileInput = GitHubFileRef & { token: string; text: string; sha?: string; message: string };
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const GITHUB_ERRORS = {
  auth: '토큰이 없거나 권한이 없습니다',
  notFound: '저장소나 파일을 찾을 수 없습니다',
  conflict: 'GitHub의 파일이 바뀌었습니다. 먼저 불러오세요',
  network: 'GitHub에 연결하지 못했습니다',
} as const;

export function errorForStatus(status: number): string {
  if (status === 401 || status === 403) return GITHUB_ERRORS.auth;
  if (status === 404) return GITHUB_ERRORS.notFound;
  if (status === 409 || status === 422) return GITHUB_ERRORS.conflict;
  return `GitHub 오류 (${status})`;
}

const CHUNK = 0x8000;

// UTF-8 → base64. 큰 배열을 spread하지 않고 조각으로 변환한다
export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(binary);
}

// base64 → UTF-8. GitHub은 본문 base64에 줄바꿈을 끼워 보내므로 공백류를 모두 지운다
export function decodeBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function contentsUrl(ref: GitHubFileRef): string {
  const path = ref.path.split('/').map(encodeURIComponent).join('/');
  return `${GITHUB_API}/repos/${ref.repo}/contents/${path}`;
}

function headers(token: string | undefined, json: boolean): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) h.Authorization = `Bearer ${token}`;
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

const defaultFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

export async function getFile(ref: GitHubFileRef, fetchFn: FetchLike = defaultFetch): Promise<GetFileResult> {
  let res: Response;
  try {
    res = await fetchFn(`${contentsUrl(ref)}?ref=${encodeURIComponent(ref.branch)}`, { method: 'GET', headers: headers(ref.token, false) });
  } catch {
    return { ok: false, error: GITHUB_ERRORS.network };
  }
  if (!res.ok) return { ok: false, error: errorForStatus(res.status) };
  try {
    const body = (await res.json()) as { content?: unknown; sha?: unknown };
    if (typeof body.content !== 'string' || typeof body.sha !== 'string') return { ok: false, error: 'GitHub 응답을 읽을 수 없습니다' };
    return { ok: true, text: decodeBase64(body.content), sha: body.sha };
  } catch {
    return { ok: false, error: 'GitHub 응답을 읽을 수 없습니다' };
  }
}

export async function putFile(input: PutFileInput, fetchFn: FetchLike = defaultFetch): Promise<PutFileResult> {
  const payload: Record<string, string> = { message: input.message, content: encodeBase64(input.text), branch: input.branch };
  if (input.sha) payload.sha = input.sha;
  let res: Response;
  try {
    res = await fetchFn(contentsUrl(input), { method: 'PUT', headers: headers(input.token, true), body: JSON.stringify(payload) });
  } catch {
    return { ok: false, error: GITHUB_ERRORS.network };
  }
  if (!res.ok) return { ok: false, error: errorForStatus(res.status) };
  try {
    const body = (await res.json()) as { content?: { sha?: unknown } };
    const sha = body.content?.sha;
    if (typeof sha !== 'string') return { ok: false, error: 'GitHub 응답을 읽을 수 없습니다' };
    return { ok: true, sha };
  } catch {
    return { ok: false, error: 'GitHub 응답을 읽을 수 없습니다' };
  }
}
