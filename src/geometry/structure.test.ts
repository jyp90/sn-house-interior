import { describe, expect, it } from 'vitest';
import type { Opening, Wall } from '../model/schema';
import {
  distanceToWall, fitOpening, moveEndpoint, nearestWall, openingAtPoint, openingNumbers, refitOpenings, roomRectWalls, setWallLength,
} from './structure';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
  id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 10, height: 230,
});
const door = (over: Partial<Opening> = {}): Opening => ({
  id: 'o', wallId: 'w', kind: 'door', offset: 250, width: 90, height: 210, sill: 0, hinge: 'start', swingIn: true, ...over,
});

describe('roomRectWalls', () => {
  it('벽 두께를 넣어도 내측 치수가 유지된다 (F02: 4000×3000mm, 두께 150mm)', () => {
    const walls = roomRectWalls({ x: 100, y: 100 }, 400, 300, 15, 230);
    expect(walls).toHaveLength(4);
    const xs = walls.flatMap((w) => [w.a.x, w.b.x]);
    const ys = walls.flatMap((w) => [w.a.y, w.b.y]);
    expect(Math.max(...xs) - Math.min(...xs) - 15).toBe(400);
    expect(Math.max(...ys) - Math.min(...ys) - 15).toBe(300);
    expect(walls.every((w) => w.thickness === 15 && w.height === 230)).toBe(true);
  });

  it('외곽이 닫혀 있다(각 벽의 끝점이 다음 벽의 시작점)', () => {
    const walls = roomRectWalls({ x: 0, y: 0 }, 400, 300, 12, 230);
    walls.forEach((w, i) => expect(walls[(i + 1) % 4].a).toEqual(w.b));
  });
});

describe('fitOpening', () => {
  it('벽 안으로 당겨 맞춘다', () => {
    expect(fitOpening(wall('w', 0, 0, 300, 0), 250, 90)).toBe(210);
    expect(fitOpening(wall('w', 0, 0, 300, 0), -20, 90)).toBe(0);
  });

  it('벽보다 넓으면 null', () => {
    expect(fitOpening(wall('w', 0, 0, 80, 0), 0, 90)).toBeNull();
  });
});

describe('openingAtPoint', () => {
  it('클릭한 점을 개구부 중심으로 놓는다', () => {
    expect(openingAtPoint(wall('w', 0, 0, 400, 0), { x: 200, y: 7 }, 90)).toBe(155);
  });
});

describe('nearestWall', () => {
  const walls = [wall('a', 0, 0, 400, 0), wall('b', 400, 0, 400, 300)];

  it('가장 가까운 벽을 고른다', () => {
    expect(nearestWall(walls, { x: 390, y: 150 }, 30)?.id).toBe('b');
    expect(distanceToWall(walls[0], { x: 500, y: 0 })).toBe(100);
  });

  it('maxDist보다 멀면 null', () => {
    expect(nearestWall(walls, { x: 200, y: 200 }, 30)).toBeNull();
  });
});

describe('refitOpenings', () => {
  it('벽이 짧아지면 개구부를 당겨 맞춘다', () => {
    const r = refitOpenings([wall('w', 0, 0, 300, 0)], [door()]);
    expect(r).toEqual({ ok: true, openings: [door({ offset: 210 })] });
  });

  it('들어갈 수 없으면 그 개구부 id로 실패한다', () => {
    expect(refitOpenings([wall('w', 0, 0, 80, 0)], [door()])).toEqual({ ok: false, openingId: 'o' });
  });

  it('벽이 사라진 개구부는 버린다', () => {
    expect(refitOpenings([], [door()])).toEqual({ ok: true, openings: [] });
  });
});

describe('moveEndpoint / setWallLength', () => {
  it('같은 끝점을 공유하는 벽을 함께 옮긴다', () => {
    const walls = moveEndpoint([wall('a', 0, 0, 400, 0), wall('b', 400, 0, 400, 300)], { x: 400, y: 0 }, { x: 500, y: 0 });
    expect(walls[0].b).toEqual({ x: 500, y: 0 });
    expect(walls[1].a).toEqual({ x: 500, y: 0 });
  });

  it('a를 고정하고 방향을 유지해 길이를 바꾼다', () => {
    expect(setWallLength(wall('w', 0, 0, 300, 400), 1000).b).toEqual({ x: 600, y: 800 });
  });
});

describe('openingNumbers', () => {
  it('종류별로 순서 번호를 매긴다(문·창·개구부 섞인 순서)', () => {
    const d1 = door({ id: 'd1' });
    const w1: Opening = { id: 'w1', wallId: 'w', kind: 'window', offset: 0, width: 180, height: 120, sill: 90, hinge: 'start', swingIn: false };
    const d2 = door({ id: 'd2', middle: true });
    const o1: Opening = { id: 'op1', wallId: 'w', kind: 'opening', offset: 0, width: 100, height: 210, sill: 0, hinge: 'start', swingIn: true };
    const numbers = openingNumbers({ openings: [d1, w1, d2, o1] });
    expect(numbers.get('d1')).toBe('D1');
    expect(numbers.get('w1')).toBe('W1');
    expect(numbers.get('d2')).toBe('D2');
    expect(numbers.get('op1')).toBe('O1');
  });
});
