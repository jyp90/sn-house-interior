import { describe, expect, it } from 'vitest';
import type { Wall } from '../model/schema';
import { clampToHouse, houseBounds, insideHouse } from './houseArea';

const walls: Wall[] = [
  { id: 'a', a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, thickness: 20, height: 230 },
  { id: 'b', a: { x: 600, y: 0 }, b: { x: 600, y: 400 }, thickness: 20, height: 230 },
];

describe('houseArea', () => {
  it('벽이 없으면 경계가 없고 모든 점이 안쪽이다', () => {
    expect(houseBounds([])).toBeNull();
    expect(insideHouse([], { x: 9999, y: -9999 })).toBe(true);
    expect(clampToHouse([], { x: 9999, y: -9999 })).toEqual({ x: 9999, y: -9999 });
  });
  it('경계는 벽 두께를 포함한 바깥 면이다', () => {
    expect(houseBounds(walls)).toEqual({ minX: -10, minY: -10, maxX: 610, maxY: 410 });
  });
  it('바깥 면 위의 점은 안쪽, 그 너머는 바깥이다', () => {
    expect(insideHouse(walls, { x: 610, y: 200 })).toBe(true);
    expect(insideHouse(walls, { x: 611, y: 200 })).toBe(false);
    expect(insideHouse(walls, { x: 300, y: -11 })).toBe(false);
  });
  it('clamp는 바깥 점을 가장 가까운 경계로 옮기고 안쪽 점은 그대로 둔다', () => {
    expect(clampToHouse(walls, { x: 700, y: -50 })).toEqual({ x: 610, y: -10 });
    expect(clampToHouse(walls, { x: 300, y: 200 })).toEqual({ x: 300, y: 200 });
  });
});
