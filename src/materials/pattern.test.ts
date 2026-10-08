import { describe, expect, it } from 'vitest';
import { patternSpec, shade, wallPatternSpec } from './pattern';

describe('floor pattern', () => {
  it('마루는 120×15 널판 4줄, 줄마다 엇갈림', () => {
    const s = patternSpec({ material: 'wood', color: '#c9a06c' })!;
    expect(s.w).toBe(240);
    expect(s.h).toBe(60);
    expect(s.shapes.length).toBeGreaterThanOrEqual(8);
    const rows = new Set(s.shapes.map((r) => r.y));
    expect(rows.size).toBe(4);
    expect(s.shapes.every((r) => r.h === 15)).toBe(true);
  });
  it('타일은 60×60 한 칸, 줄눈 0.3', () => {
    const s = patternSpec({ material: 'tile', color: '#b8b5ae' })!;
    expect(s.w).toBe(60);
    expect(s.shapes).toEqual([{ x: 0.15, y: 0.15, w: 59.7, h: 59.7, shade: 0 }]);
  });
  it('plain은 패턴 없음', () => {
    expect(patternSpec({ material: 'plain', color: '#ffffff' })).toBeNull();
  });
  it('shade는 색을 밝거나 어둡게 하고 #rrggbb를 돌려준다', () => {
    expect(shade('#808080', 0)).toBe('#808080');
    expect(shade('#808080', 0.1)).toBe('#8d8d8d');
    expect(shade('#808080', -0.1)).toBe('#737373');
    expect(shade('#ffffff', 0.5)).toBe('#ffffff');
  });
  it('벽지는 2cm 격자, 페인트는 없음', () => {
    expect(wallPatternSpec({ material: 'paint', color: '#ffffff' })).toBeNull();
    expect(wallPatternSpec({ material: 'wallpaper', color: '#e8dcc8' })!.w).toBe(2);
  });
});
