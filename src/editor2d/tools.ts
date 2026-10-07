import type { StoreApi } from 'zustand/vanilla';
import { nearestWall, openingAtPoint } from '../geometry/structure';
import type { Opening, Vec2 } from '../model/schema';
import type { PlanState } from '../model/store';
import { useUi, type Tool } from '../ui/uiStore';
import { planToImagePx } from './calibration';
import { wallSegments, wallToolPoint } from './snapping';

export const OPENING_PICK_CM = 30;

export const OPENING_DEFAULTS: Record<'door' | 'window' | 'opening', Omit<Opening, 'id' | 'wallId' | 'kind' | 'offset'>> = {
  door: { width: 90, height: 210, sill: 0, hinge: 'start', swingIn: true },
  window: { width: 120, height: 120, sill: 90, hinge: 'start', swingIn: false },
  opening: { width: 90, height: 210, sill: 0, hinge: 'start', swingIn: false },
};

const round = (p: Vec2): Vec2 => ({ x: Math.round(p.x), y: Math.round(p.y) });

type ToolContext = { store: StoreApi<PlanState>; wallPoints: Vec2[]; setWallPoints(points: Vec2[]): void };

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
    case 'window':
    case 'opening': {
      const wall = nearestWall(s.plan.walls, raw, OPENING_PICK_CM);
      if (!wall) {
        ui.showBanner({ kind: 'error', text: '벽 가까이(30cm 이내)를 클릭하세요.' });
        return;
      }
      const defaults = OPENING_DEFAULTS[tool];
      const offset = openingAtPoint(wall, raw, defaults.width);
      const id = offset === null ? null : s.addOpening({ wallId: wall.id, kind: tool, offset, ...defaults });
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
    case 'calibrate': {
      const bg = s.plan.background;
      if (bg) ui.addCalibrationPoint(planToImagePx(bg, raw));
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
