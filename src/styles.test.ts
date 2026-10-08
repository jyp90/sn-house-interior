import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// spec §19.4: 색 리터럴은 :root 토큰과 2D 캔버스 블록에만 둔다
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
const COLOR = /#[0-9a-fA-F]{3,8}\b|rgba?\(/;

describe('styles.css 토큰', () => {
  it(':root와 2D 캔버스 블록 밖에는 색 리터럴이 없다', () => {
    const rootEnd = css.indexOf('}', css.indexOf(':root')) + 1;
    const canvasStart = css.indexOf('/* 2D 캔버스·도면 색');
    expect(rootEnd).toBeGreaterThan(0);
    expect(canvasStart).toBeGreaterThan(rootEnd);
    const offenders = css
      .slice(rootEnd, canvasStart)
      .split('\n')
      .filter((line) => COLOR.test(line));
    expect(offenders).toEqual([]);
  });

  it('영역 그리기 미리보기 채움은 강조 토큰에서 만든다', () => {
    expect(css).toMatch(/\.tool-preview-area \{ fill: color-mix\(in srgb, var\(--accent\) 8%, transparent\);/);
  });
});
