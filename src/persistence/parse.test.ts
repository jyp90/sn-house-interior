import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { parsePlan, migrate } from './parse';

describe('parsePlan', () => {
  it('정상 평면은 통과한다', () => {
    expect(parsePlan(JSON.parse(JSON.stringify(SAMPLE_PLAN)))).toEqual({ ok: true, plan: SAMPLE_PLAN });
  });

  it('parsePlan은 버전이 다르면 실패한다', () => {
    const r = parsePlan({ ...SAMPLE_PLAN, version: 6 });
    expect(r).toEqual({ ok: false, error: '지원하지 않는 파일 버전입니다: 6' });
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

  it('v3 파일은 v4로 올라가고 마감 필드 없이도 통과한다', () => {
    const r = parsePlan({ ...JSON.parse(JSON.stringify(SAMPLE_PLAN)), version: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.version).toBe(5);
  });

  it('방 영역·마감과 기본 마감을 받는다', () => {
    const raw = JSON.parse(JSON.stringify(SAMPLE_PLAN));
    raw.rooms[0] = { ...raw.rooms[0], polygon: [{ x: 10, y: 10 }, { x: 340, y: 10 }, { x: 340, y: 390 }, { x: 10, y: 390 }], floor: { material: 'wood', color: '#c9a06c' }, wall: { material: 'paint', color: '#f4f1ec' } };
    raw.finish = { floor: { material: 'tile', color: '#b8b5ae' }, wall: { material: 'wallpaper', color: '#e8dcc8' } };
    const r = parsePlan(raw);
    expect(r.ok).toBe(true);
  });

  it('영역은 3점 이상, 색은 #rrggbb만 받는다', () => {
    const raw = JSON.parse(JSON.stringify(SAMPLE_PLAN));
    raw.rooms[0] = { ...raw.rooms[0], polygon: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    expect(parsePlan(raw).ok).toBe(false);
    const raw2 = JSON.parse(JSON.stringify(SAMPLE_PLAN));
    raw2.rooms[0] = { ...raw2.rooms[0], floor: { material: 'wood', color: 'red' } };
    expect(parsePlan(raw2).ok).toBe(false);
  });

  it('v4 파일은 v5로 올라가고 elevation 없이도 통과한다', () => {
    const r = parsePlan({ ...JSON.parse(JSON.stringify(SAMPLE_PLAN)), version: 4 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.version).toBe(5);
  });

  it('v5: 아이템 elevation은 0 이상 정수, 제품 mount는 ceiling도 된다', () => {
    const raw = JSON.parse(JSON.stringify(SAMPLE_PLAN));
    raw.customProducts = [{
      id: 'c1', brand: '일반', model: '', name: '천장 박스', category: 'bath', dims: { w: 80, d: 80, h: 25 },
      variants: [{ id: 'v', label: '기본', colors: {} }], builder: 'ceiling-ac', clearances: [], builtIn: false, mount: 'ceiling', elevation: 205,
    }];
    raw.layouts[0].items = [{ id: 'i1', productId: 'c1', variantId: 'v', x: 100, y: 100, rotation: 0, elevation: 200 }];
    expect(parsePlan(raw).ok).toBe(true);
    raw.layouts[0].items[0].elevation = -1;
    expect(parsePlan(raw).ok).toBe(false);
    raw.layouts[0].items[0].elevation = 1.5;
    expect(parsePlan(raw).ok).toBe(false);
  });
});

describe('migrate', () => {
  it('현재 버전은 그대로 돌려준다', () => {
    const raw = { version: 5, a: 1 };
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
    expect(migrate({ version: 6 })).toBeNull();
    expect(migrate({})).toBeNull();
  });

  it('버전을 올리지 않는 변환은 반복하지 않고 null', () => {
    let calls = 0;
    // 1000번째 호출부터 버전을 올리게 해서, 가드가 없는 구현도 테스트가 끝나게(RED가 멈추지 않게) 한다
    const steps = { 0: (r: Record<string, unknown>) => (++calls > 1000 ? { ...r, version: 1 } : { ...r }) };
    expect(migrate({ version: 0 }, steps, 1)).toBeNull();
    expect(calls).toBe(1);
  });

  it('v1 평면은 아이템을 A안으로 옮겨 v2가 된다', () => {
    const item = { id: 'i', productId: 'p', variantId: 'v', x: 1, y: 2, rotation: 0 };
    const v1 = {
      version: 1,
      info: SAMPLE_PLAN.info,
      walls: SAMPLE_PLAN.walls,
      openings: SAMPLE_PLAN.openings,
      rooms: SAMPLE_PLAN.rooms,
      items: [item],
      fixtures: [],
      checklist: [],
      customProducts: [],
    };
    const r = parsePlan(v1);
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.version).toBe(5);
    expect(r.plan.layouts).toEqual([{ id: 'layout-a', name: 'A안', items: [item] }]);
    expect(r.plan.activeLayoutId).toBe('layout-a');
  });

  it('v2 평면은 내용 그대로 v3가 되고, 문의 middle·leaves는 선택이다', () => {
    const v2 = { ...JSON.parse(JSON.stringify(SAMPLE_PLAN)), version: 2 };
    const r = parsePlan(v2);
    if (!r.ok) throw new Error(r.error);
    expect(r.plan).toEqual(SAMPLE_PLAN);
    expect(r.plan.openings[0]).not.toHaveProperty('middle');

    const withMiddle = { ...v2, openings: [{ ...v2.openings[0], middle: true, leaves: 'asym' }] };
    const m = parsePlan(withMiddle);
    if (!m.ok) throw new Error(m.error);
    expect(m.plan.openings[0]).toMatchObject({ middle: true, leaves: 'asym' });
    expect(parsePlan({ ...v2, openings: [{ ...v2.openings[0], leaves: 'sliding' }] }).ok).toBe(false);
  });
});
