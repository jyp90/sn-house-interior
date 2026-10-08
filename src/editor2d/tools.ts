import type { StoreApi } from 'zustand/vanilla';
import { FIXTURE_DEFAULT_HEIGHT, snapFixture } from '../electrical/fixtures';
import { corners } from '../geometry/obb';
import { closesPolygon, isValidPolygon } from '../geometry/polygon';
import { nearestWall, openingAtPoint } from '../geometry/structure';
import { wallObb } from '../geometry/walls';
import type { Opening, Vec2, Wall } from '../model/schema';
import type { PlanState } from '../model/store';
import { useUi, type Tool } from '../ui/uiStore';
import { planToImagePx } from './calibration';
import { wallFaceCorners, wallSegments, wallToolPoint } from './snapping';

export const OPENING_PICK_CM = 30;

export const OPENING_DEFAULTS: Record<'door' | 'window' | 'opening', Omit<Opening, 'id' | 'wallId' | 'kind' | 'offset'>> = {
  door: { width: 90, height: 210, sill: 0, hinge: 'start', swingIn: true },
  window: { width: 120, height: 120, sill: 90, hinge: 'start', swingIn: false },
  opening: { width: 90, height: 210, sill: 0, hinge: 'start', swingIn: false },
};

// 현관 중문: 문과 같은 방식으로 벽에 붙이고 기본은 비대칭 양개, 실내 쪽 열림
export const MIDDLE_DOOR_DEFAULTS: Omit<Opening, 'id' | 'wallId' | 'kind' | 'offset'> = {
  width: 120, height: 210, sill: 0, hinge: 'start', swingIn: true, middle: true, leaves: 'asym',
};

const round = (p: Vec2): Vec2 => ({ x: Math.round(p.x), y: Math.round(p.y) });

type ToolContext = {
  store: StoreApi<PlanState>;
  wallPoints: Vec2[];
  setWallPoints(points: Vec2[]): void;
  areaPoints: Vec2[];
  setAreaPoints(points: Vec2[]): void;
};

export const AREA_CLOSE_CM = 15;

export function areaSnapPoints(walls: Wall[]): Vec2[] {
  return [...walls.flatMap((w) => [w.a, w.b, ...corners(wallObb(w)).map(round)]), ...wallFaceCorners(walls)];
}

export function areaToolPoint(raw: Vec2, points: Vec2[], walls: Wall[], snap: boolean): Vec2 {
  return wallToolPoint(raw, points.at(-1) ?? null, [...areaSnapPoints(walls), ...points], snap);
}

// 더블클릭은 같은 자리에서 pointerdown이 두 번 일어나 마지막 점이 중복되기 쉽고,
// 첫 점을 다시 클릭해 닫을 때도 마지막==첫 점이 그대로 남을 수 있다. 검증 전에 정리한다.
function dedupeConsecutive(points: Vec2[]): Vec2[] {
  const result: Vec2[] = [];
  for (const p of points) {
    const last = result.at(-1);
    if (last && last.x === p.x && last.y === p.y) continue;
    result.push(p);
  }
  if (result.length > 1) {
    const first = result[0];
    const last = result.at(-1)!;
    if (first.x === last.x && first.y === last.y) result.pop();
  }
  return result;
}

export function finishArea(store: StoreApi<PlanState>, points: Vec2[]): boolean {
  const ui = useUi.getState();
  const s = store.getState();
  const pts = dedupeConsecutive(points);
  if (!isValidPolygon(pts)) {
    ui.showBanner({
      kind: 'error',
      text: pts.length >= 3 ? '영역이 겹치거나 면적이 0입니다.' : '영역은 꼭짓점 3개 이상이어야 합니다.',
    });
    return false;
  }
  const ok = ui.areaTarget ? s.setRoomPolygon(ui.areaTarget, pts) : s.addRoomArea(pts) !== null;
  if (!ok) {
    ui.showBanner({ kind: 'error', text: '영역을 저장하지 못했습니다.' });
    return false;
  }
  if (ui.areaTarget) s.select(ui.areaTarget);
  ui.setTool('select');
  return true;
}

export function applyToolClick(tool: Tool, raw: Vec2, ctx: ToolContext): void {
  const ui = useUi.getState();
  const s = ctx.store.getState();
  switch (tool) {
    case 'wall': {
      const endpoints = [...s.plan.walls.flatMap((w) => [w.a, w.b]), ...ctx.wallPoints];
      const prev = ctx.wallPoints.at(-1) ?? null;
      ctx.setWallPoints([...ctx.wallPoints, wallToolPoint(raw, prev, endpoints, ui.snap)]);
      return;
    }
    case 'room': {
      const d = ui.roomDraft;
      s.addRoomRect({ origin: round(raw), w: d.w, d: d.d, thickness: d.thickness, height: d.height, name: d.name });
      ui.setTool('select');
      return;
    }
    case 'door':
    case 'middle-door':
    case 'window':
    case 'opening': {
      const wall = nearestWall(s.plan.walls, raw, OPENING_PICK_CM);
      if (!wall) {
        ui.showBanner({ kind: 'error', text: '벽 가까이(30cm 이내)를 클릭하세요.' });
        return;
      }
      const kind = tool === 'middle-door' ? 'door' : tool;
      const defaults = tool === 'middle-door' ? MIDDLE_DOOR_DEFAULTS : OPENING_DEFAULTS[tool];
      const offset = openingAtPoint(wall, raw, defaults.width);
      const id = offset === null ? null : s.addOpening({ wallId: wall.id, kind, offset, ...defaults });
      if (!id) {
        ui.showBanner({ kind: 'error', text: '벽이 개구부 폭보다 짧습니다.' });
        return;
      }
      s.select(id);
      return;
    }
    case 'label': {
      s.select(s.addRoom('방', round(raw)));
      ui.setTool('select');
      return;
    }
    case 'fixture': {
      const kind = ui.fixtureKind;
      const snapped = snapFixture(s.plan.walls, raw, kind, ui.snap);
      s.addFixture({ kind, pos: snapped.pos, ...(snapped.wallId ? { wallId: snapped.wallId } : {}), height: FIXTURE_DEFAULT_HEIGHT[kind] });
      return;
    }
    case 'calibrate': {
      const bg = s.plan.background;
      if (bg) ui.addCalibrationPoint(planToImagePx(bg, raw));
      return;
    }
    case 'area': {
      const first = ctx.areaPoints[0];
      if (first && ctx.areaPoints.length >= 3 && closesPolygon(raw, first, AREA_CLOSE_CM)) {
        if (finishArea(ctx.store, ctx.areaPoints)) ctx.setAreaPoints([]);
        return;
      }
      const next = areaToolPoint(raw, ctx.areaPoints, s.plan.walls, ui.snap);
      const last = ctx.areaPoints.at(-1);
      // 더블클릭의 두 번째 pointerdown이 같은 자리에 찍히는 것을 막는다 (dblclick이 따로 닫기를 처리한다)
      if (last && next.x === last.x && next.y === last.y) return;
      if (first && ctx.areaPoints.length < 3 && next.x === first.x && next.y === first.y) return;
      ctx.setAreaPoints([...ctx.areaPoints, next]);
      return;
    }
    case 'select':
      return;
  }
}

export function finishWall(store: StoreApi<PlanState>, points: Vec2[]): void {
  const { thickness, height } = useUi.getState().wallDraft;
  store.getState().addWalls(wallSegments(points).map(([a, b]) => ({ a, b, thickness, height })));
}
