import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Vec2, Wall } from '../model/schema';
import { enclosedPolygon } from './enclosure';
import { isSimplePolygon, isValidPolygon } from './polygon';

const key = (p: Vec2) => `${p.x},${p.y}`;
const asSet = (pts: Vec2[]) => new Set(pts.map(key));

function expectVertices(actual: Vec2[] | null, expected: Vec2[]) {
  expect(actual).not.toBeNull();
  expect(actual!).toHaveLength(expected.length);
  expect(asSet(actual!)).toEqual(asSet(expected));
  for (const p of actual!) {
    expect(Number.isInteger(p.x)).toBe(true);
    expect(Number.isInteger(p.y)).toBe(true);
  }
  expect(isValidPolygon(actual!)).toBe(true);
  expect(isSimplePolygon(actual!)).toBe(true);
}

const wall = (id: string, ax: number, ay: number, bx: number, by: number, thickness = 20): Wall => ({
  id,
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
  thickness,
  height: 230,
});

describe('enclosedPolygon', () => {
  it('샘플 평면 r1: 직사각형 방은 마감면 좌표로 정확히 닫힌다', () => {
    expectVertices(enclosedPolygon({ x: 175, y: 200 }, SAMPLE_PLAN.walls), [
      { x: 10, y: 10 },
      { x: 344, y: 10 },
      { x: 344, y: 390 },
      { x: 10, y: 390 },
    ]);
  });

  it('샘플 평면 r2: 문이 있는 칸막이도 경계다', () => {
    expectVertices(enclosedPolygon({ x: 475, y: 200 }, SAMPLE_PLAN.walls), [
      { x: 356, y: 10 },
      { x: 590, y: 10 },
      { x: 590, y: 390 },
      { x: 356, y: 390 },
    ]);
  });

  it('L자 방은 꼭짓점 6개', () => {
    const walls: Wall[] = [
      wall('w1', 0, 0, 600, 0),
      wall('w2', 600, 0, 600, 400),
      wall('w3', 600, 400, 0, 400),
      wall('w4', 0, 400, 0, 0),
      wall('p1', 300, 0, 300, 200, 12),
      wall('p2', 300, 200, 600, 200, 12),
    ];
    expectVertices(enclosedPolygon({ x: 150, y: 200 }, walls), [
      { x: 10, y: 10 },
      { x: 294, y: 10 },
      { x: 294, y: 206 },
      { x: 590, y: 206 },
      { x: 590, y: 390 },
      { x: 10, y: 390 },
    ]);
  });

  it('벽이 닫히지 않으면 null', () => {
    const walls = SAMPLE_PLAN.walls.filter((w) => w.id !== 'w3');
    expect(enclosedPolygon({ x: 175, y: 200 }, walls)).toBeNull();
  });

  it('씨앗이 벽 안이면 null', () => {
    expect(enclosedPolygon({ x: 350, y: 200 }, SAMPLE_PLAN.walls)).toBeNull();
  });

  it('씨앗이 격자 밖이면 null', () => {
    expect(enclosedPolygon({ x: 5000, y: 5000 }, SAMPLE_PLAN.walls)).toBeNull();
    expect(enclosedPolygon({ x: 0, y: 0 }, [])).toBeNull();
  });

  it('안쪽 기둥은 무시하고 외곽만 돌려준다', () => {
    const walls: Wall[] = [...SAMPLE_PLAN.walls.filter((w) => w.id !== 'w5'), wall('pillar', 280, 180, 280, 220, 40)];
    expectVertices(enclosedPolygon({ x: 100, y: 100 }, walls), [
      { x: 10, y: 10 },
      { x: 590, y: 10 },
      { x: 590, y: 390 },
      { x: 10, y: 390 },
    ]);
  });
});
