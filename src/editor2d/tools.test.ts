import { beforeEach, describe, expect, it } from 'vitest';
import type { Vec2 } from '../model/schema';
import { emptyPlanFields, SAMPLE_PLAN } from '../model/samplePlan';
import { createPlanStore } from '../model/store';
import { useUi } from '../ui/uiStore';
import { applyToolClick, finishArea, finishWall } from './tools';

const plan = () => ({
  version: 4 as const, info: { title: 't' }, rooms: [], openings: [], ...emptyPlanFields(),
  walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 }],
});

beforeEach(() => useUi.setState(useUi.getInitialState(), true));

describe('applyToolClick', () => {
  it('벽 도구는 스냅된 점을 쌓는다', () => {
    const store = createPlanStore(plan());
    let points = [{ x: 0, y: 100 }];
    applyToolClick('wall', { x: 200, y: 106 }, { store, wallPoints: points, setWallPoints: (p) => (points = p), areaPoints: [], setAreaPoints: () => {} });
    expect(points).toEqual([{ x: 0, y: 100 }, { x: 200, y: 100 }]);
  });

  it('문 도구는 가까운 벽에 문을 놓고 선택한다', () => {
    const store = createPlanStore(plan());
    applyToolClick('door', { x: 200, y: 12 }, { store, wallPoints: [], setWallPoints: () => {}, areaPoints: [], setAreaPoints: () => {} });
    const [door] = store.getState().plan.openings;
    expect(door).toMatchObject({ wallId: 'w', kind: 'door', offset: 155, width: 90, height: 210, sill: 0 });
    expect(store.getState().selectedId).toBe(door.id);
  });

  it('중문 도구는 폭 120 비대칭 양개 중문을 놓는다', () => {
    const store = createPlanStore(plan());
    applyToolClick('middle-door', { x: 200, y: 12 }, { store, wallPoints: [], setWallPoints: () => {}, areaPoints: [], setAreaPoints: () => {} });
    const [door] = store.getState().plan.openings;
    expect(door).toMatchObject({ wallId: 'w', kind: 'door', offset: 140, width: 120, height: 210, sill: 0, hinge: 'start', swingIn: true, middle: true, leaves: 'asym' });
    expect(store.getState().selectedId).toBe(door.id);
  });

  it('벽에서 멀면 아무것도 만들지 않고 안내한다', () => {
    const store = createPlanStore(plan());
    applyToolClick('window', { x: 200, y: 200 }, { store, wallPoints: [], setWallPoints: () => {}, areaPoints: [], setAreaPoints: () => {} });
    expect(store.getState().plan.openings).toEqual([]);
    expect(useUi.getState().banner?.text).toBe('벽 가까이(30cm 이내)를 클릭하세요.');
  });

  it('방 만들기는 초안 크기로 방을 만들고 선택 도구로 돌아간다', () => {
    const store = createPlanStore(plan());
    useUi.getState().setTool('room');
    applyToolClick('room', { x: 50.4, y: 60 }, { store, wallPoints: [], setWallPoints: () => {}, areaPoints: [], setAreaPoints: () => {} });
    expect(store.getState().plan.walls).toHaveLength(5);
    expect(store.getState().plan.rooms[0].name).toBe('방');
    expect(useUi.getState().tool).toBe('select');
  });

  it('축척 보정 도구는 이미지 px 좌표로 점을 모은다', () => {
    const store = createPlanStore({
      ...plan(),
      background: { imageRef: 'i', widthPx: 400, heightPx: 300, cmPerPx: 2, offsetX: 10, offsetY: 0, rotation: 0, opacity: 0.5 },
    });
    useUi.getState().startCalibration('primary');
    applyToolClick('calibrate', { x: 110, y: 40 }, { store, wallPoints: [], setWallPoints: () => {}, areaPoints: [], setAreaPoints: () => {} });
    expect(useUi.getState().calibration?.points).toEqual([{ x: 50, y: 20 }]);
  });
});

describe('area tool', () => {
  const ctx = () => {
    const store = createPlanStore(SAMPLE_PLAN);
    let areaPoints: Vec2[] = [];
    return { store, get: () => areaPoints, ctx: { store, wallPoints: [], setWallPoints: () => {}, areaPoints, setAreaPoints: (p: Vec2[]) => { areaPoints = p; } } };
  };

  it('클릭마다 점을 더하고 벽 모서리에 스냅한다', () => {
    useUi.setState({ tool: 'area', areaTarget: null, snap: true });
    const c = ctx();
    applyToolClick('area', { x: 13, y: 12 }, c.ctx); // w1 모서리(10,10)로 스냅
    expect(c.get()).toEqual([{ x: 10, y: 10 }]);
  });

  it('첫 점을 다시 클릭하면 방을 만든다', () => {
    useUi.setState({ tool: 'area', areaTarget: null, snap: false });
    const c = ctx();
    const pts = [{ x: 20, y: 20 }, { x: 300, y: 20 }, { x: 300, y: 300 }];
    for (const p of pts) {
      applyToolClick('area', p, { ...c.ctx, areaPoints: c.get() });
    }
    applyToolClick('area', { x: 24, y: 18 }, { ...c.ctx, areaPoints: c.get() });
    const rooms = c.store.getState().plan.rooms;
    expect(rooms).toHaveLength(3);
    expect(rooms[2].polygon).toEqual(pts);
    expect(useUi.getState().tool).toBe('select');
  });

  it('areaTarget이 있으면 그 방에 영역을 넣는다', () => {
    useUi.setState({ tool: 'area', areaTarget: 'r1', snap: false });
    const c = ctx();
    expect(finishArea(c.store, [{ x: 20, y: 20 }, { x: 300, y: 20 }, { x: 300, y: 300 }, { x: 20, y: 300 }])).toBe(true);
    expect(c.store.getState().plan.rooms).toHaveLength(2);
    expect(c.store.getState().plan.rooms[0].polygon).toHaveLength(4);
    expect(useUi.getState().areaTarget).toBeNull();
  });

  it('점이 3개 미만이면 닫지 않고 배너를 띄운다', () => {
    useUi.setState({ tool: 'area', areaTarget: null, banner: null });
    const c = ctx();
    expect(finishArea(c.store, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(false);
    expect(useUi.getState().banner?.kind).toBe('error');
    expect(useUi.getState().tool).toBe('area');
  });

  it('일직선 위의 점 3개처럼 면적이 0이면 닫지 않고 면적 배너를 띄운다', () => {
    useUi.setState({ tool: 'area', areaTarget: null, banner: null });
    const c = ctx();
    expect(finishArea(c.store, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }])).toBe(false);
    expect(useUi.getState().banner?.text).toBe('영역의 면적이 0입니다.');
    expect(useUi.getState().tool).toBe('area');
  });

  it('더블클릭의 두 번째 pointerdown처럼 같은 점을 다시 클릭해도 점이 늘지 않는다', () => {
    useUi.setState({ tool: 'area', areaTarget: null, snap: false });
    const c = ctx();
    applyToolClick('area', { x: 50, y: 50 }, { ...c.ctx, areaPoints: c.get() });
    applyToolClick('area', { x: 50, y: 50 }, { ...c.ctx, areaPoints: c.get() });
    expect(c.get()).toEqual([{ x: 50, y: 50 }]);
  });

  it('마지막 점이 중복으로 남아 있어도 finishArea가 정리하고 방을 만든다', () => {
    useUi.setState({ tool: 'area', areaTarget: null, snap: false });
    const c = ctx();
    const pts = [{ x: 20, y: 20 }, { x: 300, y: 20 }, { x: 300, y: 300 }];
    expect(finishArea(c.store, [...pts, { x: 300, y: 300 }])).toBe(true);
    const rooms = c.store.getState().plan.rooms;
    expect(rooms).toHaveLength(3);
    expect(rooms[2].polygon).toEqual(pts);
  });
});

describe('finishWall', () => {
  it('길이 0 구간을 빼고 초안 두께로 한 번에 커밋한다', () => {
    const store = createPlanStore(plan());
    useUi.getState().setWallDraft({ thickness: 20 });
    const pastLen = store.getState().past.length;
    finishWall(store, [{ x: 0, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }]);
    const added = store.getState().plan.walls.slice(1);
    expect(added).toHaveLength(2);
    expect(added.every((w) => w.thickness === 20 && w.height === 230)).toBe(true);
    expect(store.getState().past.length).toBe(pastLen + 1);
  });
});
