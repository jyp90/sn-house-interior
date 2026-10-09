import { describe, expect, it } from 'vitest';
import type { Item, Plan, Product } from '../model/schema';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { doorLeaves, doorSwings, itemClearances } from './clearance';
import type { Opening, Wall } from '../model/schema';

const product = (clearances: Product['clearances']): Product => ({
  id: 'p', brand: 't', model: 'm', name: 'n', category: 'kitchen', dims: { w: 90, d: 70, h: 180 },
  variants: [{ id: 'v', label: 'v', colors: {} }], builder: 'box', clearances, builtIn: false, mount: 'floor',
});
const item: Item = { id: 'i', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 };

describe('itemClearances', () => {
  it('왼쪽 경첩 문은 앞쪽으로 90° 부채꼴을 만든다', () => {
    const [s] = itemClearances(item, product([{ kind: 'swing', hinge: 'left', radius: 45 }]));
    if (s.kind !== 'sector') throw new Error('sector 기대');
    expect(s.center.x).toBeCloseTo(-45);
    expect(s.center.y).toBeCloseTo(35);
    expect(s.start).toBeCloseTo(0);
    expect(s.end).toBeCloseTo(Math.PI / 2);
    expect(s.obb.cx).toBeCloseTo(-22.5);
    expect(s.obb.cy).toBeCloseTo(57.5);
  });

  it('오른쪽 경첩 문은 반대쪽 사분면을 쓴다', () => {
    const [s] = itemClearances(item, product([{ kind: 'swing', hinge: 'right', radius: 45 }]));
    if (s.kind !== 'sector') throw new Error('sector 기대');
    expect(s.center.x).toBeCloseTo(45);
    expect(s.start).toBeCloseTo(Math.PI / 2);
    expect(s.end).toBeCloseTo(Math.PI);
    expect(s.obb.cx).toBeCloseTo(22.5);
  });

  it('front는 전면에 폭×깊이 사각형을 만든다', () => {
    const [r] = itemClearances(item, product([{ kind: 'front', depth: 60 }]));
    if (r.kind !== 'rect') throw new Error('rect 기대');
    expect(r.obb).toMatchObject({ hw: 45, hd: 30 });
    expect(r.obb.cx).toBeCloseTo(0);
    expect(r.obb.cy).toBeCloseTo(65);
  });
});

describe('doorSwings', () => {
  it('방문은 벽면에서 열림 방향으로 부채꼴을 만든다', () => {
    const plan: Plan = {
      ...SAMPLE_PLAN,
      walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 }],
      openings: [{ id: 'o', wallId: 'w', kind: 'door', offset: 100, width: 80, height: 210, sill: 0, hinge: 'start', swingIn: true }],
    };
    const [s] = doorSwings(plan);
    if (s.kind !== 'sector') throw new Error('sector 기대');
    expect(s.center).toEqual({ x: 100, y: 5 });
    expect(s.obb.cx).toBeCloseTo(140);
    expect(s.obb.cy).toBeCloseTo(45);
  });

  it('창과 개구부는 부채꼴을 만들지 않는다', () => {
    expect(doorSwings({ ...SAMPLE_PLAN, openings: SAMPLE_PLAN.openings.filter((o) => o.kind !== 'door') })).toEqual([]);
  });
});

describe('doorLeaves', () => {
  const wall: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 };
  const door: Opening = { id: 'o', wallId: 'w', kind: 'door', offset: 100, width: 120, height: 210, sill: 0, hinge: 'start', swingIn: true };

  it('외여닫이(leaves 없음)는 문짝 하나, 폭 전체가 반지름', () => {
    const leaves = doorLeaves(wall, door);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].width).toBe(120);
    expect(leaves[0].hinge).toEqual({ x: 100, y: 5 });
    expect(leaves[0].open).toEqual({ x: -0, y: 1 });
    expect(leaves[0].swing.radius).toBe(120);
    expect(leaves[0].swing.obb.cx).toBeCloseTo(160);
    expect(leaves[0].swing.obb.cy).toBeCloseTo(65);
  });

  it('양여닫이는 폭을 반씩 나눠 양 끝에 경첩을 두고 같은 쪽으로 연다', () => {
    const [l, r] = doorLeaves(wall, { ...door, leaves: 'double' });
    expect(l.width).toBe(60);
    expect(r.width).toBe(60);
    expect(l.hinge).toEqual({ x: 100, y: 5 });
    expect(r.hinge).toEqual({ x: 220, y: 5 });
    expect(l.closed).toEqual({ x: 1, y: 0 });
    expect(r.closed).toEqual({ x: -1, y: -0 });
    expect(l.open).toEqual(r.open);
    expect(l.swing.obb.cx).toBeCloseTo(130);
    expect(r.swing.obb.cx).toBeCloseTo(190);
    expect(l.swing.obb.cy).toBeCloseTo(35);
  });

  it('비대칭 양개는 경첩 쪽이 2/3(반올림), 반대쪽이 나머지', () => {
    const [big, small] = doorLeaves(wall, { ...door, leaves: 'asym' });
    expect(big.width).toBe(80);
    expect(small.width).toBe(40);
    expect(big.hinge).toEqual({ x: 100, y: 5 });
    expect(small.hinge).toEqual({ x: 220, y: 5 });

    const [bigEnd, smallEnd] = doorLeaves(wall, { ...door, leaves: 'asym', hinge: 'end', width: 100 });
    expect(bigEnd.width).toBe(67);
    expect(bigEnd.hinge).toEqual({ x: 200, y: 5 });
    expect(smallEnd.width).toBe(33);
    expect(smallEnd.hinge).toEqual({ x: 100, y: 5 });
  });

  it('바깥여닫이는 벽 반대쪽 면에서 연다', () => {
    const [l] = doorLeaves(wall, { ...door, swingIn: false, leaves: 'double' });
    expect(l.hinge).toEqual({ x: 100, y: -5 });
    expect(l.open).toEqual({ x: 0, y: -1 });
  });

  it('doorSwings는 모든 문의 문짝 부채꼴을 모은다', () => {
    const plan: Plan = {
      ...SAMPLE_PLAN,
      walls: [wall],
      openings: [door, { ...door, id: 'o2', offset: 250, leaves: 'double' }],
    };
    expect(doorSwings(plan)).toHaveLength(3);
  });

  it('벽 끝을 넘는 문은 벽 안쪽으로 잘린다 (spec §30.2)', () => {
    const [l] = doorLeaves(wall, { ...door, offset: 350, width: 90 });
    expect(l.width).toBe(50);
    expect(l.hinge).toEqual({ x: 350, y: 5 });
  });

  it('벽 밖으로 완전히 나간 문은 문짝이 없다', () => {
    expect(doorLeaves(wall, { ...door, offset: 500, width: 90 })).toHaveLength(0);
  });
});
