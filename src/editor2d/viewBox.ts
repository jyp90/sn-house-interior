import type { Vec2 } from '../model/schema';

export type ViewBox = { x: number; y: number; w: number; h: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export const MIN_VIEW_CM = 50;
export const MAX_VIEW_CM = 50000;

export function fitViewBox(b: Bounds, aspect: number, margin = 100): ViewBox {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  let w = b.maxX - b.minX + margin * 2;
  let h = b.maxY - b.minY + margin * 2;
  if (w / h > a) h = w / a;
  else w = h * a;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function zoomAt(v: ViewBox, p: Vec2, factor: number): ViewBox {
  const w = Math.min(MAX_VIEW_CM, Math.max(MIN_VIEW_CM, v.w / factor));
  const k = w / v.w;
  return { x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w, h: v.h * k };
}

export function panBy(v: ViewBox, dx: number, dy: number): ViewBox {
  return { ...v, x: v.x + dx, y: v.y + dy };
}
