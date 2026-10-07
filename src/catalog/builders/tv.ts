import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const SCREEN = 0.001;

export function buildTv(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const bezel = (p.builderParams?.bezel as number | undefined) ?? 0.01;
  return group(
    box(W, H, D - SCREEN, color(v.colors, 'frame', '#1d1d1f'), 0, H / 2, -SCREEN / 2),
    box(W - 2 * bezel, H - 2 * bezel, SCREEN, color(v.colors, 'screen', '#0b0c10'), 0, H / 2, D / 2 - SCREEN / 2),
  );
}
