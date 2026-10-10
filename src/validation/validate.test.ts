import { describe, expect, it } from 'vitest';
import { withActiveItems } from '../model/layout';
import type { Item, Plan, Product } from '../model/schema';
import { emptyPlanFields } from '../model/samplePlan';
import { validatePlan } from './validate';

const base = (over: Partial<Product>): Product => ({
  id: 'x', brand: 't', model: 'm', name: 'n', category: 'kitchen', dims: { w: 91, d: 93, h: 185 },
  variants: [{ id: 'v', label: 'v', colors: {} }], builder: 'box', clearances: [], builtIn: false, mount: 'floor', ...over,
});
const products: Record<string, Product> = {
  fridge: base({ id: 'fridge', clearances: [{ kind: 'swing', hinge: 'left', radius: 45 }, { kind: 'swing', hinge: 'right', radius: 45 }] }),
  bench: base({ id: 'bench', dims: { w: 100, d: 50, h: 45 } }),
  cube: base({ id: 'cube', dims: { w: 50, d: 50, h: 50 } }),
  tv: base({ id: 'tv', dims: { w: 160, d: 3, h: 90 }, mount: 'wall' }),
  upper: base({ id: 'upper', dims: { w: 240, d: 35, h: 70 }, mount: 'wall', elevation: 145, clearances: [{ kind: 'front', depth: 40 }] }),
  table: base({ id: 'table', dims: { w: 140, d: 80, h: 74 } }),
  counter: base({ id: 'counter', dims: { w: 240, d: 60, h: 87 } }),
  cooktop: base({ id: 'cooktop', dims: { w: 60, d: 52, h: 6 }, elevation: 87 }),
  ceilingAc: base({ id: 'ceilingAc', dims: { w: 84, d: 84, h: 25 }, mount: 'ceiling' }),
  washer: base({ id: 'washer', dims: { w: 70, d: 85, h: 110 } }),
  dryer: base({ id: 'dryer', dims: { w: 70, d: 85, h: 85 } }),
};
const resolve = (id: string) => products[id];
const item = (id: string, productId: string, x: number, y: number, rotation = 0, elevation?: number): Item => ({ id, productId, variantId: 'v', x, y, rotation, ...(elevation === undefined ? {} : { elevation }) });
const plan = ({ items = [], ...over }: Partial<Plan> & { items?: Item[] }): Plan =>
  withActiveItems({ version: 10, info: { title: 't' }, walls: [], openings: [], rooms: [], ...emptyPlanFields(), ...over }, items);

describe('validatePlan', () => {
  it('겹친 두 아이템은 둘 다 충돌', () => {
    const s = validatePlan(plan({ items: [item('a', 'fridge', 100, 100), item('b', 'fridge', 150, 100)] }), resolve);
    expect(s.a.collides).toBe(true);
    expect(s.b.collides).toBe(true);
  });

  it('냉장고 문 앞을 막으면 냉장고의 clearanceBlocked만 켜진다', () => {
    const s = validatePlan(plan({ items: [item('a', 'fridge', 100, 100), item('b', 'bench', 100, 175)] }), resolve);
    expect(s.a).toMatchObject({ collides: false, clearanceBlocked: true, blocksDoor: false });
    expect(s.b).toMatchObject({ collides: false, clearanceBlocked: false, blocksDoor: false });
  });

  it('벽을 파고들면 충돌', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 20, height: 230 }];
    const s = validatePlan(plan({ walls, items: [item('a', 'cube', 100, 20)] }), resolve);
    expect(s.a.collides).toBe(true);
  });

  it('벽걸이 TV는 바닥 가구와 겹쳐도 충돌이 아니다', () => {
    const s = validatePlan(plan({ items: [item('t', 'tv', 100, 100), item('b', 'bench', 100, 100)] }), resolve);
    expect(s.t.collides).toBe(false);
    expect(s.b.collides).toBe(false);
  });

  it('방문 열림 영역 안의 아이템은 blocksDoor', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 }];
    const openings = [{ id: 'o', wallId: 'w', kind: 'door' as const, offset: 100, width: 80, height: 210, sill: 0, hinge: 'start' as const, swingIn: true }];
    const s = validatePlan(plan({ walls, openings, items: [item('a', 'cube', 140, 60)] }), resolve);
    expect(s.a).toMatchObject({ collides: false, clearanceBlocked: false, blocksDoor: true });
  });

  it('슬라이딩 문 앞의 아이템은 blocksDoor가 아니다 (spec §47)', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 }];
    const openings = [{ id: 'o', wallId: 'w', kind: 'door' as const, offset: 100, width: 80, height: 210, sill: 0, hinge: 'start' as const, swingIn: true, leaves: 'sliding' as const }];
    const s = validatePlan(plan({ walls, openings, items: [item('a', 'cube', 140, 60)] }), resolve);
    expect(s.a).toMatchObject({ collides: false, clearanceBlocked: false, blocksDoor: false, conflicts: [] });
  });

  it('알 수 없는 제품은 오류 없이 상태 false이고 다른 아이템에 영향을 주지 않는다', () => {
    const s = validatePlan(plan({ items: [item('a', 'missing', 100, 100), item('b', 'cube', 100, 100)] }), resolve);
    expect(s.a).toMatchObject({ collides: false, clearanceBlocked: false, blocksDoor: false });
    expect(s.b.collides).toBe(false);
  });

  it('사유에 상대 아이템·벽·문을 담고 같은 대상은 한 번만', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 20, height: 230 }];
    const openings = [{ id: 'o', wallId: 'w', kind: 'door' as const, offset: 200, width: 80, height: 210, sill: 0, hinge: 'start' as const, swingIn: true }];
    const s = validatePlan(plan({ walls, openings, items: [item('a', 'cube', 100, 20), item('b', 'cube', 120, 30), item('c', 'cube', 240, 50)] }), resolve);
    expect(s.a.conflicts).toEqual([
      { type: 'collides', target: { kind: 'wall', id: 'w' } },
      { type: 'collides', target: { kind: 'item', id: 'b' } },
    ]);
    expect(s.c.conflicts).toEqual([{ type: 'blocksDoor', target: { kind: 'door', id: 'o' } }]);
  });

  it('벽걸이 TV(90–180)와 냉장고(0–185)는 세로로 겹치므로 충돌', () => {
    const s = validatePlan(plan({ items: [item('t', 'tv', 100, 100), item('f', 'fridge', 100, 100)] }), resolve);
    expect(s.t.collides).toBe(true);
    expect(s.f.collides).toBe(true);
  });

  it('상판(0–87) 위 인덕션(87–93)은 충돌이 아니다', () => {
    const s = validatePlan(plan({ items: [item('c', 'counter', 120, 30), item('i', 'cooktop', 120, 30)] }), resolve);
    expect(s.c.collides).toBe(false);
    expect(s.i.collides).toBe(false);
  });

  it('세탁기 위 직렬 건조기(elevation 110)는 충돌이 아니고, 바닥에 두면 충돌', () => {
    const stacked = validatePlan(plan({ items: [item('w', 'washer', 100, 100), item('d', 'dryer', 100, 100, 0, 110)] }), resolve);
    expect(stacked.w.collides).toBe(false);
    expect(stacked.d.collides).toBe(false);
    const floor = validatePlan(plan({ items: [item('w', 'washer', 100, 100), item('d', 'dryer', 100, 100)] }), resolve);
    expect(floor.d.collides).toBe(true);
  });

  it('상부장 아래 식탁은 앞 공간을 막지 않고, 냉장고는 막는다', () => {
    const under = validatePlan(plan({ items: [item('u', 'upper', 120, 17), item('t', 'table', 120, 70)] }), resolve);
    expect(under.u.clearanceBlocked).toBe(false);
    const fridge = validatePlan(plan({ items: [item('u', 'upper', 120, 17), item('f', 'fridge', 120, 90)] }), resolve);
    expect(fridge.u.clearanceBlocked).toBe(true);
  });

  it('문 높이 구간과 겹치는 아이템만 blocksDoor: 상부장은 간섭, 문 위 천장형 에어컨은 아님', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 240 }];
    const openings = [{ id: 'o', wallId: 'w', kind: 'door' as const, offset: 100, width: 80, height: 210, sill: 0, hinge: 'start' as const, swingIn: true }];
    const s = validatePlan(plan({ walls, openings, items: [item('u', 'upper', 140, 60), item('a', 'ceilingAc', 140, 60)] }), resolve);
    expect(s.u.blocksDoor).toBe(true); // 145–215 vs 0–210
    expect(s.a.blocksDoor).toBe(false); // 천장 240 → 215–240 vs 0–210
  });

  it('벽 높이 위에 있는 아이템은 벽과 충돌하지 않는다', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 20, height: 100 }];
    const s = validatePlan(plan({ walls, items: [item('a', 'cube', 100, 20, 0, 150)] }), resolve);
    expect(s.a.collides).toBe(false);
  });
});
