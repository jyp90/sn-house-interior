import { describe, expect, it } from 'vitest';
import { PlanSchema } from './schema';
import { SAMPLE_PLAN } from './samplePlan';

describe('PlanSchema', () => {
  it('샘플 평면은 스키마를 통과한다', () => {
    expect(PlanSchema.safeParse(SAMPLE_PLAN).success).toBe(true);
  });

  it('아이템 좌표가 정수가 아니면 실패한다', () => {
    const bad = { ...SAMPLE_PLAN, items: [{ id: 'i1', productId: 'p', variantId: 'v', x: 1.5, y: 0, rotation: 0 }] };
    expect(PlanSchema.safeParse(bad).success).toBe(false);
  });

  it('알 수 없는 개구부 종류는 실패한다', () => {
    const bad = {
      ...SAMPLE_PLAN,
      openings: [{ ...SAMPLE_PLAN.openings[0], kind: 'garage' }],
    };
    expect(PlanSchema.safeParse(bad).success).toBe(false);
  });

  it('version이 1이 아니면 실패한다', () => {
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, version: 2 }).success).toBe(false);
  });
});
