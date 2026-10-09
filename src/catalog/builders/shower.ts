import type { Product, Variant } from '../../model/schema';
import { box, color, glass, group, meters } from './parts';

const TRAY = 0.05;
const GLASS = 0.008;
const FRAME = 0.02;

// 바닥 트레이 + 유리 2면(앞 +z, 오른쪽 +x) + 상단 프레임. 뒤·왼쪽은 벽에 붙인다
export function buildShower(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const frameC = color(v.colors, 'frame', '#8a8a8a');
  return group(
    box(W, TRAY, D, color(v.colors, 'tray', '#e8e8e6'), 0, TRAY / 2, 0),
    glass(W, H - TRAY - FRAME, GLASS, 0, TRAY + (H - TRAY - FRAME) / 2, D / 2 - GLASS / 2),
    glass(GLASS, H - TRAY - FRAME, D, W / 2 - GLASS / 2, TRAY + (H - TRAY - FRAME) / 2, 0),
    box(W, FRAME, FRAME, frameC, 0, H - FRAME / 2, D / 2 - FRAME / 2),
    box(FRAME, FRAME, D, frameC, W / 2 - FRAME / 2, H - FRAME / 2, 0),
  );
}
