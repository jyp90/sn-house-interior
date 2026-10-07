import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { parsePlan, migrate } from './parse';

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

describe('migrate', () => {
  it('현재 버전은 그대로 돌려준다', () => {
    const raw = { version: 1, a: 1 };
    expect(migrate(raw)).toBe(raw);
  });

  it('등록된 변환을 순서대로 적용해 현재 버전까지 올린다', () => {
    const steps = {
      0: (r: Record<string, unknown>) => ({ ...r, version: 1, info: { title: '이전 파일' } }),
    };
    expect(migrate({ version: 0 }, steps, 1)).toEqual({ version: 1, info: { title: '이전 파일' } });
  });

  it('변환이 없거나 현재보다 높은 버전은 null', () => {
    expect(migrate({ version: 0 })).toBeNull();
    expect(migrate({ version: 2 })).toBeNull();
    expect(migrate({})).toBeNull();
  });
});
