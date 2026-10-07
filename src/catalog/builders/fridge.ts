import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const PANEL = 0.02;
const GAP = 0.004;
const GROOVE = 0.015;

// 패널 앞면보다 PANEL/2 들어간 손잡이 홈
function groove(w: number, x: number, y: number, D: number, c: string) {
  const m = box(w, GROOVE, PANEL / 2, c, x, y, D / 2 - (PANEL * 3) / 4);
  m.name = 'handle-groove';
  return m;
}

export function buildFridge(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const split = (p.builderParams?.split as string | undefined) ?? '4door';
  const topRatio = (p.builderParams?.topRatio as number | undefined) ?? 0.6;
  const panel = color(v.colors, 'panel', '#e5e5e5');
  const handle = color(v.colors, 'handle', '#9a9a9a');
  const body = box(W, H, D - PANEL, color(v.colors, 'body', '#cccccc'), 0, H / 2, -PANEL / 2);
  const z = D / 2 - PANEL / 2;

  if (split === '1door') {
    return group(
      body,
      box(W - GAP, H - GROOVE - GAP, PANEL, panel, 0, (H - GROOVE) / 2, z),
      groove(W - GAP, 0, H - GROOVE / 2, D, handle),
    );
  }

  const topH = H * topRatio;
  const botH = H - topH;
  // 위 문은 아래 가장자리, 아래 문은 위 가장자리에 홈이 있다
  const column = (w: number, x: number) => [
    box(w, topH - GROOVE - GAP, PANEL, panel, x, botH + GROOVE + (topH - GROOVE) / 2, z),
    groove(w, x, botH + GROOVE / 2, D, handle),
    box(w, botH - GROOVE - GAP, PANEL, panel, x, (botH - GROOVE) / 2, z),
    groove(w, x, botH - GROOVE / 2, D, handle),
  ];
  const parts = split === '2door' ? column(W - GAP, 0) : [-1, 1].flatMap((side) => column(W / 2 - GAP, (side * W) / 4));
  return group(body, ...parts);
}
