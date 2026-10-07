import { create } from 'zustand';
import type { CalibrationDraft } from '../editor2d/calibration';
import type { FixtureKind } from '../electrical/fixtures';
import type { Vec2 } from '../model/schema';

export type Banner = { kind: 'error' | 'info'; text: string };
export type Mode = 'structure' | 'place' | 'electric';
export type View = '2d' | 'persp' | 'top';
export type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'opening' | 'label' | 'calibrate' | 'fixture';
export type SaveStatus = { state: 'clean' | 'pending' | 'saved' | 'error'; at?: number };
export type Candidates = { ids: string[]; clientX: number; clientY: number };
export type WallDraft = { thickness: number; height: number };
export type RoomDraft = { w: number; d: number; thickness: number; height: number; name: string };

type UiState = {
  mode: Mode;
  view: View;
  tool: Tool;
  fixtureKind: FixtureKind;
  snap: boolean;
  dragging: boolean;
  banner: Banner | null;
  viewResetKey: number;
  candidates: Candidates | null;
  saveStatus: SaveStatus;
  calibration: CalibrationDraft | null;
  wallDraft: WallDraft;
  roomDraft: RoomDraft;
  historyOpen: boolean;
  compareLayoutId: string | null;
  setMode(mode: Mode): void;
  setView(view: View): void;
  setTool(tool: Tool): void;
  setFixtureTool(kind: FixtureKind): void;
  toggleSnap(): void;
  setDragging(dragging: boolean): void;
  showBanner(banner: Banner): void;
  clearBanner(): void;
  resetView(): void;
  showCandidates(candidates: Candidates): void;
  clearCandidates(): void;
  setSaveStatus(status: SaveStatus): void;
  startCalibration(target: CalibrationDraft['target']): void;
  addCalibrationPoint(p: Vec2): void;
  cancelCalibration(): void;
  setWallDraft(patch: Partial<WallDraft>): void;
  setRoomDraft(patch: Partial<RoomDraft>): void;
  setHistoryOpen(open: boolean): void;
  setCompareLayout(id: string | null): void;
};

export const useUi = create<UiState>()((set, get) => ({
  mode: 'place',
  view: 'persp',
  tool: 'select',
  fixtureKind: 'outlet',
  snap: true,
  dragging: false,
  banner: null,
  viewResetKey: 0,
  candidates: null,
  saveStatus: { state: 'clean' },
  calibration: null,
  wallDraft: { thickness: 12, height: 230 },
  roomDraft: { w: 400, d: 300, thickness: 12, height: 230, name: '방' },
  historyOpen: false,
  compareLayoutId: null,
  setMode: (mode) => set({ mode, tool: 'select', candidates: null, calibration: null }),
  setView: (view) => set({ view, candidates: null }),
  setTool: (tool) => set({ tool, candidates: null, calibration: null }),
  setFixtureTool: (kind) => set({ tool: 'fixture', fixtureKind: kind, candidates: null, calibration: null }),
  toggleSnap: () => set({ snap: !get().snap }),
  setDragging: (dragging) => set({ dragging }),
  showBanner: (banner) => set({ banner }),
  clearBanner: () => set({ banner: null }),
  resetView: () => set({ viewResetKey: get().viewResetKey + 1 }),
  showCandidates: (candidates) => set({ candidates }),
  clearCandidates: () => set({ candidates: null }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  startCalibration: (target) => set({ tool: 'calibrate', calibration: { target, points: [] }, candidates: null }),
  addCalibrationPoint: (p) => {
    const c = get().calibration;
    if (!c || c.points.length >= 2) return;
    set({ calibration: { ...c, points: [...c.points, p] } });
  },
  cancelCalibration: () => set({ calibration: null, tool: 'select' }),
  setWallDraft: (patch) => set({ wallDraft: { ...get().wallDraft, ...patch } }),
  setRoomDraft: (patch) => set({ roomDraft: { ...get().roomDraft, ...patch } }),
  setHistoryOpen: (open) => set({ historyOpen: open }),
  setCompareLayout: (id) => set({ compareLayoutId: id }),
}));
