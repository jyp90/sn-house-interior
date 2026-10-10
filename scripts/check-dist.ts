import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// Pages 번들 검사(배포 설계 §7, 스펙 §24). 우리 집 평면도(home/floorplan.jpg) 외의 이미지, private/ 흔적, base 경로 누락이면 실패한다.
export const BASE = '/sn-house-interior/';
// private/ 쪽 옛 프리셋 파일명·경로가 번들에 남으면 잡는다. 추적 프리셋은 home/plan.json·home/floorplan.jpg라 걸리지 않는다.
export const FORBIDDEN_TEXT = ['our-home.local', 'make-our-home', 'home-floorplan.jpg', 'private/'];
// 허용 이미지: home/floorplan.jpg의 Vite 해시 산출물뿐
export const ALLOWED_IMAGE = /^assets\/floorplan-[\w-]+\.jpg$/;
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|gif|avif|bmp)$/i;
const TEXT_EXT = /\.(html|js|css|json|txt|svg|map)$/i;

export type DistFile = { path: string; text: string | null };

export function findDistProblems(files: DistFile[]): string[] {
  const problems: string[] = [];
  for (const f of files) {
    if (IMAGE_EXT.test(f.path) && !ALLOWED_IMAGE.test(f.path)) problems.push(`이미지 파일: ${f.path}`);
    if (f.text === null) continue;
    for (const word of FORBIDDEN_TEXT) {
      if (f.text.includes(word)) problems.push(`금지 문자열 "${word}": ${f.path}`);
    }
  }
  const index = files.find((f) => f.path === 'index.html');
  if (!index || index.text === null) {
    problems.push('index.html 없음');
    return problems;
  }
  const refs = [...index.text.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((r) => !/^(https?:|data:|#)/.test(r));
  if (!local.some((r) => r.startsWith(`${BASE}assets/`))) problems.push(`index.html에 ${BASE}assets/ 경로가 없음`);
  for (const r of local) if (!r.startsWith(BASE)) problems.push(`base 밖 경로: ${r}`);
  return problems;
}

export function readDist(dir: string): DistFile[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((rel) => statSync(join(dir, rel)).isFile())
    .map((rel) => ({
      path: rel.split(sep).join('/'),
      text: TEXT_EXT.test(rel) ? readFileSync(join(dir, rel), 'utf8') : null,
    }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = readDist(process.argv[2] ?? 'dist');
  const problems = findDistProblems(files);
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  // slop-ok: CLI 스크립트의 결과 출력
  console.log(`dist 검사 통과 (${files.length}개 파일)`);
}
