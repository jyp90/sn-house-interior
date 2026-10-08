import { describe, expect, it } from 'vitest';
import { findProduct } from '../catalog/products';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Plan, Product } from '../model/schema';
import type { ItemStatus } from '../validation/validate';
import { DEFAULT_CHECKLIST, PHASES } from './defaults';
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
});

describe('autoChecklist', () => {
  it('전용회로 가전 목록과 콘센트 없음 경고', () => {
    const plan = withActiveItems(SAMPLE_PLAN, [washer, sofa]);
    expect(autoChecklist(plan, resolve(plan), clean)).toEqual([
      { id: 'auto-circuit', phase: 'carpentry', auto: true, text: '전용회로 확인: 그랑데 드럼세탁기 (150cm 이내 전용회로 콘센트 없음: 그랑데 드럼세탁기)' },
    ]);
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
    expect(items.map((i) => i.id)).toEqual(['auto-circuit', 'auto-outlets']);
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
    expect(autoChecklist(plan, resolve(plan), clean)).toEqual([
      {
        id: 'auto-builtin-dw',
        phase: 'kitchen',
        auto: true,
        text: '빌트인 치수 전달: 식기세척기 ≈60×60×85cm, 왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm',
      },
    ]);
    const verified = withActiveItems(plan, [{ id: 'dw', productId: 'custom-dw', variantId: 'v', x: 100, y: 60, rotation: 0, verified: true }]);
    expect(autoChecklist(verified, resolve(verified), clean)[0].text).toBe(
      '빌트인 치수 전달: 식기세척기 60×60×85cm, 왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm',
    );
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
    expect(autoChecklist(plan, resolve(plan), status)).toEqual([
      { id: 'auto-door-so', phase: 'carpentry', auto: true, text: '문 열림 간섭 해결: 3인 소파 — 방문 열림 간섭: 문' },
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
    expect(carpentry.at(-1)?.id).toBe('auto-circuit');
    expect(items).toHaveLength(DEFAULT_CHECKLIST.length + 1);
  });

  it('저장된 상태를 id로 찾는다', () => {
    const plan: Plan = { ...SAMPLE_PLAN, checklist: [{ itemId: 'i-demo-1', checked: true }] };
    expect(checklistEntry(plan, 'i-demo-1')).toEqual({ itemId: 'i-demo-1', checked: true });
    expect(checklistEntry(plan, 'i-demo-2')).toBeUndefined();
  });
});
