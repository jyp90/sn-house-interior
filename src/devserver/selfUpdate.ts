// dev 서버 전용 자동 업데이트(스펙 §18). 클라이언트 번들에 들어가지 않는다(vite.config.ts에서만 import).
// 명령 실행은 주입받아 테스트에서 가짜로 바꾼다.

export type ExecResult = { code: number; stdout: string; stderr: string };
export type Exec = (cmd: string, args: string[]) => Promise<ExecResult>;

export type UpdateResult =
  | { status: 'up-to-date'; head: string }
  | { status: 'updated'; from: string; to: string; commits: number; depsInstalled: boolean }
  | { status: 'dirty' }
  | { status: 'error'; message: string };

export const UPDATE_PATH = '/__homefit/update';

const short = (sha: string) => sha.trim().slice(0, 7);
const firstLine = (r: ExecResult) => (r.stderr || r.stdout).trim().split('\n')[0] ?? '';

export async function runSelfUpdate(exec: Exec): Promise<UpdateResult> {
  const git = (...args: string[]) => exec('git', args);

  const upstream = await git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}');
  if (upstream.code !== 0) return { status: 'error', message: '현재 브랜치에 연결된 원격 브랜치가 없습니다.' };

  // 추적 중인 파일에 커밋 안 된 변경이 있으면 건드리지 않는다(같은 폴더를 다른 작업이 쓰고 있을 수 있음)
  const status = await git('status', '--porcelain', '--untracked-files=no');
  if (status.code !== 0) return { status: 'error', message: `git status 실패: ${firstLine(status)}` };
  if (status.stdout.trim() !== '') return { status: 'dirty' };

  const fetch = await git('fetch', '--quiet');
  if (fetch.code !== 0) return { status: 'error', message: `원격 저장소에 연결하지 못했습니다: ${firstLine(fetch)}` };

  const from = (await git('rev-parse', 'HEAD')).stdout.trim();
  const remote = (await git('rev-parse', '@{u}')).stdout.trim();
  if (from === remote) return { status: 'up-to-date', head: short(from) };

  const behind = await git('rev-list', '--count', 'HEAD..@{u}');
  const commits = Number(behind.stdout.trim()) || 0;
  if (commits === 0) return { status: 'up-to-date', head: short(from) };

  const merge = await git('merge', '--ff-only', '@{u}');
  if (merge.code !== 0) {
    return { status: 'error', message: '로컬에 원격에 없는 커밋이 있어 자동으로 합칠 수 없습니다. 터미널에서 정리하세요.' };
  }
  const to = (await git('rev-parse', 'HEAD')).stdout.trim();

  const deps = await git('diff', '--name-only', from, to, '--', 'package.json', 'package-lock.json');
  const depsChanged = deps.stdout.trim() !== '';
  if (depsChanged) {
    const install = await exec('npm', ['install']);
    if (install.code !== 0) {
      return { status: 'error', message: `코드는 ${short(to)}로 받았지만 npm install에 실패했습니다: ${firstLine(install)}` };
    }
  }
  return { status: 'updated', from: short(from), to: short(to), commits, depsInstalled: depsChanged };
}

// 다른 사이트에서 보낸 요청을 막는다: 같은 출처 + 사용자 정의 헤더(교차 출처면 preflight에서 막힘)
export function isTrustedUpdateRequest(headers: Record<string, string | string[] | undefined>): boolean {
  if (headers['x-homefit-update'] !== '1') return false;
  const origin = headers.origin;
  if (origin === undefined) return true;
  if (typeof origin !== 'string') return false;
  try {
    return new URL(origin).host === headers.host;
  } catch {
    return false;
  }
}
