import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { planToJson, readPlanFile } from './file';

describe('file', () => {
  it('JSON으로 내보낸 평면을 다시 읽는다', async () => {
    const r = await readPlanFile(new Blob([planToJson(SAMPLE_PLAN)]));
    expect(r).toEqual({ ok: true, plan: SAMPLE_PLAN });
  });

  it('readPlanFile은 JSON이 아니면 실패한다', async () => {
    expect(await readPlanFile(new Blob(['<html>']))).toEqual({ ok: false, error: 'JSON 형식이 아닙니다' });
  });
});
