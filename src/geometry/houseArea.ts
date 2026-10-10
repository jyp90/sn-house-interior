import type { Vec2, Wall } from '../model/schema';
import { corners } from './obb';
import { wallObb } from './walls';

type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

// 집 영역(스펙 §38): 모든 벽 OBB 모서리를 감싸는 사각형(벽 두께 포함). 벽이 없으면 null = 제한 없음
export function houseBounds(walls: Wall[]): Bounds | null {
  if (walls.length === 0) return null;
  const pts = walls.flatMap((w) => corners(wallObb(w)));
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

export function insideHouse(walls: Wall[], p: Vec2): boolean {
  const b = houseBounds(walls);
  if (!b) return true;
  return p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;
}

export function clampToHouse(walls: Wall[], p: Vec2): Vec2 {
  const b = houseBounds(walls);
  if (!b) return p;
  return { x: Math.min(b.maxX, Math.max(b.minX, p.x)), y: Math.min(b.maxY, Math.max(b.minY, p.y)) };
}

export const OUTSIDE_HOUSE_TEXT = '집 영역 밖에는 놓을 수 없습니다.';
