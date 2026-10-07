import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

export function buildBox(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  return group(box(W, H, D, color(v.colors, 'body', '#c8b8a0'), 0, H / 2, 0));
}
