import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const SKIN = 0.002;

// 좁고 긴 기둥 + 상단 토출구 띠
export function buildStandAc(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const ventH = H * 0.3;
  const vent = box(W - 0.008, ventH, SKIN, color(v.colors, 'vent', '#5c6066'), 0, H - ventH / 2 - 0.02, D / 2 - SKIN / 2);
  vent.name = 'vent';
  return group(box(W, H, D - SKIN, color(v.colors, 'body', '#f2f2f2'), 0, H / 2, -SKIN / 2), vent);
}
