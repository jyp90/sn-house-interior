import type { Product, Variant } from '../../model/schema';
import { box, color, cylinder, group, meters } from './parts';

// 물탱크(뒤) + 변기 몸통 + 둥근 앞부분
export function buildToilet(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const c = color(v.colors, 'body', '#f7f7f5');
  const tankD = D * 0.25;
  const seatH = H * 0.55;
  const r = W / 2;
  const tank = box(W, H, tankD, c, 0, H / 2, -D / 2 + tankD / 2);
  tank.name = 'tank';
  const bodyLen = D - tankD - r;
  const bodyZ = -D / 2 + tankD + bodyLen / 2;
  return group(
    tank,
    box(W * 0.6, seatH - 0.02, bodyLen, c, 0, (seatH - 0.02) / 2, bodyZ),
    box(W, 0.02, bodyLen, c, 0, seatH - 0.01, bodyZ),
    cylinder(r, seatH, c, 0, seatH / 2, D / 2 - r),
  );
}
