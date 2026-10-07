import { describe, expect, it } from 'vitest';
import type { Wall } from '../model/schema';
import { itemObb } from './obb';
import { wallObb } from './walls';
import { snapToWalls } from './snap';

const walls: Wall[] = [
  { id: '1', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 },
  { id: '4', a: { x: 0, y: 400 }, b: { x: 0, y: 0 }, thickness: 10, height: 230 },
];
const obbs = walls.map(wallObb);

describe('snapToWalls', () => {
  it('벽면에서 2cm 이내면 밀착시킨다', () => {
    expect(snapToWalls(itemObb(200, 36.5, 0, 100, 60), obbs)).toEqual({ cx: 200, cy: 35 });
  });

  it('살짝 파고든 경우에도 벽면으로 밀어낸다', () => {
    expect(snapToWalls(itemObb(200, 34, 0, 100, 60), obbs)).toEqual({ cx: 200, cy: 35 });
  });

  it('2cm보다 멀면 그대로 둔다', () => {
    expect(snapToWalls(itemObb(200, 38, 0, 100, 60), obbs)).toEqual({ cx: 200, cy: 38 });
  });

  it('세로 벽에도 붙는다', () => {
    const r = snapToWalls(itemObb(56.5, 200, 0, 100, 60), obbs);
    expect(r.cx).toBeCloseTo(55);
    expect(r.cy).toBeCloseTo(200);
  });
});
