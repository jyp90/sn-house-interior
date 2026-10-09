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

// 핀치 줌(스펙 §44): 두 손가락 거리 비율 `factor`만큼 확대하고, 시작 중점(`mid0`) 아래에 있던 평면 점이 현재 중점(`mid1`) 아래에 오도록 옮긴다.
// `mid0`/`mid1`은 SVG 요소 기준 픽셀, `size`는 SVG 픽셀 크기. 모두 핀치 시작 시점의 `v0`에서 계산해 손가락이 흔들려도 누적 오차가 없다
export function pinchViewBox(v0: ViewBox, size: { w: number; h: number }, mid0: Vec2, mid1: Vec2, factor: number): ViewBox {
  const w = Math.min(MAX_VIEW_CM, Math.max(MIN_VIEW_CM, v0.w / factor));
  const h = v0.h * (w / v0.w);
  const k0 = v0.w / size.w;
  const k1 = w / size.w;
  const px = v0.x + mid0.x * k0;
  const py = v0.y + mid0.y * k0;
  return { x: px - mid1.x * k1, y: py - mid1.y * k1, w, h };
}
