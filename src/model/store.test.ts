import { describe, expect, it } from 'vitest';
import { findProduct } from '../catalog/products';
import { pointInPolygon, polygonCentroid } from '../geometry/polygon';
import { DEFAULT_FINISH } from '../materials/presets';
import { activeItems } from './layout';
import { SAMPLE_PLAN } from './samplePlan';
import { createPlanStore, HISTORY_LIMIT } from './store';
import { validatePlan } from '../validation/validate';

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

  it('updateItem elevation은 0 이상 정수로 저장하고 undefined면 키를 지운다 (한 번의 실행 취소 단위)', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem('sofa-3seat', 'gray', { x: 100, y: 100 });
    s.getState().updateItem(id, { elevation: 87.6 });
    expect(activeItems(s.getState().plan).find((i) => i.id === id)!.elevation).toBe(88);
    s.getState().updateItem(id, { elevation: -5 });
    expect(activeItems(s.getState().plan).find((i) => i.id === id)!.elevation).toBe(0);
    s.getState().updateItem(id, { elevation: undefined });
    expect('elevation' in activeItems(s.getState().plan).find((i) => i.id === id)!).toBe(false);
    s.getState().undo();
    expect(activeItems(s.getState().plan).find((i) => i.id === id)!.elevation).toBe(0);
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

describe('배치안', () => {
  it('복제하면 아이템을 새 id로 복사한 B안이 활성화되고 실행 취소 한 번에 사라진다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const itemId = s.getState().addItem(P, V, { x: 100, y: 100 });
    const pastLen = s.getState().past.length;
    const id = s.getState().addLayout();
    const plan = s.getState().plan;
    expect(plan.activeLayoutId).toBe(id);
    expect(plan.layouts.map((l) => l.name)).toEqual(['A안', 'B안']);
    expect(activeItems(plan)[0]).toMatchObject({ x: 100, y: 100 });
    expect(activeItems(plan)[0].id).not.toBe(itemId);
    expect(s.getState().selectedId).toBeNull();
    expect(s.getState().past.length).toBe(pastLen + 1);
    s.getState().undo();
    expect(s.getState().plan.layouts).toHaveLength(1);
  });

  it('B안에서 옮겨도 A안은 그대로다 (F09)', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem(P, V, { x: 100, y: 100 });
    s.getState().addLayout();
    const moved = activeItems(s.getState().plan)[0].id;
    s.getState().updateItem(moved, { x: 300 });
    s.getState().switchLayout('layout-a');
    expect(activeItems(s.getState().plan)[0].x).toBe(100);
  });

  it('벽을 추가하면 모든 배치안에서 보이고, 전환하면 그 배치안 기준으로 간섭을 다시 계산한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem(P, V, { x: 100, y: 100 });
    const b = s.getState().addLayout();
    s.getState().updateItem(activeItems(s.getState().plan)[0].id, { x: 250 });
    s.getState().addWalls([{ a: { x: 100, y: 40 }, b: { x: 100, y: 160 }, thickness: 10, height: 230 }]);
    const status = () => {
      const plan = s.getState().plan;
      return Object.values(validatePlan(plan, (id) => findProduct(plan, id)))[0].collides;
    };
    expect(status()).toBe(false);
    s.getState().switchLayout('layout-a');
    expect(s.getState().plan.walls).toHaveLength(6);
    expect(status()).toBe(true);
    s.getState().switchLayout(b);
    expect(status()).toBe(false);
  });

  it('이름과 메모를 바꾸고, 빈 이름은 무시한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().renameLayout('layout-a', '  창가 소파안 ');
    s.getState().renameLayout('layout-a', '   ');
    s.getState().setLayoutMemo('layout-a', '거실 넓게');
    expect(s.getState().plan.layouts[0]).toMatchObject({ name: '창가 소파안', memo: '거실 넓게' });
    s.getState().setLayoutMemo('layout-a', '');
    expect(s.getState().plan.layouts[0].memo).toBeUndefined();
  });

  it('활성 배치안을 지우면 남은 첫 배치안이 활성화된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const b = s.getState().addLayout();
    s.getState().removeLayout(b);
    expect(s.getState().plan.activeLayoutId).toBe('layout-a');
    expect(s.getState().plan.layouts).toHaveLength(1);
  });

  it('마지막 배치안은 지울 수 없다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const pastLen = s.getState().past.length;
    s.getState().removeLayout('layout-a');
    expect(s.getState().plan.layouts).toHaveLength(1);
    expect(s.getState().past.length).toBe(pastLen);
  });

  it('없는 배치안이나 이미 활성인 배치안으로의 전환은 히스토리를 남기지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const pastLen = s.getState().past.length;
    s.getState().switchLayout('layout-a');
    s.getState().switchLayout('nope');
    expect(s.getState().past.length).toBe(pastLen);
  });

  describe('전기 설비', () => {
    const outlet = { kind: 'outlet' as const, pos: { x: 100.4, y: 9.6 }, wallId: 'w1', height: 30 };

    it('addFixture는 정수 좌표로 추가하고 선택하며 실행 취소된다', () => {
      const s = createPlanStore(SAMPLE_PLAN);
      const id = s.getState().addFixture(outlet);
      expect(s.getState().plan.fixtures).toEqual([{ id, kind: 'outlet', pos: { x: 100, y: 10 }, wallId: 'w1', height: 30 }]);
      expect(s.getState().selectedId).toBe(id);
      s.getState().undo();
      expect(s.getState().plan.fixtures).toEqual([]);
    });

    it('updateFixture는 메모를 다듬고 빈 메모는 지우며, 높이는 0 이상 정수', () => {
      const s = createPlanStore(SAMPLE_PLAN);
      const id = s.getState().addFixture(outlet);
      s.getState().updateFixture(id, { memo: '  세탁기용 ', height: 110.6 });
      expect(s.getState().plan.fixtures[0]).toMatchObject({ memo: '세탁기용', height: 111 });
      s.getState().updateFixture(id, { memo: '   ', height: -5 });
      expect(s.getState().plan.fixtures[0]).not.toHaveProperty('memo');
      expect(s.getState().plan.fixtures[0].height).toBe(0);
    });

    it('dragFixture는 드래그 중에만 움직이고 끝나면 실행 취소 한 번으로 돌아간다', () => {
      const s = createPlanStore(SAMPLE_PLAN);
      const id = s.getState().addFixture(outlet);
      s.getState().dragFixture(id, { x: 300, y: 300 });
      expect(s.getState().plan.fixtures[0].pos).toEqual({ x: 100, y: 10 });
      s.getState().beginDrag();
      s.getState().dragFixture(id, { x: 150, y: 10 }, 'w1');
      s.getState().dragFixture(id, { x: 200.4, y: 120 });
      s.getState().endDrag();
      expect(s.getState().plan.fixtures[0]).toEqual({ id, kind: 'outlet', pos: { x: 200, y: 120 }, height: 30 });
      s.getState().undo();
      expect(s.getState().plan.fixtures[0].pos).toEqual({ x: 100, y: 10 });
    });

    it('removeFixture는 지우고 선택을 푼다', () => {
      const s = createPlanStore(SAMPLE_PLAN);
      const id = s.getState().addFixture(outlet);
      s.getState().removeFixture(id);
      expect(s.getState().plan.fixtures).toEqual([]);
      expect(s.getState().selectedId).toBeNull();
    });

    it('벽을 지우면 붙어 있던 설비의 wallId를 지운다(설비는 남는다)', () => {
      const s = createPlanStore(SAMPLE_PLAN);
      const id = s.getState().addFixture(outlet);
      s.getState().removeWall('w1');
      expect(s.getState().plan.fixtures).toEqual([{ id, kind: 'outlet', pos: { x: 100, y: 10 }, height: 30 }]);
    });

    const onW1 = { kind: 'outlet' as const, pos: { x: 300, y: 10 }, wallId: 'w1', height: 30 };

    it('벽 길이를 바꾸면 붙은 설비가 비율대로 따라가고 벽면에 남으며 실행 취소된다', () => {
      const s = createPlanStore(SAMPLE_PLAN);
      const id = s.getState().addFixture(onW1);
      expect(s.getState().resizeWall('w1', 300)).toBeNull();
      expect(s.getState().plan.fixtures).toEqual([{ id, kind: 'outlet', pos: { x: 150, y: 10 }, wallId: 'w1', height: 30 }]);
      s.getState().undo();
      expect(s.getState().plan.fixtures[0].pos).toEqual({ x: 300, y: 10 });
    });

    it('벽 두께를 바꾸면 벽면까지 거리가 바뀌고 실행 취소된다', () => {
      const s = createPlanStore(SAMPLE_PLAN);
      s.getState().addFixture(onW1);
      s.getState().updateWall('w1', { thickness: 30 });
      expect(s.getState().plan.fixtures[0].pos).toEqual({ x: 300, y: 15 });
      s.getState().updateWall('w1', { verified: true });
      expect(s.getState().plan.fixtures[0].pos).toEqual({ x: 300, y: 15 });
      s.getState().undo();
      s.getState().undo();
      expect(s.getState().plan.fixtures[0].pos).toEqual({ x: 300, y: 10 });
    });

    it('벽 끝점을 끌면 붙은 설비가 따라가고 실행 취소 한 번으로 돌아간다', () => {
      const s = createPlanStore(SAMPLE_PLAN);
      s.getState().addFixture(onW1);
      s.getState().beginDrag();
      s.getState().dragEndpoint({ x: 600, y: 0 }, { x: 650, y: 0 });
      s.getState().dragEndpoint({ x: 600, y: 0 }, { x: 700, y: 0 });
      s.getState().endDrag();
      expect(s.getState().plan.fixtures[0]).toMatchObject({ pos: { x: 350, y: 10 }, wallId: 'w1' });
      s.getState().undo();
      expect(s.getState().plan.fixtures[0].pos).toEqual({ x: 300, y: 10 });
    });
  });
});

describe('체크리스트 상태', () => {
  it('체크와 메모를 저장하고, 둘 다 없어지면 항목을 지운다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setChecklistEntry('demo-1', { checked: true });
    expect(s.getState().plan.checklist).toEqual([{ itemId: 'demo-1', checked: true }]);
    s.getState().setChecklistEntry('demo-1', { memo: '  붙박이장 포함 ' });
    expect(s.getState().plan.checklist).toEqual([{ itemId: 'demo-1', checked: true, memo: '붙박이장 포함' }]);
    s.getState().setChecklistEntry('demo-1', { checked: false });
    expect(s.getState().plan.checklist).toEqual([{ itemId: 'demo-1', checked: false, memo: '붙박이장 포함' }]);
    s.getState().setChecklistEntry('demo-1', { memo: '' });
    expect(s.getState().plan.checklist).toEqual([]);
  });

  it('바뀌는 것이 없으면 이력에 남기지 않고, 변경은 실행 취소된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setChecklistEntry('demo-1', { checked: false });
    expect(s.getState().past).toHaveLength(0);
    s.getState().setChecklistEntry('demo-1', { checked: true });
    s.getState().undo();
    expect(s.getState().plan.checklist).toEqual([]);
  });
});

describe('기본 정보', () => {
  it('문자열은 다듬고, 빈 값과 undefined는 지우며, 빈 제목은 무시한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().updateInfo({ address: '  어딘가 1 ', supplyArea: 93.6, builtYear: 1999 });
    expect(s.getState().plan.info).toEqual({ title: '샘플 평면', address: '어딘가 1', supplyArea: 93.6, builtYear: 1999 });
    s.getState().updateInfo({ address: '', supplyArea: undefined, title: '  ' });
    expect(s.getState().plan.info).toEqual({ title: '샘플 평면', builtYear: 1999 });
    s.getState().updateInfo({ title: ' 우리 집 ' });
    expect(s.getState().plan.info.title).toBe('우리 집');
    s.getState().undo();
    expect(s.getState().plan.info.title).toBe('샘플 평면');
  });

  it('바뀌는 것이 없으면 이력에 남기지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().updateInfo({ title: '샘플 평면', address: '' });
    expect(s.getState().past).toHaveLength(0);
  });
});

describe('room areas and finishes', () => {
  const sq = [{ x: 10, y: 10 }, { x: 340, y: 10 }, { x: 340, y: 390 }, { x: 10, y: 390 }];

  it('addRoomArea는 방을 만들고 라벨을 무게중심에 둔다 (한 undo 단위)', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addRoomArea(sq.map((p) => ({ x: p.x + 0.4, y: p.y })));
    expect(id).not.toBeNull();
    const room = s.getState().plan.rooms.find((r) => r.id === id)!;
    expect(room.polygon![0]).toEqual({ x: 10, y: 10 });
    expect(room.label).toEqual({ x: 175, y: 200 });
    expect(room.name).toBe('방 3');
    expect(s.getState().selectedId).toBe(id);
    s.getState().undo();
    expect(s.getState().plan.rooms).toHaveLength(2);
  });

  it('addRoomArea는 잘못된 다각형을 거부한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    expect(s.getState().addRoomArea(sq.slice(0, 2))).toBeNull();
    expect(s.getState().past).toHaveLength(0);
  });

  it('setRoomPolygon은 라벨이 영역 밖일 때만 옮긴다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    expect(s.getState().setRoomPolygon('r1', sq)).toBe(true);
    expect(s.getState().plan.rooms[0].label).toEqual({ x: 175, y: 200 }); // 원래 라벨이 안에 있어 유지
    const far = [{ x: 1000, y: 1000 }, { x: 1100, y: 1000 }, { x: 1100, y: 1100 }, { x: 1000, y: 1100 }];
    s.getState().setRoomPolygon('r1', far);
    expect(s.getState().plan.rooms[0].label).toEqual({ x: 1050, y: 1050 });
    expect(s.getState().setRoomPolygon('r1', [{ x: 0, y: 0 }])).toBe(false);
  });

  it('setRoomFinish / setPlanFinish', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setRoomFinish('r1', { floor: { material: 'tile', color: '#B8B5AE' } });
    expect(s.getState().plan.rooms[0].floor).toEqual({ material: 'tile', color: '#b8b5ae' });
    expect(s.getState().plan.rooms[0].wall).toBeUndefined();
    s.getState().setPlanFinish({ wall: { material: 'wallpaper', color: '#c7cfbf' } });
    expect(s.getState().plan.finish).toEqual({ floor: DEFAULT_FINISH.floor, wall: { material: 'wallpaper', color: '#c7cfbf' } });
    expect(s.getState().past).toHaveLength(2);
  });

  it('dragRoomVertex는 드래그 한 번이 undo 한 단위', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setRoomPolygon('r1', sq);
    s.getState().beginDrag();
    s.getState().dragRoomVertex('r1', 1, { x: 300, y: 20 });
    s.getState().dragRoomVertex('r1', 1, { x: 320, y: 30 });
    s.getState().endDrag();
    expect(s.getState().plan.rooms[0].polygon![1]).toEqual({ x: 320, y: 30 });
    expect(s.getState().past).toHaveLength(2);
    s.getState().beginDrag();
    s.getState().dragRoomVertex('r1', 1, { x: 10, y: 10 }); // 첫 점과 겹침 → 무시
    s.getState().endDrag();
    expect(s.getState().plan.rooms[0].polygon![1]).toEqual({ x: 320, y: 30 });
  });

  it('꼭짓점 드래그 후 이름표가 영역 밖이면 endDrag가 무게중심으로 옮기고, 한 번에 되돌린다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setRoomPolygon('r1', sq);
    const label = s.getState().plan.rooms[0].label;
    s.getState().beginDrag();
    s.getState().dragRoomVertex('r1', 2, { x: 100, y: 120 });
    const poly = s.getState().plan.rooms[0].polygon!;
    expect(pointInPolygon(label, poly)).toBe(false);
    s.getState().endDrag();
    expect(s.getState().plan.rooms[0].label).toEqual(polygonCentroid(poly));
    expect(pointInPolygon(s.getState().plan.rooms[0].label, poly)).toBe(true);
    s.getState().undo();
    expect(s.getState().plan.rooms[0].label).toEqual(label);
    expect(s.getState().plan.rooms[0].polygon).toEqual(sq);
  });

  it('이름표가 영역 안에 남으면 endDrag가 옮기지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setRoomPolygon('r1', sq);
    const label = s.getState().plan.rooms[0].label;
    s.getState().beginDrag();
    s.getState().dragRoomVertex('r1', 2, { x: 360, y: 400 });
    s.getState().endDrag();
    expect(s.getState().plan.rooms[0].label).toEqual(label);
  });
});
