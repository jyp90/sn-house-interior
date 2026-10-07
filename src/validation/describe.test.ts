import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/products';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { conflictLines } from './describe';

const sofa = CATALOG.find((p) => p.id === 'sofa-3seat')!;

describe('conflictLines', () => {
  it('사유를 종류별 한국어 문장으로', () => {
    const plan = withActiveItems(SAMPLE_PLAN, [{ id: 'b', productId: sofa.id, variantId: 'gray', x: 0, y: 0, rotation: 0 }]);
    const lines = conflictLines(
      {
        collides: true,
        clearanceBlocked: true,
        blocksDoor: true,
        conflicts: [
          { type: 'collides', target: { kind: 'item', id: 'b' } },
          { type: 'collides', target: { kind: 'wall', id: 'w1' } },
          { type: 'clearance', target: { kind: 'wall', id: 'w1' } },
          { type: 'blocksDoor', target: { kind: 'door', id: 'o1' } },
        ],
      },
      plan,
    );
    expect(lines).toEqual(['충돌: 3인 소파, 벽', '문 열림 공간 부족: 벽', '방문 열림 간섭: 문']);
  });

  it('사라진 아이템은 알 수 없는 제품', () => {
    const lines = conflictLines(
      { collides: true, clearanceBlocked: false, blocksDoor: false, conflicts: [{ type: 'collides', target: { kind: 'item', id: 'gone' } }] },
      SAMPLE_PLAN,
    );
    expect(lines).toEqual(['충돌: 알 수 없는 제품']);
  });
});
