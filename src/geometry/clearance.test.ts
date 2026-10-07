import { describe, expect, it } from 'vitest';
import type { Item, Plan, Product } from '../model/schema';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { doorSwings, itemClearances } from './clearance';

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
