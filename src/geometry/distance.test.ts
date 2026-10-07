import { describe, expect, it } from 'vitest';
import type { Wall } from '../model/schema';
import { itemObb } from './obb';
import { wallObb } from './walls';
import { wallDistances } from './distance';

const room: Wall[] = [
  { id: '1', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 },
  { id: '2', a: { x: 400, y: 0 }, b: { x: 400, y: 400 }, thickness: 10, height: 230 },
  { id: '3', a: { x: 400, y: 400 }, b: { x: 0, y: 400 }, thickness: 10, height: 230 },
  { id: '4', a: { x: 0, y: 400 }, b: { x: 0, y: 0 }, thickness: 10, height: 230 },
];

describe('wallDistances', () => {
  it('4방향으로 가장 가까운 벽 안쪽 면까지 거리를 잰다', () => {
    const rays = wallDistances(itemObb(200, 200, 0, 100, 60), room.map(wallObb));
    const byDir = Object.fromEntries(rays.map((r) => [r.dir, r.distance]));
    expect(byDir).toEqual({ right: 145, left: 145, front: 165, back: 165 });
  });

  it('벽이 없으면 빈 배열', () => {
    expect(wallDistances(itemObb(0, 0, 0, 10, 10), [])).toEqual([]);
  });
});
