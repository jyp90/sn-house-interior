import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

export function buildBed(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const frame = color(v.colors, 'frame', '#b08a62');
  const frameH = Math.min(0.25, H * 0.4);
  const mattressH = Math.min(0.2, H - frameH);
  const head = 0.06;
  return group(
    box(W, frameH, D, frame, 0, frameH / 2, 0),
    box(W - 0.04, mattressH, D - head - 0.04, color(v.colors, 'mattress', '#f4f1ea'), 0, frameH + mattressH / 2, head / 2),
    box(W, H, head, frame, 0, H / 2, -D / 2 + head / 2),
  );
}
