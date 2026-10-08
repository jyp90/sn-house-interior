import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE, findDistProblems, readDist, type DistFile } from './check-dist';

const INDEX_OK = `<!doctype html><html><head><script type="module" src="${BASE}assets/index-abc.js"></script><link rel="stylesheet" href="${BASE}assets/index-abc.css"></head><body></body></html>`;
const ok = (): DistFile[] => [
  { path: 'index.html', text: INDEX_OK },
  { path: 'assets/index-abc.js', text: 'console.log(1)' },
  { path: 'assets/Pretendard-Regular-x.ttf', text: null },
  { path: 'licenses/Pretendard-OFL.txt', text: 'SIL OPEN FONT LICENSE' },
];

describe('findDistProblems', () => {
  it('정상 번들은 문제가 없다', () => {
    expect(findDistProblems(ok())).toEqual([]);
  });

  it.each(['photo.jpg', 'assets/plan.JPEG', 'a.png', 'b.webp', 'c.heic', 'd.gif'])('이미지 파일 %s를 잡는다', (path) => {
    expect(findDistProblems([...ok(), { path, text: null }])).toEqual([`이미지 파일: ${path}`]);
  });

  it.each(['our-home.local', 'make-our-home', 'home-floorplan.jpg', 'private/'])('금지 문자열 %s를 잡는다', (word) => {
    const files = [...ok(), { path: 'assets/x.js', text: `const a = "${word}";` }];
    expect(findDistProblems(files)).toEqual([`금지 문자열 "${word}": assets/x.js`]);
  });

  it('index.html이 없으면 잡는다', () => {
    expect(findDistProblems(ok().filter((f) => f.path !== 'index.html'))).toEqual(['index.html 없음']);
  });

  it('base 밖 절대 경로와 base 누락을 잡는다', () => {
    const index = '<html><script type="module" src="/src/main.tsx"></script></html>';
    const files = [{ path: 'index.html', text: index }];
    expect(findDistProblems(files)).toEqual([`index.html에 ${BASE}assets/ 경로가 없음`, 'base 밖 경로: /src/main.tsx']);
  });

  it('외부 URL과 data URL은 base 검사에서 뺀다', () => {
    const index = INDEX_OK.replace('</head>', '<link rel="icon" href="data:,"><link href="https://example.com/a.css"></head>');
    expect(findDistProblems([{ path: 'index.html', text: index }])).toEqual([]);
  });
});

describe('readDist', () => {
  it('하위 폴더까지 읽고 텍스트 파일만 내용을 담는다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dist-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), INDEX_OK);
    writeFileSync(join(dir, 'assets', 'a.js'), 'x');
    writeFileSync(join(dir, 'assets', 'f.ttf'), Buffer.from([0, 1, 2]));
    const files = readDist(dir).sort((a, b) => a.path.localeCompare(b.path));
    expect(files).toEqual([
      { path: 'assets/a.js', text: 'x' },
      { path: 'assets/f.ttf', text: null },
      { path: 'index.html', text: INDEX_OK },
    ]);
  });
});
