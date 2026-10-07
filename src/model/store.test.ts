import { describe, expect, it } from 'vitest';
import { activeItems } from './layout';
import { SAMPLE_PLAN } from './samplePlan';
import { createPlanStore, HISTORY_LIMIT } from './store';

const P = 'samsung-bespoke-4door-sample';
const V = 'satin-white';

describe('createPlanStore', () => {
  it('addItem은 정수 좌표로 추가하고 선택한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 100.6, y: 50.2 });
    const st = s.getState();
    expect(activeItems(st.plan)).toEqual([{ id, productId: P, variantId: V, x: 101, y: 50, rotation: 0 }]);
    expect(st.selectedId).toBe(id);
  });

  it('undo/redo가 동작하고 새 변경은 redo를 비운다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().updateItem(id, { x: 10 });
    s.getState().undo();
    expect(activeItems(s.getState().plan)[0].x).toBe(0);
    s.getState().redo();
    expect(activeItems(s.getState().plan)[0].x).toBe(10);
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
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 90, y: 30 });
    s.getState().undo();
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 0, y: 0 });
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
    expect(activeItems(s.getState().plan)[0].rotation).toBe(270);
  });

  it('duplicateItem은 20cm 옆에 복제하고 선택한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 100, y: 100 });
    const copy = s.getState().duplicateItem(id)!;
    expect(activeItems(s.getState().plan).find((i) => i.id === copy)).toMatchObject({ x: 120, y: 120 });
    expect(s.getState().selectedId).toBe(copy);
  });

  it('removeItem은 선택을 해제한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().removeItem(id);
    expect(activeItems(s.getState().plan)).toEqual([]);
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
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 10, y: 0 });
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(pastLen);
    expect(s.getState().future).toEqual([]);
    s.getState().undo();
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('드래그 중 다시 실행은 무시한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().updateItem(id, { x: 10 });
    s.getState().undo();
    s.getState().beginDrag();
    s.getState().dragItem(id, 50, 50);
    s.getState().redo();
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 50, y: 50 });
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
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 50, y: 60, rotation: 90 });
    s.getState().undo();
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 0, y: 0, rotation: 0 });
  });

  it('드래그 중 삭제는 히스토리를 남기지 않고 endDrag 한 번의 실행 취소로 원위치에 복원된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    const pastLen = s.getState().past.length;
    s.getState().beginDrag();
    s.getState().dragItem(id, 50, 60);
    s.getState().removeItem(id);
    expect(s.getState().past.length).toBe(pastLen);
    expect(activeItems(s.getState().plan)).toEqual([]);
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(pastLen + 1);
    s.getState().undo();
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 0, y: 0, id });
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
    expect(activeItems(s.getState().plan).find((i) => i.id === id)).toBeDefined();
  });
});

describe('구조 편집', () => {
  const twoWalls = () =>
    createPlanStore({
      ...SAMPLE_PLAN,
      walls: [
        { id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 },
        { id: 'v', a: { x: 400, y: 0 }, b: { x: 400, y: 300 }, thickness: 10, height: 230 },
      ],
      openings: [{ id: 'o', wallId: 'w', kind: 'door', offset: 250, width: 90, height: 210, sill: 0, hinge: 'start', swingIn: true }],
      rooms: [],
    });

  it('벽 길이를 바꾸면 연결된 벽 끝점도 따라온다', () => {
    const s = twoWalls();
    expect(s.getState().resizeWall('w', 500)).toBeNull();
    expect(s.getState().plan.walls[0].b).toEqual({ x: 500, y: 0 });
    expect(s.getState().plan.walls[1].a).toEqual({ x: 500, y: 0 });
  });

  it('벽을 줄이면 개구부를 벽 안으로 당긴다', () => {
    const s = twoWalls();
    expect(s.getState().resizeWall('w', 300)).toBeNull();
    expect(s.getState().plan.openings[0].offset).toBe(210);
  });

  it('개구부가 들어갈 수 없게 줄이면 거부하고 그대로 둔다', () => {
    const s = twoWalls();
    const pastLen = s.getState().past.length;
    expect(s.getState().resizeWall('w', 80)).toBe('문이(가) 벽 길이를 벗어나 변경하지 않았습니다.');
    expect(s.getState().plan.walls[0].b).toEqual({ x: 400, y: 0 });
    expect(s.getState().past.length).toBe(pastLen);
    expect(s.getState().resizeWall('w', 0)).toBe('길이는 1cm 이상이어야 합니다.');
  });

  it('끝점 드래그는 실행 취소 한 번으로 되돌아간다', () => {
    const s = twoWalls();
    s.getState().beginDrag();
    s.getState().dragEndpoint({ x: 400, y: 0 }, { x: 450, y: 20.4 });
    s.getState().dragEndpoint({ x: 400, y: 0 }, { x: 500, y: 0 });
    s.getState().endDrag();
    expect(s.getState().plan.walls[1].a).toEqual({ x: 500, y: 0 });
    s.getState().undo();
    expect(s.getState().plan.walls[0].b).toEqual({ x: 400, y: 0 });
    expect(s.getState().plan.walls[1].a).toEqual({ x: 400, y: 0 });
  });

  it('끝점 드래그로 개구부가 벗어나면 마지막 유효 위치를 유지한다', () => {
    const s = twoWalls();
    s.getState().beginDrag();
    s.getState().dragEndpoint({ x: 400, y: 0 }, { x: 350, y: 0 });
    s.getState().dragEndpoint({ x: 400, y: 0 }, { x: 50, y: 0 });
    s.getState().endDrag();
    expect(s.getState().plan.walls[0].b).toEqual({ x: 350, y: 0 });
  });

  it('끝점을 같은 벽의 반대쪽 끝점 위로 드래그하면 거부하고 그대로 둔다', () => {
    const s = twoWalls();
    s.getState().beginDrag();
    // v: a=(400,0) b=(400,300), 두께 10. b를 a 위로 끌면 길이 0이 돼 거부돼야 한다
    s.getState().dragEndpoint({ x: 400, y: 300 }, { x: 400, y: 0 });
    expect(s.getState().plan.walls[1].b).toEqual({ x: 400, y: 300 });
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(0);
  });

  it('resizeWall은 벽 두께보다 짧은 길이를 거부하고 그대로 둔다', () => {
    const s = twoWalls();
    const pastLen = s.getState().past.length;
    expect(s.getState().resizeWall('w', 5)).toBe('길이는 벽 두께(10cm) 이상이어야 합니다.');
    expect(s.getState().plan.walls[0].b).toEqual({ x: 400, y: 0 });
    expect(s.getState().past.length).toBe(pastLen);
  });

  it('removeWall은 그 벽의 개구부도 지우고 선택을 푼다', () => {
    const s = twoWalls();
    s.getState().select('o');
    s.getState().removeWall('w');
    expect(s.getState().plan.walls.map((w) => w.id)).toEqual(['v']);
    expect(s.getState().plan.openings).toEqual([]);
    expect(s.getState().selectedId).toBeNull();
  });

  it('addRoomRect는 내측 치수를 유지하는 벽 4개와 방 이름을 한 번에 만든다', () => {
    const s = twoWalls();
    const pastLen = s.getState().past.length;
    s.getState().addRoomRect({ origin: { x: 100, y: 100 }, w: 400, d: 300, thickness: 15, height: 230, name: '거실' });
    const walls = s.getState().plan.walls.slice(-4);
    const xs = walls.flatMap((w) => [w.a.x, w.b.x]);
    const ys = walls.flatMap((w) => [w.a.y, w.b.y]);
    expect(Math.max(...xs) - Math.min(...xs) - 15).toBe(400);
    expect(Math.max(...ys) - Math.min(...ys) - 15).toBe(300);
    expect(s.getState().plan.rooms).toEqual([expect.objectContaining({ name: '거실', label: { x: 300, y: 250 } })]);
    expect(s.getState().past.length).toBe(pastLen + 1);
  });

  it('addOpening은 벽 안으로 맞추고 벽보다 넓으면 null', () => {
    const s = twoWalls();
    const id = s.getState().addOpening({ wallId: 'v', kind: 'window', offset: 280, width: 120, height: 120, sill: 90, hinge: 'start', swingIn: false });
    expect(s.getState().plan.openings.find((o) => o.id === id)?.offset).toBe(180);
    expect(s.getState().addOpening({ wallId: 'v', kind: 'door', offset: 0, width: 400, height: 210, sill: 0, hinge: 'start', swingIn: true })).toBeNull();
  });

  it('updateOpening은 벽을 벗어나는 값을 허용 범위와 함께 거부한다', () => {
    const s = twoWalls();
    expect(s.getState().updateOpening('o', { offset: 350 })).toBe('벽 시작점에서 거리는 0–310cm 사이여야 합니다.');
    expect(s.getState().updateOpening('o', { width: 500 })).toBe('폭은 1–400cm 사이여야 합니다.');
    expect(s.getState().plan.openings[0].offset).toBe(250);
    expect(s.getState().updateOpening('o', { width: 100, verified: true })).toBeNull();
    expect(s.getState().plan.openings[0]).toMatchObject({ width: 100, verified: true });
  });

  it('방 이름 추가·수정·삭제', () => {
    const s = twoWalls();
    const id = s.getState().addRoom('방', { x: 10.6, y: 20 });
    s.getState().updateRoom(id, { name: '서재' });
    expect(s.getState().plan.rooms[0]).toEqual({ id, name: '서재', label: { x: 11, y: 20 } });
    s.getState().select(id);
    s.getState().removeRoom(id);
    expect(s.getState().plan.rooms).toEqual([]);
    expect(s.getState().selectedId).toBeNull();
  });

  it('배경 설정·수정·제거', () => {
    const s = twoWalls();
    s.getState().setBackground({ imageRef: 'img', widthPx: 400, heightPx: 300, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 0.5 });
    s.getState().updateBackground({ opacity: 0.8 });
    expect(s.getState().plan.background?.opacity).toBe(0.8);
    s.getState().setBackground(undefined);
    expect(s.getState().plan.background).toBeUndefined();
  });

  it('드래그 트랜잭션 안의 배경 수정은 실행 취소 한 번으로 묶인다', () => {
    const s = twoWalls();
    s.getState().setBackground({ imageRef: 'img', widthPx: 400, heightPx: 300, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 0.5 });
    const pastLen = s.getState().past.length;
    s.getState().beginDrag();
    for (const o of [0.55, 0.6, 0.65, 0.7]) s.getState().updateBackground({ opacity: o });
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(pastLen + 1);
    s.getState().undo();
    expect(s.getState().plan.background?.opacity).toBe(0.5);
  });
});

describe('잠금', () => {
  it('잠긴 아이템은 이동·회전·드래그되지 않지만 잠금 해제는 된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().updateItem(id, { locked: true });
    s.getState().updateItem(id, { x: 50 });
    s.getState().rotateItem(id, 90);
    s.getState().beginDrag();
    s.getState().dragItem(id, 80, 80);
    s.getState().endDrag();
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 0, y: 0, rotation: 0, locked: true });
    s.getState().updateItem(id, { verified: true });
    expect(activeItems(s.getState().plan)[0].verified).toBe(true);
    s.getState().updateItem(id, { locked: false, x: 10 });
    expect(activeItems(s.getState().plan)[0]).toMatchObject({ x: 10, locked: false });
  });
});
