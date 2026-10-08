import type { FloorFinish } from '../model/schema';

export type PatternShape = { x: number; y: number; w: number; h: number; shade: number };
export type PatternSpec = { w: number; h: number; shapes: PatternShape[] };

const PLANK_W = 120;
const PLANK_H = 15;
const TILE = 60;
const GROUT = 0.3;

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amount >= 0 ? (255 - v) * amount : v * amount))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// 널판 4줄, 줄마다 1/4씩 엇갈리게. 타일 한 칸은 줄눈을 뺀 사각형
export function patternSpec(finish: FloorFinish): PatternSpec | null {
  if (finish.material === 'plain') return null;
  if (finish.material === 'tile') return { w: TILE, h: TILE, shapes: [{ x: GROUT / 2, y: GROUT / 2, w: TILE - GROUT, h: TILE - GROUT, shade: 0 }] };
  const shapes: PatternShape[] = [];
  const shades = [0, -0.06, 0.05, -0.03];
  for (let row = 0; row < 4; row++) {
    const offset = (row * PLANK_W) / 4;
    for (let x = -PLANK_W + offset; x < PLANK_W * 2; x += PLANK_W) {
      shapes.push({ x, y: row * PLANK_H, w: PLANK_W - 0.6, h: PLANK_H, shade: shades[(row + Math.round(x / PLANK_W) + 8) % 4] });
    }
  }
  return { w: PLANK_W * 2, h: PLANK_H * 4, shapes };
}
