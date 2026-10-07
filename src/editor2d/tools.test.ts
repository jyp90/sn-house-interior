import { beforeEach, describe, expect, it } from 'vitest';
import { emptyPlanFields } from '../model/samplePlan';
import { createPlanStore } from '../model/store';
import { useUi } from '../ui/uiStore';
import { applyToolClick, finishWall } from './tools';

const plan = () => ({
  version: 1 as const, info: { title: 't' }, rooms: [], openings: [], ...emptyPlanFields(),
  walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 }],
});

beforeEach(() => useUi.setState(useUi.getInitialState(), true));

describe('applyToolClick', () => {
  it('벽 도구는 스냅된 점을 쌓는다', () => {
    const store = createPlanStore(plan());
    let points = [{ x: 0, y: 100 }];
    applyToolClick('wall', { x: 200, y: 106 }, { store, wallPoints: points, setWallPoints: (p) => (points = p) });
    expect(points).toEqual([{ x: 0, y: 100 }, { x: 200, y: 100 }]);
  });

  it('문 도구는 가까운 벽에 문을 놓고 선택한다', () => {
    const store = createPlanStore(plan());
    applyToolClick('door', { x: 200, y: 12 }, { store, wallPoints: [], setWallPoints: () => {} });
    const [door] = store.getState().plan.openings;
    expect(door).toMatchObject({ wallId: 'w', kind: 'door', offset: 155, width: 90, height: 210, sill: 0 });
    expect(store.getState().selectedId).toBe(door.id);
  });

  it('벽에서 멀면 아무것도 만들지 않고 안내한다', () => {
    const store = createPlanStore(plan());
    applyToolClick('window', { x: 200, y: 200 }, { store, wallPoints: [], setWallPoints: () => {} });
    expect(store.getState().plan.openings).toEqual([]);
    expect(useUi.getState().banner?.text).toBe('벽 가까이(30cm 이내)를 클릭하세요.');
  });

  it('방 만들기는 초안 크기로 방을 만들고 선택 도구로 돌아간다', () => {
    const store = createPlanStore(plan());
    useUi.getState().setTool('room');
    applyToolClick('room', { x: 50.4, y: 60 }, { store, wallPoints: [], setWallPoints: () => {} });
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
    applyToolClick('calibrate', { x: 110, y: 40 }, { store, wallPoints: [], setWallPoints: () => {} });
    expect(useUi.getState().calibration?.points).toEqual([{ x: 50, y: 20 }]);
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
