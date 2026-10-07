import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from './samplePlan';
import { createPlanStore, HISTORY_LIMIT } from './store';

const P = 'samsung-bespoke-4door-sample';
const V = 'satin-white';

describe('createPlanStore', () => {
  it('addItem은 정수 좌표로 추가하고 선택한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 100.6, y: 50.2 });
    const st = s.getState();
    expect(st.plan.items).toEqual([{ id, productId: P, variantId: V, x: 101, y: 50, rotation: 0 }]);
    expect(st.selectedId).toBe(id);
  });

  it('undo/redo가 동작하고 새 변경은 redo를 비운다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().updateItem(id, { x: 10 });
    s.getState().undo();
    expect(s.getState().plan.items[0].x).toBe(0);
    s.getState().redo();
    expect(s.getState().plan.items[0].x).toBe(10);
    s.getState().undo();
    s.getState().rotateItem(id, 90);
    expect(s.getState().future).toEqual([]);
  });

  it('드래그 전체가 실행 취소 한 번으로 되돌아간다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    const pastBefore = s.getState().past.length;
    s.getState().beginDrag();
    for (let i = 1; i <= 30; i++) s.getState().dragItem(id, i * 3, i);
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(pastBefore + 1);
    expect(s.getState().plan.items[0]).toMatchObject({ x: 90, y: 30 });
    s.getState().undo();
    expect(s.getState().plan.items[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('움직이지 않은 드래그는 히스토리를 남기지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem(P, V, { x: 0, y: 0 });
    const n = s.getState().past.length;
    s.getState().beginDrag();
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(n);
  });

  it('rotateItem은 0~360으로 정규화한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().rotateItem(id, -90);
    expect(s.getState().plan.items[0].rotation).toBe(270);
  });

  it('duplicateItem은 20cm 옆에 복제하고 선택한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 100, y: 100 });
    const copy = s.getState().duplicateItem(id)!;
    expect(s.getState().plan.items.find((i) => i.id === copy)).toMatchObject({ x: 120, y: 120 });
    expect(s.getState().selectedId).toBe(copy);
  });

  it('removeItem은 선택을 해제한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().removeItem(id);
    expect(s.getState().plan.items).toEqual([]);
    expect(s.getState().selectedId).toBeNull();
  });

  it('addCustomProduct는 박스 제품을 만든다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const pid = s.getState().addCustomProduct({ name: '김치냉장고 자리', w: 70, d: 80, h: 90 });
    expect(s.getState().plan.customProducts[0]).toMatchObject({ id: pid, builder: 'box', category: 'custom', dims: { w: 70, d: 80, h: 90 } });
  });

  it('loadPlan은 히스토리와 선택을 초기화한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().loadPlan(SAMPLE_PLAN);
    expect(s.getState()).toMatchObject({ past: [], future: [], selectedId: null });
  });

  it(`히스토리는 ${HISTORY_LIMIT}개까지만 보관한다`, () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s.getState().updateItem(id, { x: i + 1 });
    expect(s.getState().past.length).toBe(HISTORY_LIMIT);
  });

  it('드래그 중 실행 취소는 드래그만 취소하고 히스토리를 건드리지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().updateItem(id, { x: 10 });
    const pastLen = s.getState().past.length;
    s.getState().beginDrag();
    s.getState().dragItem(id, 50, 50);
    s.getState().undo();
    expect(s.getState().plan.items[0]).toMatchObject({ x: 10, y: 0 });
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(pastLen);
    expect(s.getState().future).toEqual([]);
    s.getState().undo();
    expect(s.getState().plan.items[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('드래그 중 다시 실행은 무시한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().updateItem(id, { x: 10 });
    s.getState().undo();
    s.getState().beginDrag();
    s.getState().dragItem(id, 50, 50);
    s.getState().redo();
    expect(s.getState().plan.items[0]).toMatchObject({ x: 50, y: 50 });
    s.getState().endDrag();
    expect(s.getState().future).toEqual([]);
  });

  it('없는 아이템 수정·삭제는 히스토리를 남기지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem(P, V, { x: 0, y: 0 });
    const n = s.getState().past.length;
    s.getState().updateItem('nope', { x: 1 });
    s.getState().removeItem('nope');
    expect(s.getState().past.length).toBe(n);
  });

  it('드래그 중 회전은 히스토리를 남기지 않고 endDrag 한 번으로 위치·회전이 함께 되돌아간다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    const pastLen = s.getState().past.length;
    s.getState().beginDrag();
    s.getState().dragItem(id, 50, 60);
    s.getState().rotateItem(id, 90);
    expect(s.getState().past.length).toBe(pastLen);
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(pastLen + 1);
    expect(s.getState().plan.items[0]).toMatchObject({ x: 50, y: 60, rotation: 90 });
    s.getState().undo();
    expect(s.getState().plan.items[0]).toMatchObject({ x: 0, y: 0, rotation: 0 });
  });

  it('드래그 중 삭제는 히스토리를 남기지 않고 endDrag 한 번의 실행 취소로 원위치에 복원된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    const pastLen = s.getState().past.length;
    s.getState().beginDrag();
    s.getState().dragItem(id, 50, 60);
    s.getState().removeItem(id);
    expect(s.getState().past.length).toBe(pastLen);
    expect(s.getState().plan.items).toEqual([]);
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(pastLen + 1);
    s.getState().undo();
    expect(s.getState().plan.items[0]).toMatchObject({ x: 0, y: 0, id });
  });

  it('실행 취소로 드래그가 사라진 뒤 dragItem은 아무 일도 하지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().beginDrag();
    s.getState().dragItem(id, 10, 10);
    s.getState().undo();
    const afterUndo = s.getState().plan;
    s.getState().dragItem(id, 99, 99);
    expect(s.getState().plan).toBe(afterUndo);
  });

  it('replacePlan은 현재 평면을 히스토리에 남기고 교체하며, 실행 취소로 복원된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 1, y: 2 });
    const before = s.getState().plan;
    const other = { ...SAMPLE_PLAN, info: { title: '다른 평면' } };
    s.getState().replacePlan(other);
    expect(s.getState().plan).toEqual(other);
    expect(s.getState().selectedId).toBeNull();
    s.getState().undo();
    expect(s.getState().plan).toEqual(before);
    expect(s.getState().plan.items.find((i) => i.id === id)).toBeDefined();
  });
});
