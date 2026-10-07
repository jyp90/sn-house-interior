import { describe, expect, it } from 'vitest';
import { withActiveItems } from './layout';
import { PlanSchema } from './schema';
import { SAMPLE_PLAN } from './samplePlan';

describe('PlanSchema', () => {
  it('샘플 평면은 스키마를 통과한다', () => {
    expect(PlanSchema.safeParse(SAMPLE_PLAN).success).toBe(true);
  });

  it('아이템 좌표가 정수가 아니면 실패한다', () => {
    const bad = withActiveItems(SAMPLE_PLAN, [{ id: 'i1', productId: 'p', variantId: 'v', x: 1.5, y: 0, rotation: 0 }]);
    expect(PlanSchema.safeParse(bad).success).toBe(false);
  });

  it('알 수 없는 개구부 종류는 실패한다', () => {
    const bad = {
      ...SAMPLE_PLAN,
      openings: [{ ...SAMPLE_PLAN.openings[0], kind: 'garage' }],
    };
    expect(PlanSchema.safeParse(bad).success).toBe(false);
  });

  it('version이 2가 아니면 실패한다', () => {
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, version: 1 }).success).toBe(false);
  });

  it('벽 끝점 좌표가 정수가 아니면 실패한다', () => {
    const bad = {
      ...SAMPLE_PLAN,
      walls: [{ ...SAMPLE_PLAN.walls[0], a: { x: 10.5, y: 0 } }, ...SAMPLE_PLAN.walls.slice(1)],
    };
    expect(PlanSchema.safeParse(bad).success).toBe(false);
  });

  it('verified·locked는 선택 필드다', () => {
    const plan = withActiveItems(
      { ...SAMPLE_PLAN, walls: [{ ...SAMPLE_PLAN.walls[0], verified: true }, ...SAMPLE_PLAN.walls.slice(1)] },
      [{ id: 'i', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0, locked: true, verified: false }],
    );
    expect(PlanSchema.safeParse(plan).success).toBe(true);
  });

  it('배경은 이미지 크기와 축척 보정 정보를 가진다', () => {
    const background = {
      imageRef: 'image-1', widthPx: 400, heightPx: 300, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 0.5,
      calibration: { a: { x: 0.5, y: 0 }, b: { x: 400, y: 0 }, lengthCm: 400, check: { a: { x: 0, y: 0 }, b: { x: 0, y: 300 }, lengthCm: 300 } },
    };
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, background }).success).toBe(true);
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, background: { ...background, widthPx: 0 } }).success).toBe(false);
  });

  it('배치안은 하나 이상이고 activeLayoutId는 그 안에 있어야 한다', () => {
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, layouts: [] }).success).toBe(false);
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, activeLayoutId: 'nope' }).success).toBe(false);
  });
});
