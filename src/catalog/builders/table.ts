import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const TOP = 0.03;
const LEG = 0.05;

export function buildTable(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const wood = color(v.colors, 'wood', '#b08a62');
  const legH = H - TOP;
  const lx = W / 2 - LEG / 2 - 0.03;
  const lz = D / 2 - LEG / 2 - 0.03;
  return group(
    box(W, TOP, D, wood, 0, H - TOP / 2, 0),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(LEG, legH, LEG, wood, sx * lx, legH / 2, sz * lz))),
  );
}
