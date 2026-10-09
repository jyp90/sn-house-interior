import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const SEAT_T = 0.04;
const LEG = 0.035;
const BACK_T = 0.03;

export function buildChair(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const wood = color(v.colors, 'wood', '#b08a62');
  const seatH = Math.min(0.45, H * 0.52);
  const legs = ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => {
    const m = box(LEG, seatH - SEAT_T, LEG, wood, sx * (W / 2 - LEG / 2), (seatH - SEAT_T) / 2, sz * (D / 2 - LEG / 2));
    m.name = 'leg';
    return m;
  });
  const back = box(W, H - seatH, BACK_T, wood, 0, seatH + (H - seatH) / 2, -D / 2 + BACK_T / 2);
  back.name = 'back';
  return group(...legs, box(W, SEAT_T, D, color(v.colors, 'seat', '#d8cfc0'), 0, seatH - SEAT_T / 2, 0), back);
}
