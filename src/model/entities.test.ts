import { describe, expect, it } from 'vitest';
import { findEntity } from './entities';
import { SAMPLE_PLAN } from './samplePlan';

const plan = { ...SAMPLE_PLAN, items: [{ id: 'item-1', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 }] };

describe('findEntity', () => {
  it('id로 아이템·벽·개구부·방을 찾는다', () => {
    expect(findEntity(plan, 'item-1')?.kind).toBe('item');
    expect(findEntity(plan, 'w1')).toEqual({ kind: 'wall', wall: plan.walls[0] });
    expect(findEntity(plan, 'o1')?.kind).toBe('opening');
    expect(findEntity(plan, 'r1')?.kind).toBe('room');
  });

  it('없는 id나 null은 null', () => {
    expect(findEntity(plan, 'nope')).toBeNull();
    expect(findEntity(plan, null)).toBeNull();
  });
});
