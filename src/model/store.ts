import { createStore, type StoreApi } from 'zustand/vanilla';
import { fitOpening, moveEndpoint, refitOpenings, roomRectWalls, setWallLength } from '../geometry/structure';
import { refitFixtures } from '../electrical/fixtures';
import { wallLength } from '../geometry/walls';
import { isSimplePolygon, isValidPolygon, pointInPolygon, polygonCentroid } from '../geometry/polygon';
import { planFinish } from '../materials/presets';
import { newId } from './ids';
import { activeItems, activeLayout, nextLayoutName, withActiveItems } from './layout';
import type {
  Background,
  ChecklistState,
  Fixture,
  FloorFinish,
  Item,
  Layout,
  Opening,
  Plan,
  PlanFinish,
  PlanInfo,
  Product,
  Room,
  Vec2,
  Wall,
  WallFinish,
} from './schema';

export const HISTORY_LIMIT = 100;

const OPENING_LABEL: Record<Opening['kind'], string> = { door: '문', window: '창', opening: '개구부' };

export type PlanState = {
  plan: Plan;
  selectedId: string | null;
  past: Plan[];
  future: Plan[];
  dragOrigin: Plan | null;
  loadPlan(plan: Plan): void;
  select(id: string | null): void;
  addItem(productId: string, variantId: string, pos: Vec2): string;
  updateItem(id: string, patch: Partial<Omit<Item, 'id'>>): void;
  removeItem(id: string): void;
  duplicateItem(id: string): string | null;
  rotateItem(id: string, deltaDeg: number): void;
  beginDrag(): void;
  dragItem(id: string, x: number, y: number): void;
  dragEndpoint(from: Vec2, to: Vec2): void;
  endDrag(): void;
  replacePlan(plan: Plan): void;
  addCustomProduct(input: { name: string; w: number; d: number; h: number }): string;
  updateCustomProduct(productId: string, patch: { name?: string; w?: number; d?: number; h?: number }): void;
  addWalls(walls: Omit<Wall, 'id'>[]): string[];
  updateWall(id: string, patch: Partial<Pick<Wall, 'thickness' | 'height' | 'verified'>>): void;
  resizeWall(id: string, length: number): string | null;
  removeWall(id: string): void;
  addRoomRect(input: { origin: Vec2; w: number; d: number; thickness: number; height: number; name: string }): void;
  addOpening(opening: Omit<Opening, 'id'>): string | null;
  updateOpening(id: string, patch: Partial<Omit<Opening, 'id' | 'wallId'>>): string | null;
  removeOpening(id: string): void;
  addRoom(name: string, label: Vec2): string;
  updateRoom(id: string, patch: Partial<Omit<Room, 'id'>>): void;
  removeRoom(id: string): void;
  addRoomArea(polygon: Vec2[], name?: string): string | null;
  setRoomPolygon(id: string, polygon: Vec2[]): boolean;
  setRoomFinish(id: string, patch: { floor?: FloorFinish; wall?: WallFinish }): void;
  setPlanFinish(patch: Partial<PlanFinish>): void;
  dragRoomVertex(id: string, index: number, to: Vec2): void;
  addFixture(fixture: Omit<Fixture, 'id'>): string;
  updateFixture(id: string, patch: Partial<Omit<Fixture, 'id'>>): void;
  dragFixture(id: string, pos: Vec2, wallId?: string): void;
  removeFixture(id: string): void;
  setChecklistEntry(itemId: string, patch: { checked?: boolean; memo?: string }): void;
  updateInfo(patch: Partial<PlanInfo>): void;
  addLayout(): string;
  renameLayout(id: string, name: string): void;
  setLayoutMemo(id: string, memo: string): void;
  removeLayout(id: string): void;
  switchLayout(id: string): void;
  setBackground(background: Background | undefined): void;
  updateBackground(patch: Partial<Background>): void;
  undo(): void;
  redo(): void;
};

const normalizeDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360;
const roundVec = (p: Vec2): Vec2 => ({ x: Math.round(p.x), y: Math.round(p.y) });

function normalizeItem(item: Item): Item {
  const next: Item = { ...item, x: Math.round(item.x), y: Math.round(item.y), rotation: normalizeDeg(item.rotation) };
  if (item.elevation === undefined) delete next.elevation;
  else next.elevation = Math.max(0, Math.round(item.elevation));
  const note = next.note?.trim();
  if (note) next.note = note;
  else delete next.note;
  return next;
}

function normalizeFixture(f: Fixture): Fixture {
  const next: Fixture = { ...f, pos: roundVec(f.pos), height: Math.max(0, Math.round(f.height)) };
  if (next.wallId === undefined) delete next.wallId;
  const memo = next.memo?.trim();
  if (memo) next.memo = memo;
  else delete next.memo;
  return next;
}

function openingError(plan: Plan, openingId: string): string {
  const kind = plan.openings.find((o) => o.id === openingId)?.kind ?? 'opening';
  return `${OPENING_LABEL[kind]}이(가) 벽 길이를 벗어나 변경하지 않았습니다.`;
}

export function createPlanStore(initial: Plan): StoreApi<PlanState> {
  return createStore<PlanState>()((set, get) => {
    const commit = (plan: Plan, extra: Partial<PlanState> = {}) =>
      set((s) =>
        s.dragOrigin
          ? { plan, ...extra }
          : { plan, past: [...s.past, s.plan].slice(-HISTORY_LIMIT), future: [], ...extra },
      );
    const withItems = (fn: (items: Item[]) => Item[]): Plan => withActiveItems(get().plan, fn(activeItems(get().plan)));
    const findItem = (id: string) => activeItems(get().plan).find((i) => i.id === id);
    const deselectIf = (ids: Set<string>) => {
      const sel = get().selectedId;
      return sel !== null && ids.has(sel) ? null : sel;
    };

    return {
      plan: initial,
      selectedId: null,
      past: [],
      future: [],
      dragOrigin: null,

      loadPlan: (plan) => set({ plan, past: [], future: [], selectedId: null, dragOrigin: null }),
      select: (id) => set({ selectedId: id }),

      addItem: (productId, variantId, pos) => {
        const item = normalizeItem({ id: newId('item'), productId, variantId, x: pos.x, y: pos.y, rotation: 0 });
        commit(withItems((items) => [...items, item]), { selectedId: item.id });
        return item.id;
      },

      updateItem: (id, patch) => {
        const item = findItem(id);
        if (!item) return;
        const next: Partial<Omit<Item, 'id'>> = { ...patch };
        if (item.locked && patch.locked !== false) {
          delete next.x;
          delete next.y;
          delete next.rotation;
          delete next.elevation;
          if (Object.keys(next).length === 0) return;
        }
        commit(withItems((items) => items.map((i) => (i.id === id ? normalizeItem({ ...i, ...next }) : i))));
      },

      removeItem: (id) => {
        if (!findItem(id)) return;
        commit(withItems((items) => items.filter((i) => i.id !== id)), { selectedId: deselectIf(new Set([id])) });
      },

      duplicateItem: (id) => {
        const src = findItem(id);
        if (!src) return null;
        const copy = normalizeItem({ ...src, id: newId('item'), x: src.x + 20, y: src.y + 20 });
        commit(withItems((items) => [...items, copy]), { selectedId: copy.id });
        return copy.id;
      },

      rotateItem: (id, deltaDeg) => {
        const src = findItem(id);
        if (src) get().updateItem(id, { rotation: src.rotation + deltaDeg });
      },

      beginDrag: () => set({ dragOrigin: get().plan }),

      dragItem: (id, x, y) => {
        if (!get().dragOrigin) return;
        const item = findItem(id);
        if (!item || item.locked) return;
        set({ plan: withItems((items) => items.map((i) => (i.id === id ? normalizeItem({ ...i, x, y }) : i))) });
      },

      dragEndpoint: (from, to) => {
        const origin = get().dragOrigin;
        if (!origin) return;
        const walls = moveEndpoint(origin.walls, from, roundVec(to));
        // 끝점이 실제로 움직인 벽만 최소 길이(두께 이상)를 검사한다
        const moved = walls.filter((w, i) => w !== origin.walls[i]);
        if (moved.some((w) => wallLength(w) < w.thickness)) return;
        const fit = refitOpenings(walls, origin.openings);
        if (!fit.ok) return;
        set({ plan: { ...get().plan, walls, openings: fit.openings, fixtures: refitFixtures(origin.walls, walls, origin.fixtures) } });
      },

      endDrag: () => {
        const { dragOrigin, past } = get();
        let plan = get().plan;
        if (dragOrigin && dragOrigin !== plan) {
          // 꼭짓점을 끌어 이름표가 영역 밖에 남은 방은 이름표를 영역 가운데로 옮긴다(같은 되돌리기 단계)
          const before = new Map(dragOrigin.rooms.map((r) => [r.id, r.polygon]));
          const stray = (r: Room) => !!r.polygon && r.polygon !== before.get(r.id) && !pointInPolygon(r.label, r.polygon);
          if (plan.rooms.some(stray)) {
            plan = { ...plan, rooms: plan.rooms.map((r) => (stray(r) ? { ...r, label: polygonCentroid(r.polygon!) } : r)) };
          }
          set({ plan, past: [...past, dragOrigin].slice(-HISTORY_LIMIT), future: [], dragOrigin: null });
        } else {
          set({ dragOrigin: null });
        }
      },

      replacePlan: (plan) => commit(plan, { selectedId: null, dragOrigin: null }),

      addCustomProduct: ({ name, w, d, h }) => {
        const product: Product = {
          id: newId('custom'),
          brand: 'custom',
          model: '',
          name,
          category: 'custom',
          dims: { w: Math.round(w), d: Math.round(d), h: Math.round(h) },
          variants: [{ id: 'default', label: '기본', colors: { body: '#c8b8a0' } }],
          builder: 'box',
          clearances: [],
          builtIn: false,
          mount: 'floor',
        };
        commit({ ...get().plan, customProducts: [...get().plan.customProducts, product] });
        return product.id;
      },

      updateCustomProduct: (productId, patch) => {
        const plan = get().plan;
        const idx = plan.customProducts.findIndex((p) => p.id === productId);
        if (idx === -1) return; // 카탈로그 제품은 여기 없다
        const current = plan.customProducts[idx];
        const next: Product = { ...current, dims: { ...current.dims } };
        let changed = false;
        if (patch.name !== undefined) {
          const name = patch.name.trim();
          if (name && name !== current.name) {
            next.name = name;
            changed = true;
          }
        }
        for (const key of ['w', 'd', 'h'] as const) {
          const v = patch[key];
          if (v === undefined) continue;
          if (Number.isInteger(v) && v >= 1 && v <= 1000 && v !== current.dims[key]) {
            next.dims[key] = v;
            changed = true;
          }
        }
        if (!changed) return;
        commit({ ...plan, customProducts: plan.customProducts.map((p, i) => (i === idx ? next : p)) });
      },

      addWalls: (walls) => {
        const created = walls.map((w) => ({ ...w, a: roundVec(w.a), b: roundVec(w.b), id: newId('wall') }));
        if (created.length === 0) return [];
        commit({ ...get().plan, walls: [...get().plan.walls, ...created] });
        return created.map((w) => w.id);
      },

      updateWall: (id, patch) => {
        const plan = get().plan;
        if (!plan.walls.some((w) => w.id === id)) return;
        const walls = plan.walls.map((w) => (w.id === id ? { ...w, ...patch } : w));
        commit({ ...plan, walls, fixtures: refitFixtures(plan.walls, walls, plan.fixtures) });
      },

      resizeWall: (id, length) => {
        const plan = get().plan;
        const wall = plan.walls.find((w) => w.id === id);
        if (!wall) return null;
        if (!(length >= 1)) return '길이는 1cm 이상이어야 합니다.';
        if (length < wall.thickness) return `길이는 벽 두께(${wall.thickness}cm) 이상이어야 합니다.`;
        const walls = moveEndpoint(plan.walls, wall.b, setWallLength(wall, length).b);
        const fit = refitOpenings(walls, plan.openings);
        if (!fit.ok) return openingError(plan, fit.openingId);
        commit({ ...plan, walls, openings: fit.openings, fixtures: refitFixtures(plan.walls, walls, plan.fixtures) });
        return null;
      },

      removeWall: (id) => {
        const plan = get().plan;
        if (!plan.walls.some((w) => w.id === id)) return;
        const gone = new Set([id, ...plan.openings.filter((o) => o.wallId === id).map((o) => o.id)]);
        commit(
          {
            ...plan,
            walls: plan.walls.filter((w) => w.id !== id),
            openings: plan.openings.filter((o) => o.wallId !== id),
            fixtures: plan.fixtures.map((f) => (f.wallId === id ? normalizeFixture({ ...f, wallId: undefined }) : f)),
          },
          { selectedId: deselectIf(gone) },
        );
      },

      addRoomRect: ({ origin, w, d, thickness, height, name }) => {
        if ([w, d, thickness, height].some((v) => !(v >= 1))) return;
        const plan = get().plan;
        const o = roundVec(origin);
        const walls = roomRectWalls(o, Math.round(w), Math.round(d), Math.round(thickness), Math.round(height)).map((x) => ({
          ...x,
          id: newId('wall'),
        }));
        const room = { id: newId('room'), name, label: roundVec({ x: o.x + w / 2, y: o.y + d / 2 }) };
        commit({ ...plan, walls: [...plan.walls, ...walls], rooms: [...plan.rooms, room] });
      },

      addOpening: (opening) => {
        const plan = get().plan;
        const wall = plan.walls.find((w) => w.id === opening.wallId);
        if (!wall) return null;
        const offset = fitOpening(wall, opening.offset, opening.width);
        if (offset === null) return null;
        const created = { ...opening, offset, id: newId('opening') };
        commit({ ...plan, openings: [...plan.openings, created] });
        return created.id;
      },

      updateOpening: (id, patch) => {
        const plan = get().plan;
        const current = plan.openings.find((o) => o.id === id);
        if (!current) return null;
        const wall = plan.walls.find((w) => w.id === current.wallId);
        if (!wall) return null;
        const next = { ...current, ...patch };
        const len = Math.floor(wallLength(wall));
        if (next.width < 1 || next.width > len) return `폭은 1–${len}cm 사이여야 합니다.`;
        if (next.offset < 0 || next.offset + next.width > len) return `벽 시작점에서 거리는 0–${len - next.width}cm 사이여야 합니다.`;
        if (next.height < 1 || next.sill < 0) return '높이는 1cm 이상, 창턱은 0cm 이상이어야 합니다.';
        commit({ ...plan, openings: plan.openings.map((o) => (o.id === id ? next : o)) });
        return null;
      },

      removeOpening: (id) => {
        const plan = get().plan;
        if (!plan.openings.some((o) => o.id === id)) return;
        commit({ ...plan, openings: plan.openings.filter((o) => o.id !== id) }, { selectedId: deselectIf(new Set([id])) });
      },

      addRoom: (name, label) => {
        const room = { id: newId('room'), name, label: roundVec(label) };
        commit({ ...get().plan, rooms: [...get().plan.rooms, room] });
        return room.id;
      },

      updateRoom: (id, patch) => {
        const plan = get().plan;
        if (!plan.rooms.some((r) => r.id === id)) return;
        const label = patch.label ? roundVec(patch.label) : undefined;
        commit({ ...plan, rooms: plan.rooms.map((r) => (r.id === id ? { ...r, ...patch, ...(label ? { label } : {}) } : r)) });
      },

      removeRoom: (id) => {
        const plan = get().plan;
        if (!plan.rooms.some((r) => r.id === id)) return;
        commit({ ...plan, rooms: plan.rooms.filter((r) => r.id !== id) }, { selectedId: deselectIf(new Set([id])) });
      },

      addRoomArea: (polygon, name) => {
        const pts = polygon.map(roundVec);
        if (!isValidPolygon(pts) || !isSimplePolygon(pts)) return null;
        const plan = get().plan;
        const room: Room = { id: newId('room'), name: name ?? `방 ${plan.rooms.length + 1}`, label: polygonCentroid(pts), polygon: pts };
        commit({ ...plan, rooms: [...plan.rooms, room] }, { selectedId: room.id });
        return room.id;
      },

      setRoomPolygon: (id, polygon) => {
        const pts = polygon.map(roundVec);
        if (!isValidPolygon(pts) || !isSimplePolygon(pts)) return false;
        const plan = get().plan;
        const room = plan.rooms.find((r) => r.id === id);
        if (!room) return false;
        const label = pointInPolygon(room.label, pts) ? room.label : polygonCentroid(pts);
        commit({ ...plan, rooms: plan.rooms.map((r) => (r.id === id ? { ...r, polygon: pts, label } : r)) });
        return true;
      },

      setRoomFinish: (id, patch) => {
        const plan = get().plan;
        if (!plan.rooms.some((r) => r.id === id)) return;
        const norm = <T extends { color: string }>(f: T): T => ({ ...f, color: f.color.toLowerCase() });
        commit({
          ...plan,
          rooms: plan.rooms.map((r) =>
            r.id === id ? { ...r, ...(patch.floor ? { floor: norm(patch.floor) } : {}), ...(patch.wall ? { wall: norm(patch.wall) } : {}) } : r,
          ),
        });
      },

      setPlanFinish: (patch) => {
        const plan = get().plan;
        const cur = planFinish(plan);
        const lower = <T extends { color: string }>(f: T): T => ({ ...f, color: f.color.toLowerCase() });
        commit({ ...plan, finish: { floor: patch.floor ? lower(patch.floor) : cur.floor, wall: patch.wall ? lower(patch.wall) : cur.wall } });
      },

      dragRoomVertex: (id, index, to) => {
        const origin = get().dragOrigin;
        if (!origin) return;
        const room = origin.rooms.find((r) => r.id === id);
        if (!room?.polygon || index < 0 || index >= room.polygon.length) return;
        const polygon = room.polygon.map((p, i) => (i === index ? roundVec(to) : p));
        if (!isValidPolygon(polygon) || !isSimplePolygon(polygon)) return;
        set({ plan: { ...get().plan, rooms: get().plan.rooms.map((r) => (r.id === id ? { ...r, polygon } : r)) } });
      },

      addFixture: (fixture) => {
        const created = normalizeFixture({ ...fixture, id: newId('fixture') });
        commit({ ...get().plan, fixtures: [...get().plan.fixtures, created] }, { selectedId: created.id });
        return created.id;
      },

      updateFixture: (id, patch) => {
        const plan = get().plan;
        if (!plan.fixtures.some((f) => f.id === id)) return;
        commit({ ...plan, fixtures: plan.fixtures.map((f) => (f.id === id ? normalizeFixture({ ...f, ...patch }) : f)) });
      },

      dragFixture: (id, pos, wallId) => {
        if (!get().dragOrigin) return;
        const plan = get().plan;
        if (!plan.fixtures.some((f) => f.id === id)) return;
        set({ plan: { ...plan, fixtures: plan.fixtures.map((f) => (f.id === id ? normalizeFixture({ ...f, pos, wallId }) : f)) } });
      },

      removeFixture: (id) => {
        const plan = get().plan;
        if (!plan.fixtures.some((f) => f.id === id)) return;
        commit({ ...plan, fixtures: plan.fixtures.filter((f) => f.id !== id) }, { selectedId: deselectIf(new Set([id])) });
      },

      setChecklistEntry: (itemId, patch) => {
        const plan = get().plan;
        const current = plan.checklist.find((c) => c.itemId === itemId);
        const merged = { checked: current?.checked ?? false, memo: current?.memo, ...patch };
        const memo = merged.memo?.trim();
        const next: ChecklistState = { itemId, checked: merged.checked, ...(memo ? { memo } : {}) };
        const keep = next.checked || !!next.memo;
        if (current ? current.checked === next.checked && current.memo === next.memo : !keep) return;
        const checklist = current
          ? keep
            ? plan.checklist.map((c) => (c.itemId === itemId ? next : c))
            : plan.checklist.filter((c) => c.itemId !== itemId)
          : [...plan.checklist, next];
        commit({ ...plan, checklist });
      },

      updateInfo: (patch) => {
        const plan = get().plan;
        const info: Record<string, unknown> = { ...plan.info };
        for (const [key, value] of Object.entries(patch)) {
          const v = typeof value === 'string' ? value.trim() : value;
          if (key === 'title') {
            if (typeof v === 'string' && v) info.title = v;
            continue;
          }
          if (v === undefined || v === '') delete info[key];
          else info[key] = v;
        }
        const next = info as PlanInfo;
        if (JSON.stringify(next) === JSON.stringify(plan.info)) return;
        commit({ ...plan, info: next });
      },

      addLayout: () => {
        const plan = get().plan;
        const source = activeLayout(plan);
        const layout = {
          id: newId('layout'),
          name: nextLayoutName(plan.layouts.map((l) => l.name)),
          items: source.items.map((i) => ({ ...i, id: newId('item') })),
        };
        commit({ ...plan, layouts: [...plan.layouts, layout], activeLayoutId: layout.id }, { selectedId: null });
        return layout.id;
      },

      renameLayout: (id, name) => {
        const plan = get().plan;
        const trimmed = name.trim();
        if (!trimmed || !plan.layouts.some((l) => l.id === id)) return;
        commit({ ...plan, layouts: plan.layouts.map((l) => (l.id === id ? { ...l, name: trimmed } : l)) });
      },

      setLayoutMemo: (id, memo) => {
        const plan = get().plan;
        if (!plan.layouts.some((l) => l.id === id)) return;
        const trimmed = memo.trim();
        commit({
          ...plan,
          layouts: plan.layouts.map((l) => {
            if (l.id !== id) return l;
            const next: Layout = { ...l };
            delete next.memo;
            return trimmed ? { ...next, memo: trimmed } : next;
          }),
        });
      },

      removeLayout: (id) => {
        const plan = get().plan;
        if (plan.layouts.length <= 1 || !plan.layouts.some((l) => l.id === id)) return;
        const layouts = plan.layouts.filter((l) => l.id !== id);
        const wasActive = activeLayout(plan).id === id;
        commit(
          { ...plan, layouts, activeLayoutId: wasActive ? layouts[0].id : plan.activeLayoutId },
          wasActive ? { selectedId: null } : {},
        );
      },

      switchLayout: (id) => {
        const plan = get().plan;
        if (id === activeLayout(plan).id || !plan.layouts.some((l) => l.id === id)) return;
        commit({ ...plan, activeLayoutId: id }, { selectedId: null });
      },

      setBackground: (background) => commit({ ...get().plan, background }),

      updateBackground: (patch) => {
        const plan = get().plan;
        if (!plan.background) return;
        commit({ ...plan, background: { ...plan.background, ...patch } });
      },

      undo: () => {
        const { dragOrigin } = get();
        if (dragOrigin) {
          set({ plan: dragOrigin, dragOrigin: null });
          return;
        }
        const { past, plan, future } = get();
        if (past.length === 0) return;
        set({ plan: past[past.length - 1], past: past.slice(0, -1), future: [plan, ...future] });
      },

      redo: () => {
        if (get().dragOrigin) return;
        const { past, plan, future } = get();
        if (future.length === 0) return;
        set({ plan: future[0], past: [...past, plan], future: future.slice(1) });
      },
    };
  });
}
