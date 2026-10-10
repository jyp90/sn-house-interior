import { create } from 'zustand';
import type { CalibrationDraft } from '../editor2d/calibration';
import type { FixtureKind } from '../electrical/fixtures';
import type { Vec2 } from '../model/schema';

type Banner = { kind: 'error' | 'info'; text: string };
export type Mode = 'structure' | 'place' | 'electric' | 'checklist' | 'export';
export type View = '2d' | 'persp' | 'top';
export type Tool = 'select' | 'wall' | 'room' | 'door' | 'middle-door' | 'window' | 'opening' | 'label' | 'calibrate' | 'fixture' | 'area' | 'measure';
type Measure = { a: Vec2; b: Vec2 | null };
export type SaveStatus = { state: 'clean' | 'pending' | 'saved' | 'error'; at?: number };
type Candidates = { ids: string[]; clientX: number; clientY: number };
type WallDraft = { thickness: number; height: number };
type RoomDraft = { w: number; d: number; thickness: number; height: number; name: string };

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
  // GitHub 동기화 패널(스펙 §45.2), 화면 전용
  syncOpen: boolean;
  compareLayoutId: string | null;
  areaTarget: string | null;
  // 「영역 그리기」를 누를 때마다 늘어난다. Editor2D가 이 값이 바뀌면 그리던 영역을 버린다(도구가 이미 area여도)
  areaSession: number;
  measure: Measure | null;
  itemListOpen: boolean;
  // 화면 폭 820px 이하(모바일): 보기 전용. matchMedia 구독으로 App이 설정한다(스펙 §33)
  setMode(mode: Mode): void;
  setView(view: View): void;
  setTool(tool: Tool): void;
  setFixtureTool(kind: FixtureKind): void;
  startArea(roomId: string | null): void;
  toggleSnap(): void;
  setDragging(dragging: boolean): void;
  showBanner(banner: Banner): void;
  clearBanner(): void;
  resetView(): void;
  showCandidates(candidates: Candidates): void;
  clearCandidates(): void;
  setSaveStatus(status: SaveStatus): void;
  /** 이 브라우저에 지금 바로 저장(main.tsx가 autosave flush를 연결, 스펙 §52) */
  saveNow: () => void;
  setSaveNow(fn: () => void): void;
  startCalibration(target: CalibrationDraft['target']): void;
  addCalibrationPoint(p: Vec2): void;
  cancelCalibration(): void;
  setWallDraft(patch: Partial<WallDraft>): void;
  setRoomDraft(patch: Partial<RoomDraft>): void;
  setHistoryOpen(open: boolean): void;
  setSyncOpen(open: boolean): void;
  setCompareLayout(id: string | null): void;
  measureClick(p: Vec2): void;
  clearMeasure(): void;
  setItemListOpen(open: boolean): void;
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
  saveNow: () => undefined,
  calibration: null,
  wallDraft: { thickness: 12, height: 230 },
  roomDraft: { w: 400, d: 300, thickness: 12, height: 230, name: '방' },
  historyOpen: false,
  syncOpen: false,
  compareLayoutId: null,
  areaTarget: null,
  areaSession: 0,
  measure: null,
  itemListOpen: true,
  setMode: (mode) => set({ mode, tool: 'select', candidates: null, calibration: null, areaTarget: null, measure: null }),
  setView: (view) => set({ view, candidates: null }),
  setTool: (tool) => set({ tool, candidates: null, calibration: null, areaTarget: null, measure: null }),
  setFixtureTool: (kind) => set({ tool: 'fixture', fixtureKind: kind, candidates: null, calibration: null, areaTarget: null, measure: null }),
  startArea: (roomId) => set((s) => ({ tool: 'area', areaTarget: roomId, areaSession: s.areaSession + 1, candidates: null, calibration: null, measure: null })),
  toggleSnap: () => set({ snap: !get().snap }),
  setDragging: (dragging) => set({ dragging }),
  showBanner: (banner) => set({ banner }),
  clearBanner: () => set({ banner: null }),
  resetView: () => set({ viewResetKey: get().viewResetKey + 1 }),
  showCandidates: (candidates) => set({ candidates }),
  clearCandidates: () => set({ candidates: null }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setSaveNow: (saveNow) => set({ saveNow }),
  startCalibration: (target) => set({ tool: 'calibrate', calibration: { target, points: [] }, candidates: null, measure: null }),
  addCalibrationPoint: (p) => {
    const c = get().calibration;
    if (!c || c.points.length >= 2) return;
    set({ calibration: { ...c, points: [...c.points, p] } });
  },
  cancelCalibration: () => set({ calibration: null, tool: 'select', areaTarget: null }),
  setWallDraft: (patch) => set({ wallDraft: { ...get().wallDraft, ...patch } }),
  setRoomDraft: (patch) => set({ roomDraft: { ...get().roomDraft, ...patch } }),
  setHistoryOpen: (open) => set({ historyOpen: open }),
  setSyncOpen: (open) => set({ syncOpen: open }),
  setCompareLayout: (id) => set({ compareLayoutId: id }),
  measureClick: (p) => {
    const m = get().measure;
    if (!m || m.b !== null) {
      set({ measure: { a: p, b: null } });
      return;
    }
    if (p.x === m.a.x && p.y === m.a.y) return;
    set({ measure: { a: m.a, b: p } });
  },
  clearMeasure: () => set({ measure: null }),
  setItemListOpen: (open) => set({ itemListOpen: open }),
  // 보기 전용으로 들어갈 때 도구·초안 상태를 모두 접어 둔다: 폭을 줄이기 전에 잡고 있던 그리기 도구가
  // 화면에서 사라진 패널 없이도 계속 활성 상태로 남는 일이 없게 한다(스펙 §33 리뷰 반영)
}));
