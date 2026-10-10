import { describe, expect, it } from 'vitest';
import { findProduct } from '../catalog/products';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Plan, Product } from '../model/schema';
import type { ItemStatus } from '../validation/validate';
import { DEFAULT_CHECKLIST, PHASES } from './defaults';
import { shortHash } from './hash';
import { autoChecklist, checklistEntry, checklistItems } from './items';

const resolve = (plan: Plan) => (id: string) => findProduct(plan, id);
const washer = { id: 'wa', productId: 'samsung-grande-washer-sample', variantId: 'white', x: 300, y: 200, rotation: 0 };
const sofa = { id: 'so', productId: 'sofa-3seat', variantId: 'gray', x: 175, y: 200, rotation: 0 };
const clean: Record<string, ItemStatus> = {};

describe('기본 항목', () => {
  it('시공 중 검수 공정 순서, 주방(자동 전용) 외 공정마다 3개 이상, id는 i- 접두어로 겹치지 않는다', () => {
    expect(PHASES.map((p) => p.label)).toEqual(['공통', '철거', '샷시·창호', '목공·전기', '타일', '도배', '장판', '주방']);
    for (const p of PHASES.filter((p) => p.id !== 'kitchen')) {
      expect(DEFAULT_CHECKLIST.filter((i) => i.phase === p.id).length).toBeGreaterThanOrEqual(3);
    }
    expect(DEFAULT_CHECKLIST.some((i) => i.phase === 'kitchen')).toBe(false);
    expect(new Set(DEFAULT_CHECKLIST.map((i) => i.id)).size).toBe(DEFAULT_CHECKLIST.length);
    expect(DEFAULT_CHECKLIST.every((i) => !i.auto && i.id.startsWith('i-'))).toBe(true);
  });
  it('전력 증설·가스 배관 매립은 공사 전 신청(공통)과 덮기 전 확인(목공·전기)에 들어 있다 (스펙 §50)', () => {
    const phasesOf = (word: string) => [...new Set(DEFAULT_CHECKLIST.filter((i) => i.text.includes(word)).map((i) => i.phase))].sort();
    expect(phasesOf('전력 증설')).toEqual(['carpentry', 'common']);
    expect(phasesOf('가스 배관')).toEqual(['carpentry', 'common']);
  });
  it('휴젠트 방충망은 샷시·창호, 디아망 벽지는 도배, 냉장고 가림·실링팬은 목공·전기에 들어 있고 기본 항목은 61개 (스펙 §51)', () => {
    const phasesOf = (word: string) => [...new Set(DEFAULT_CHECKLIST.filter((i) => i.text.includes(word)).map((i) => i.phase))];
    expect(phasesOf('휴젠트')).toEqual(['window']);
    expect(phasesOf('디아망')).toEqual(['wallpaper']);
    expect(phasesOf('냉장고 가림')).toEqual(['carpentry']);
    expect(phasesOf('실링팬')).toEqual(['carpentry']);
    expect(DEFAULT_CHECKLIST).toHaveLength(61);
  });
});

describe('autoChecklist', () => {
  it('전용회로 가전 목록과 콘센트 없음 경고', () => {
    const plan = withActiveItems(SAMPLE_PLAN, [washer, sofa]);
    const text = '전용회로 확인: 그랑데 드럼세탁기 (150cm 이내 전용회로 콘센트 없음: 그랑데 드럼세탁기)';
    expect(autoChecklist(plan, resolve(plan), clean)).toEqual([
      { id: `auto-circuit-${shortHash(text)}`, phase: 'carpentry', auto: true, text },
    ]);
  });

  it('자동 항목 id는 문구 해시를 붙여, 문구가 바뀌면 id도 바뀌고 같으면 유지된다', () => {
    const dryer = { id: 'dr', productId: 'samsung-grande-washer-sample', variantId: 'white', x: 450, y: 200, rotation: 0 };
    const one = withActiveItems(SAMPLE_PLAN, [washer]);
    const two = withActiveItems(SAMPLE_PLAN, [washer, dryer]);
    const moved = withActiveItems(SAMPLE_PLAN, [{ ...washer, x: 310 }]);
    const circuitId = (p: Plan) => autoChecklist(p, resolve(p), clean).find((i) => i.id.startsWith('auto-circuit'))!.id;
    expect(circuitId(two)).not.toBe(circuitId(one));
    expect(circuitId(moved)).toBe(circuitId(one));
  });

  it('설비가 있으면 콘센트 위치 공유 항목을 만들고, 가까운 전용회로 콘센트가 있으면 경고를 뺀다', () => {
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [washer]),
      fixtures: [{ id: 'f', kind: 'outlet-dedicated', pos: { x: 356, y: 200 }, wallId: 'w5', height: 30 }],
    };
    const items = autoChecklist(plan, resolve(plan), clean);
    expect(items.map((i) => i.text)).toEqual([
      '전용회로 확인: 그랑데 드럼세탁기',
      '콘센트 위치 공유: 전용회로 콘센트 1개 — 전기 계획도·전기 설비 목록 참고',
    ]);
    expect(items.map((i) => i.id)).toEqual([`auto-circuit-${shortHash(items[0].text)}`, 'auto-outlets']);
  });

  it('스위치 그룹이 있으면 스위치 회로 전달 항목(그룹 이름 순, 한쪽이 비면 「없음」)을 콘센트 공유 뒤에 만든다', () => {
    const f = (id: string, kind: 'switch' | 'light' | 'outlet', group?: string) => ({
      id, kind, pos: { x: 100, y: 100 }, height: 120, ...(group ? { group } : {}),
    });
    const plan: Plan = {
      ...SAMPLE_PLAN,
      fixtures: [f('s1', 'switch', '침실1'), f('s2', 'switch', '거실'), f('l1', 'light', '거실'), f('l2', 'light', '거실'), f('o1', 'outlet', '거실'), f('l3', 'light')],
    };
    const items = autoChecklist(plan, resolve(plan), clean);
    const text = '스위치 회로 전달: 거실(스위치 1·조명 2), 침실1(스위치 1·조명 없음)';
    expect(items.map((i) => i.id)).toEqual(['auto-outlets', `auto-switch-${shortHash(text)}`]);
    expect(items[1]).toEqual({ id: `auto-switch-${shortHash(text)}`, phase: 'carpentry', auto: true, text });
  });

  it('그룹이 없으면 스위치 회로 항목이 없다', () => {
    const plan: Plan = { ...SAMPLE_PLAN, fixtures: [{ id: 's', kind: 'switch', pos: { x: 1, y: 1 }, height: 120 }] };
    expect(autoChecklist(plan, resolve(plan), clean).some((i) => i.id.startsWith('auto-switch'))).toBe(false);
  });

  it('빌트인 제품마다 치수(미확인 ≈)와 벽 기준 위치', () => {
    const builtIn: Product = {
      id: 'custom-dw', brand: 'custom', model: '', name: '식기세척기', category: 'kitchen',
      dims: { w: 60, d: 60, h: 85 }, variants: [{ id: 'v', label: '기본', colors: {} }],
      builder: 'box', clearances: [], builtIn: true, mount: 'floor',
    };
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [{ id: 'dw', productId: 'custom-dw', variantId: 'v', x: 100, y: 60, rotation: 0 }]),
      customProducts: [builtIn],
    };
    const text = '빌트인 치수 전달: 식기세척기 ≈60×60×85cm, 왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm';
    expect(autoChecklist(plan, resolve(plan), clean)).toEqual([
      { id: `auto-builtin-dw-${shortHash('식기세척기 60×60×85 미확인')}`, phase: 'kitchen', auto: true, text },
    ]);
    const verified = withActiveItems(plan, [{ id: 'dw', productId: 'custom-dw', variantId: 'v', x: 100, y: 60, rotation: 0, verified: true }]);
    expect(autoChecklist(verified, resolve(verified), clean)[0].text).toBe(
      '빌트인 치수 전달: 식기세척기 60×60×85cm, 왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm',
    );
  });

  it('빌트인 항목 id는 제품·치수·확인 여부만 해시해, 옮겨도 유지되고 치수·이름이 바뀌면 바뀐다', () => {
    const base: Product = {
      id: 'custom-dw', brand: 'custom', model: '', name: '식기세척기', category: 'kitchen',
      dims: { w: 60, d: 60, h: 85 }, variants: [{ id: 'v', label: '기본', colors: {} }],
      builder: 'box', clearances: [], builtIn: true, mount: 'floor',
    };
    const at = (product: Product, x: number, verified?: boolean): Plan => ({
      ...withActiveItems(SAMPLE_PLAN, [{ id: 'dw', productId: 'custom-dw', variantId: 'v', x, y: 60, rotation: 0, ...(verified ? { verified } : {}) }]),
      customProducts: [product],
    });
    const id = (p: Plan) => autoChecklist(p, resolve(p), clean)[0].id;
    const original = id(at(base, 100));
    expect(id(at(base, 101))).toBe(original);
    expect(autoChecklist(at(base, 101), resolve(at(base, 101)), clean)[0].text).not.toBe(autoChecklist(at(base, 100), resolve(at(base, 100)), clean)[0].text);
    expect(id(at({ ...base, dims: { w: 59, d: 60, h: 85 } }, 100))).not.toBe(original);
    expect(id(at({ ...base, name: '식기세척기 14인용' }, 100))).not.toBe(original);
    expect(id(at(base, 100, true))).not.toBe(original);
  });

  it('빌트인 제품에 설치 높이가 있으면 치수 뒤에 바닥에서 높이를 덧붙인다', () => {
    const upper: Product = {
      id: 'c-upper', brand: 'custom', model: '', name: '상부장', category: 'kitchen',
      dims: { w: 240, d: 35, h: 70 }, variants: [{ id: 'v', label: '기본', colors: {} }],
      builder: 'cabinet-run', clearances: [], builtIn: true, mount: 'wall', elevation: 145,
    };
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [{ id: 'u', productId: 'c-upper', variantId: 'v', x: 150, y: 40, rotation: 0 }]),
      customProducts: [upper],
    };
    const items = autoChecklist(plan, resolve(plan), clean);
    const item = items.find((i) => i.id.startsWith('auto-builtin-u-'));
    expect(item?.text.endsWith(', 바닥에서 145cm')).toBe(true);
  });

  it('문 열림 간섭이 남은 가구(충돌 줄은 빼고)', () => {
    const plan = withActiveItems(SAMPLE_PLAN, [sofa]);
    const status: Record<string, ItemStatus> = {
      so: {
        collides: true,
        clearanceBlocked: false,
        blocksDoor: true,
        conflicts: [
          { type: 'collides', target: { kind: 'wall', id: 'w1' } },
          { type: 'blocksDoor', target: { kind: 'door', id: 'o1' } },
        ],
      },
    };
    const text = '문 열림 간섭 해결: 3인 소파 — 방문 열림 간섭: 문';
    expect(autoChecklist(plan, resolve(plan), status)).toEqual([
      { id: `auto-door-so-${shortHash(text)}`, phase: 'carpentry', auto: true, text },
    ]);
  });
});

describe('checklistItems / checklistEntry', () => {
  it('공정 순서대로, 공정 안에서는 기본 항목 다음 자동 항목', () => {
    const plan = withActiveItems(SAMPLE_PLAN, [washer]);
    const items = checklistItems(plan, resolve(plan));
    expect(items[0].phase).toBe('common');
    const phases = items.map((i) => PHASES.findIndex((p) => p.id === i.phase));
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    const carpentry = items.filter((i) => i.phase === 'carpentry');
    expect(carpentry.at(-1)?.id).toMatch(/^auto-circuit-[0-9a-z]+$/);
    expect(items).toHaveLength(DEFAULT_CHECKLIST.length + 1);
  });

  it('저장된 상태를 id로 찾는다', () => {
    const plan: Plan = { ...SAMPLE_PLAN, checklist: [{ itemId: 'i-demo-1', checked: true }] };
    expect(checklistEntry(plan, 'i-demo-1')).toEqual({ itemId: 'i-demo-1', checked: true });
    expect(checklistEntry(plan, 'i-demo-2')).toBeUndefined();
  });
});
