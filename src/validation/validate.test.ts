import { describe, expect, it } from 'vitest';
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
};
const resolve = (id: string) => products[id];
const item = (id: string, productId: string, x: number, y: number, rotation = 0): Item => ({ id, productId, variantId: 'v', x, y, rotation });
const plan = (over: Partial<Plan>): Plan => ({
  version: 1, info: { title: 't' }, walls: [], openings: [], rooms: [], ...emptyPlanFields(), ...over,
});

describe('validatePlan', () => {
  it('겹친 두 아이템은 둘 다 충돌', () => {
    const s = validatePlan(plan({ items: [item('a', 'fridge', 100, 100), item('b', 'fridge', 150, 100)] }), resolve);
    expect(s.a.collides).toBe(true);
    expect(s.b.collides).toBe(true);
  });

  it('냉장고 문 앞을 막으면 냉장고의 clearanceBlocked만 켜진다', () => {
    const s = validatePlan(plan({ items: [item('a', 'fridge', 100, 100), item('b', 'bench', 100, 175)] }), resolve);
    expect(s.a).toEqual({ collides: false, clearanceBlocked: true, blocksDoor: false });
    expect(s.b).toEqual({ collides: false, clearanceBlocked: false, blocksDoor: false });
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
    expect(s.a).toEqual({ collides: false, clearanceBlocked: false, blocksDoor: true });
  });

  it('알 수 없는 제품은 오류 없이 상태 false이고 다른 아이템에 영향을 주지 않는다', () => {
    const s = validatePlan(plan({ items: [item('a', 'missing', 100, 100), item('b', 'cube', 100, 100)] }), resolve);
    expect(s.a).toEqual({ collides: false, clearanceBlocked: false, blocksDoor: false });
    expect(s.b.collides).toBe(false);
  });
});
