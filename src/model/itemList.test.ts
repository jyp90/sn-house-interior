import { describe, expect, it } from 'vitest';
import { findProduct } from '../catalog/products';
import { groupItemsByRoom } from './itemList';
import { withActiveItems } from './layout';
import type { Plan } from './schema';
import { SAMPLE_PLAN } from './samplePlan';

// 거실(왼쪽, x<350)에 네모 영역을 두고 방(오른쪽)은 영역 없이 둔다
const PLAN_WITH_ROOM_POLYGON: Plan = {
  ...SAMPLE_PLAN,
  rooms: [
    { ...SAMPLE_PLAN.rooms[0], polygon: [{ x: 20, y: 20 }, { x: 330, y: 20 }, { x: 330, y: 380 }, { x: 20, y: 380 }] },
    SAMPLE_PLAN.rooms[1],
  ],
};

const resolve = (plan: Plan) => (productId: string) => findProduct(plan, productId);

describe('groupItemsByRoom', () => {
  it('아이템이 없으면 빈 배열', () => {
    expect(groupItemsByRoom(SAMPLE_PLAN, resolve(SAMPLE_PLAN))).toEqual([]);
  });

  it('영역 안의 아이템은 그 방으로, 밖은 방 미지정으로 묶인다', () => {
    const inside = { id: 'sofa', productId: 'sofa-3seat', variantId: 'gray', x: 100, y: 100, rotation: 0 };
    const outside = { id: 'table', productId: 'table-dining-4', variantId: 'oak', x: 475, y: 200, rotation: 0 };
    const plan = withActiveItems(PLAN_WITH_ROOM_POLYGON, [inside, outside]);
    const groups = groupItemsByRoom(plan, resolve(plan));
    expect(groups).toHaveLength(2);
    expect(groups[0].room?.id).toBe('r1');
    expect(groups[0].items).toEqual([{ item: inside, product: findProduct(plan, 'sofa-3seat'), number: 1 }]);
    expect(groups[1].room).toBeNull();
    expect(groups[1].items).toEqual([{ item: outside, product: findProduct(plan, 'table-dining-4'), number: 2 }]);
  });

  it('방 순서(plan.rooms)로 묶고, 방 미지정은 맨 뒤', () => {
    const a = { id: 'a', productId: 'sofa-3seat', variantId: 'gray', x: 475, y: 200, rotation: 0 }; // r2 (영역 없음) → 미지정
    const b = { id: 'b', productId: 'table-dining-4', variantId: 'oak', x: 100, y: 100, rotation: 0 }; // r1
    const plan = withActiveItems(PLAN_WITH_ROOM_POLYGON, [a, b]);
    const groups = groupItemsByRoom(plan, resolve(plan));
    expect(groups.map((g) => g.room?.id ?? null)).toEqual(['r1', null]);
  });

  it('번호는 묶음 안에서 번호 순(배치 순서 기준)', () => {
    const second = { id: 'second', productId: 'table-dining-4', variantId: 'oak', x: 150, y: 150, rotation: 0 };
    const first = { id: 'first', productId: 'sofa-3seat', variantId: 'gray', x: 100, y: 100, rotation: 0 };
    // first가 뒤에 추가돼도(배치 순서상 second가 1번) 묶음 안 아이템은 번호 순으로 정렬된다
    const plan = withActiveItems(PLAN_WITH_ROOM_POLYGON, [second, first]);
    const groups = groupItemsByRoom(plan, resolve(plan));
    expect(groups[0].items.map((i) => i.item.id)).toEqual(['second', 'first']);
    expect(groups[0].items.map((i) => i.number)).toEqual([1, 2]);
  });

  it('제품을 찾을 수 없는 아이템은 제외한다', () => {
    const ghost = { id: 'g', productId: 'no-such-product', variantId: 'x', x: 100, y: 100, rotation: 0 };
    const sofa = { id: 's', productId: 'sofa-3seat', variantId: 'gray', x: 110, y: 100, rotation: 0 };
    const plan = withActiveItems(PLAN_WITH_ROOM_POLYGON, [ghost, sofa]);
    const groups = groupItemsByRoom(plan, resolve(plan));
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((i) => i.item.id)).toEqual(['s']);
  });

  it('polygon이 없는 방은 아이템을 가두지 않는다(미지정으로 간다)', () => {
    const inR2Area = { id: 'x', productId: 'sofa-3seat', variantId: 'gray', x: 475, y: 200, rotation: 0 };
    const plan = withActiveItems(SAMPLE_PLAN, [inR2Area]); // 두 방 다 polygon 없음
    const groups = groupItemsByRoom(plan, resolve(plan));
    expect(groups).toHaveLength(1);
    expect(groups[0].room).toBeNull();
  });

  it('두 방이 맞닿은 경계 위의 아이템은 plan.rooms에서 더 앞선 방으로 간다', () => {
    // r1·r2가 x=350 변을 공유하고, 아이템 중심이 그 변 위에 있다. pointInPolygon은 경계를 내부로 보므로
    // 두 방 모두 "안"이지만, 먼저 찾는(=plan.rooms 순서가 앞선) r1로 묶인다
    const planWithAdjacentRooms: Plan = {
      ...SAMPLE_PLAN,
      rooms: [
        { ...SAMPLE_PLAN.rooms[0], polygon: [{ x: 20, y: 20 }, { x: 350, y: 20 }, { x: 350, y: 380 }, { x: 20, y: 380 }] },
        { ...SAMPLE_PLAN.rooms[1], polygon: [{ x: 350, y: 20 }, { x: 580, y: 20 }, { x: 580, y: 380 }, { x: 350, y: 380 }] },
      ],
    };
    const onEdge = { id: 'edge', productId: 'sofa-3seat', variantId: 'gray', x: 350, y: 200, rotation: 0 };
    const plan = withActiveItems(planWithAdjacentRooms, [onEdge]);
    const groups = groupItemsByRoom(plan, resolve(plan));
    expect(groups).toHaveLength(1);
    expect(groups[0].room?.id).toBe('r1');
  });
});
