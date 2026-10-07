import { describe, expect, it } from 'vitest';
import { findProduct } from '../catalog/products';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Fixture, Plan } from '../model/schema';
import { DEDICATED_RADIUS_CM, fixtureSummary, missingDedicatedCircuit, snapFixture } from './fixtures';

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
