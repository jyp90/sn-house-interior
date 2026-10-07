import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const PANEL = 0.02;
const GAP = 0.004;

export function buildFridge(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const split = (p.builderParams?.split as string | undefined) ?? '4door';
  const topRatio = (p.builderParams?.topRatio as number | undefined) ?? 0.6;
  const panel = color(v.colors, 'panel', '#e5e5e5');
  const body = box(W, H, D - PANEL, color(v.colors, 'body', '#cccccc'), 0, H / 2, -PANEL / 2);
  const z = D / 2 - PANEL / 2;
  const panels =
    split === '1door'
      ? [box(W - GAP, H - GAP, PANEL, panel, 0, H / 2, z)]
      : split === '2door'
        ? [
            box(W - GAP, H * topRatio - GAP, PANEL, panel, 0, H * (1 - topRatio) + (H * topRatio) / 2, z),
            box(W - GAP, H * (1 - topRatio) - GAP, PANEL, panel, 0, (H * (1 - topRatio)) / 2, z),
          ]
        : (() => {
            const topH = H * topRatio;
            const botH = H - topH;
            return [-1, 1].flatMap((side) => [
              box(W / 2 - GAP, topH - GAP, PANEL, panel, (side * W) / 4, botH + topH / 2, z),
              box(W / 2 - GAP, botH - GAP, PANEL, panel, (side * W) / 4, botH / 2, z),
            ]);
          })();
  return group(body, ...panels);
}
