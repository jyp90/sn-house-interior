import type { Vec2 } from '../model/schema';

function signedArea2(pts: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

export function polygonArea(pts: Vec2[]): number {
  return Math.abs(signedArea2(pts)) / 2;
}

export function areaM2(pts: Vec2[]): number {
  return Math.round(polygonArea(pts) / 10000 * 10) / 10;
}

export function polygonCentroid(pts: Vec2[]): Vec2 {
  const a2 = signedArea2(pts);
  if (a2 === 0) {
    const n = pts.length || 1;
    return { x: Math.round(pts.reduce((s, p) => s + p.x, 0) / n), y: Math.round(pts.reduce((s, p) => s + p.y, 0) / n) };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const f = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }
  return { x: Math.round(cx / (3 * a2)), y: Math.round(cy / (3 * a2)) };
}

function onSegment(p: Vec2, a: Vec2, b: Vec2): boolean {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(cross) > 1e-6) return false;
  return p.x >= Math.min(a.x, b.x) - 1e-6 && p.x <= Math.max(a.x, b.x) + 1e-6 && p.y >= Math.min(a.y, b.y) - 1e-6 && p.y <= Math.max(a.y, b.y) + 1e-6;
}

// 광선 교차법. 경계 위의 점은 내부로 본다
export function pointInPolygon(p: Vec2, pts: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (onSegment(p, a, b)) return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function isValidPolygon(pts: Vec2[]): boolean {
  if (pts.length < 3) return false;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a.x === b.x && a.y === b.y) return false;
  }
  return polygonArea(pts) > 0;
}

export function closesPolygon(click: Vec2, first: Vec2, tolCm: number): boolean {
  return Math.hypot(click.x - first.x, click.y - first.y) <= tolCm;
}
