import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

export function buildSofa(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const fabric = color(v.colors, 'fabric', '#8a8f98');
  const seatH = H * 0.5;
  const backD = D * 0.25;
  const armW = W * 0.08;
  return group(
    box(W, seatH, D, fabric, 0, seatH / 2, 0),
    box(W, H, backD, fabric, 0, H / 2, -D / 2 + backD / 2),
    box(armW, H * 0.75, D, fabric, -W / 2 + armW / 2, (H * 0.75) / 2, 0),
    box(armW, H * 0.75, D, fabric, W / 2 - armW / 2, (H * 0.75) / 2, 0),
  );
}
