import { describe, expect, it } from 'vitest';
import { findProduct } from '../catalog/products';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Fixture, Plan, Wall } from '../model/schema';
import {
  DEDICATED_RADIUS_CM,
  fixtureNumbers,
  fixtureSummary,
  keepWallIdAfterMove,
  kindChangePatch,
  missingDedicatedCircuit,
  refitFixtures,
  snapFixture,
  switchGroups,
  switchLinks,
} from './fixtures';

const walls = SAMPLE_PLAN.walls;
const washer = { id: 'wa', productId: 'samsung-grande-washer-sample', variantId: 'white', x: 300, y: 200, rotation: 0 };
const fixture = (kind: Fixture['kind'], x: number, y: number): Fixture => ({ id: `f-${kind}-${x}`, kind, pos: { x, y }, height: 30 });
const withFixtures = (plan: Plan, fixtures: Fixture[]): Plan => ({ ...plan, fixtures });
const resolve = (plan: Plan) => (id: string) => findProduct(plan, id);

describe('snapFixture', () => {
  it('벽 중심선 30cm 이내면 클릭한 쪽 벽면에 붙이고 wallId를 남긴다', () => {
    expect(snapFixture(walls, { x: 100, y: 25 }, 'outlet', true)).toEqual({ pos: { x: 100, y: 10 }, wallId: 'w1' });
    expect(snapFixture(walls, { x: 100, y: -25 }, 'outlet', true)).toEqual({ pos: { x: 100, y: -10 }, wallId: 'w1' });
    expect(snapFixture(walls, { x: 25, y: 200 }, 'switch', true)).toEqual({ pos: { x: 10, y: 200 }, wallId: 'w4' });
    expect(snapFixture(walls, { x: 360, y: 200 }, 'outlet-dedicated', true)).toEqual({ pos: { x: 356, y: 200 }, wallId: 'w5' });
  });

  it('벽 끝을 넘는 클릭은 벽 끝에 붙인다', () => {
    expect(snapFixture(walls, { x: 615, y: -20 }, 'outlet', true)).toEqual({ pos: { x: 600, y: -10 }, wallId: 'w1' });
  });

  it('스냅을 끄거나, 조명이거나, 벽이 멀면 클릭한 자리(정수 cm)에 둔다', () => {
    expect(snapFixture(walls, { x: 100.4, y: 25.6 }, 'outlet', false)).toEqual({ pos: { x: 100, y: 26 } });
    expect(snapFixture(walls, { x: 100, y: 25 }, 'light', true)).toEqual({ pos: { x: 100, y: 25 } });
    expect(snapFixture(walls, { x: 300, y: 200 }, 'outlet', true)).toEqual({ pos: { x: 300, y: 200 } });
  });
});

describe('missingDedicatedCircuit', () => {
  const base = withActiveItems(SAMPLE_PLAN, [washer]);

  it('전용회로 가전 중심 150cm 이내에 전용회로 콘센트가 없으면 경고', () => {
    expect(DEDICATED_RADIUS_CM).toBe(150);
    expect(missingDedicatedCircuit(base, resolve(base))).toEqual(['wa']);
  });

  it('150cm 이내 전용회로 콘센트가 있으면 경고하지 않는다', () => {
    const plan = withFixtures(base, [fixture('outlet-dedicated', 356, 200)]);
    expect(missingDedicatedCircuit(plan, resolve(plan))).toEqual([]);
    const edge = withFixtures(base, [fixture('outlet-dedicated', 450, 200)]);
    expect(missingDedicatedCircuit(edge, resolve(edge))).toEqual([]);
  });

  it('150cm를 넘거나 일반 콘센트뿐이면 경고', () => {
    const far = withFixtures(base, [fixture('outlet-dedicated', 451, 200)]);
    expect(missingDedicatedCircuit(far, resolve(far))).toEqual(['wa']);
    const normal = withFixtures(base, [fixture('outlet', 310, 200)]);
    expect(missingDedicatedCircuit(normal, resolve(normal))).toEqual(['wa']);
  });

  it('전용회로가 필요 없는 가구와 다른 배치안의 가전은 보지 않는다', () => {
    const sofa = { id: 'so', productId: 'sofa-3seat', variantId: 'gray', x: 100, y: 100, rotation: 0 };
    const plan: Plan = {
      ...SAMPLE_PLAN,
      layouts: [
        { id: 'layout-a', name: 'A안', items: [sofa] },
        { id: 'layout-b', name: 'B안', items: [washer] },
      ],
      activeLayoutId: 'layout-a',
    };
    expect(missingDedicatedCircuit(plan, resolve(plan))).toEqual([]);
  });
});

describe('fixtureSummary', () => {
  it('종류별 개수를 정해진 순서로, 없는 종류는 빼고', () => {
    expect(fixtureSummary([fixture('light', 1, 1), fixture('outlet', 2, 2), fixture('outlet', 3, 3)])).toBe('콘센트 2개, 조명 1개');
    expect(fixtureSummary([])).toBe('');
  });
});

describe('fixtureNumbers', () => {
  it('plan.fixtures 순서대로 1부터', () => {
    const plan = withFixtures(SAMPLE_PLAN, [fixture('light', 1, 1), fixture('outlet', 2, 2)]);
    expect(fixtureNumbers(plan)).toEqual(new Map([['f-light-1', 1], ['f-outlet-2', 2]]));
  });
});

describe('refitFixtures', () => {
  const onW1: Fixture = { id: 'a', kind: 'outlet', pos: { x: 300, y: 10 }, wallId: 'w1', height: 30 };
  const outside: Fixture = { id: 'b', kind: 'outlet', pos: { x: 150, y: -10 }, wallId: 'w1', height: 30 };
  const free: Fixture = { id: 'c', kind: 'light', pos: { x: 200, y: 200 }, height: 230 };
  const onW4: Fixture = { id: 'd', kind: 'switch', pos: { x: 10, y: 200 }, wallId: 'w4', height: 120 };
  const replace = (id: string, patch: Partial<Wall>) => walls.map((w) => (w.id === id ? { ...w, ...patch } : w));

  it('벽 길이가 바뀌면 비율대로 옮기고 같은 쪽 벽면에 둔다', () => {
    const next = replace('w1', { b: { x: 300, y: 0 } });
    expect(refitFixtures(walls, next, [onW1, outside])).toEqual([
      { ...onW1, pos: { x: 150, y: 10 } },
      { ...outside, pos: { x: 75, y: -10 } },
    ]);
  });

  it('두께가 바뀌면 벽면까지 거리를 새 두께에 맞춘다', () => {
    const next = replace('w1', { thickness: 30 });
    expect(refitFixtures(walls, next, [onW1, outside])).toEqual([
      { ...onW1, pos: { x: 300, y: 15 } },
      { ...outside, pos: { x: 150, y: -15 } },
    ]);
  });

  it('벽이 기울면 따라 돈다', () => {
    const next = replace('w1', { b: { x: 600, y: -100 } });
    const [moved] = refitFixtures(walls, next, [onW1]);
    // 길이 608.3 → t = 300×608.3/600 = 304.1, 벽면 법선 쪽 10cm
    expect(moved.pos).toEqual({ x: 302, y: -40 });
    expect(moved.wallId).toBe('w1');
  });

  it('바뀌지 않은 벽·벽 없는 설비는 같은 객체, 사라진 벽은 wallId만 지운다', () => {
    const next = replace('w1', { thickness: 30 });
    const out = refitFixtures(walls, next, [free, onW4]);
    expect(out[0]).toBe(free);
    expect(out[1]).toBe(onW4);
    const gone = refitFixtures(walls, walls.filter((w) => w.id !== 'w1'), [onW1]);
    expect(gone).toEqual([{ id: 'a', kind: 'outlet', pos: { x: 300, y: 10 }, height: 30 }]);
    expect(gone[0]).not.toHaveProperty('wallId');
  });
});

describe('kindChangePatch', () => {
  const outlet: Fixture = { id: 'a', kind: 'outlet', pos: { x: 300, y: 10 }, wallId: 'w1', height: 30 };

  it('높이가 이전 종류 기본값이면 새 종류 기본값으로', () => {
    expect(kindChangePatch(outlet, 'switch')).toEqual({ kind: 'switch', height: 120 });
    expect(kindChangePatch(outlet, 'outlet-dedicated')).toEqual({ kind: 'outlet-dedicated', height: 30 });
  });

  it('높이를 바꿔 둔 설비는 높이를 유지한다', () => {
    expect(kindChangePatch({ ...outlet, height: 45 }, 'switch')).toEqual({ kind: 'switch' });
  });

  it('콘센트 종류로 바꾸면 스위치 그룹을 지우고, 스위치↔조명은 유지한다', () => {
    const sw: Fixture = { id: 's', kind: 'switch', pos: { x: 0, y: 0 }, height: 120, group: '거실' };
    expect(kindChangePatch(sw, 'outlet')).toHaveProperty('group', undefined);
    expect(kindChangePatch(sw, 'outlet-waterproof')).toHaveProperty('group', undefined);
    expect(kindChangePatch(sw, 'light')).not.toHaveProperty('group');
  });

  it('조명으로 바꾸면 벽에서 뗀다', () => {
    const patch = kindChangePatch(outlet, 'light');
    expect(patch).toEqual({ kind: 'light', height: 230, wallId: undefined });
    expect(patch).toHaveProperty('wallId');
  });
});

describe('keepWallIdAfterMove', () => {
  const outlet: Fixture = { id: 'a', kind: 'outlet', pos: { x: 300, y: 10 }, wallId: 'w1', height: 30 };

  it('벽 중심선에서 두께/2+1cm 이내면 wallId를 유지한다', () => {
    expect(keepWallIdAfterMove(walls, outlet, { x: 400, y: 10 })).toBe('w1');
    expect(keepWallIdAfterMove(walls, outlet, { x: 400, y: -11 })).toBe('w1');
  });

  it('벗어나면 wallId를 지운다', () => {
    expect(keepWallIdAfterMove(walls, outlet, { x: 400, y: 12 })).toBeUndefined();
    expect(keepWallIdAfterMove(walls, outlet, { x: 620, y: 10 })).toBeUndefined();
  });

  it('벽에 붙지 않았거나 벽이 없으면 undefined', () => {
    expect(keepWallIdAfterMove(walls, { ...outlet, wallId: undefined }, { x: 300, y: 10 })).toBeUndefined();
    expect(keepWallIdAfterMove(walls, { ...outlet, wallId: 'nope' }, { x: 300, y: 10 })).toBeUndefined();
  });
});

describe('switchGroups', () => {
  const g = (kind: Fixture['kind'], id: string, group?: string): Fixture => ({ id, kind, pos: { x: 0, y: 0 }, height: 30, ...(group ? { group } : {}) });

  it('그룹 이름별로 스위치·조명을 모으고 이름 순(ko)으로 정렬한다', () => {
    const s1 = g('switch', 's1', '침실1');
    const s2 = g('switch', 's2', '거실');
    const l1 = g('light', 'l1', '거실');
    const l2 = g('light', 'l2', '거실');
    expect(switchGroups([s1, l1, s2, l2])).toEqual([
      { name: '거실', switches: [s2], lights: [l1, l2] },
      { name: '침실1', switches: [s1], lights: [] },
    ]);
  });

  it('그룹 없는 설비와 콘센트 종류는 빠진다', () => {
    expect(
      switchGroups([g('switch', 's1'), g('outlet', 'o1', '거실'), g('outlet-waterproof', 'o2', '거실'), g('outlet-dedicated', 'o3', '거실')]),
    ).toEqual([]);
  });
});

describe('switchLinks', () => {
  it('그룹마다 스위치 × 조명 쌍을 만든다', () => {
    const f = (kind: Fixture['kind'], id: string, x: number, group?: string): Fixture => ({ id, kind, pos: { x, y: 0 }, height: 30, ...(group ? { group } : {}) });
    const s1 = f('switch', 's1', 0, '거실');
    const s2 = f('switch', 's2', 5, '거실');
    const l1 = f('light', 'l1', 10, '거실');
    const l2 = f('light', 'l2', 20, '침실');
    expect(switchLinks([s1, s2, l1, l2])).toEqual([
      { switchId: 's1', lightId: 'l1', a: { x: 0, y: 0 }, b: { x: 10, y: 0 } },
      { switchId: 's2', lightId: 'l1', a: { x: 5, y: 0 }, b: { x: 10, y: 0 } },
    ]);
  });
});
