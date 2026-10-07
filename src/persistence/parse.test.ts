import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { parsePlan } from './parse';

describe('parsePlan', () => {
  it('정상 평면은 통과한다', () => {
    expect(parsePlan(JSON.parse(JSON.stringify(SAMPLE_PLAN)))).toEqual({ ok: true, plan: SAMPLE_PLAN });
  });

  it('parsePlan은 버전이 다르면 실패한다', () => {
    const r = parsePlan({ ...SAMPLE_PLAN, version: 2 });
    expect(r).toEqual({ ok: false, error: '지원하지 않는 파일 버전입니다: 2' });
  });

  it('객체가 아니면 실패한다', () => {
    expect(parsePlan('hello').ok).toBe(false);
    expect(parsePlan(null).ok).toBe(false);
  });

  it('필드 오류는 경로를 포함한다', () => {
    const r = parsePlan({ ...SAMPLE_PLAN, walls: [{ ...SAMPLE_PLAN.walls[0], thickness: -1 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('walls.0.thickness');
  });
});
