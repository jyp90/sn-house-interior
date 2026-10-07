import type { Product, Variant } from '../../model/schema';
import { box, color, disc, group, meters } from './parts';

const DOOR = 0.015;

export function buildFrontLoader(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const r = Math.min(W * 0.32, H * 0.4);
  return group(
    box(W, H, D - DOOR, color(v.colors, 'body', '#eeeeee'), 0, H / 2, -DOOR / 2),
    disc(r, DOOR, color(v.colors, 'door', '#3a404a'), 0, H * 0.45, D / 2 - DOOR / 2),
  );
}
