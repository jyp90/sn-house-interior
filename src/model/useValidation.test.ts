import { describe, expect, it } from 'vitest';
import { findProduct } from '../catalog/products';
import { validatePlan } from '../validation/validate';
import { withActiveItems } from './layout';
import { SAMPLE_PLAN } from './samplePlan';
import { planValidation } from './useValidation';

describe('planValidation', () => {
  it('같은 평면 객체는 validatePlan을 한 번만 돌려 같은 결과 객체를 공유한다', () => {
    const first = planValidation(SAMPLE_PLAN);
    expect(first).toEqual(validatePlan(SAMPLE_PLAN, (id) => findProduct(SAMPLE_PLAN, id)));
    expect(planValidation(SAMPLE_PLAN)).toBe(first);
  });

  it('withActiveItems로 만든 새 평면은 새로 계산한다', () => {
    const first = planValidation(SAMPLE_PLAN);
    const next = withActiveItems(SAMPLE_PLAN, []);
    const second = planValidation(next);
    expect(second).not.toBe(first);
    expect(second).toEqual({});
  });
});
