import type { ClearanceShape } from '../geometry/clearance';
import { corners } from '../geometry/obb';
import type { Vec2 } from '../model/schema';

const r2 = (n: number) => Math.round(n * 100) / 100 + 0;

export function pointsAttr(pts: Vec2[]): string {
  return pts.map((p) => `${r2(p.x)},${r2(p.y)}`).join(' ');
}

export function sectorPath(c: Vec2, r: number, start: number, end: number): string {
  const p1 = { x: c.x + r * Math.cos(start), y: c.y + r * Math.sin(start) };
  const p2 = { x: c.x + r * Math.cos(end), y: c.y + r * Math.sin(end) };
  return `M ${r2(c.x)} ${r2(c.y)} L ${r2(p1.x)} ${r2(p1.y)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(p2.x)} ${r2(p2.y)} Z`;
}

export function shapePath(shape: ClearanceShape): string {
  if (shape.kind === 'sector') return sectorPath(shape.center, shape.radius, shape.start, shape.end);
  const [first, ...rest] = corners(shape.obb);
  return `M ${r2(first.x)} ${r2(first.y)} ${rest.map((p) => `L ${r2(p.x)} ${r2(p.y)}`).join(' ')} Z`;
}
