import { createStore, type StoreApi } from 'zustand/vanilla';
import { fitOpening, moveEndpoint, refitOpenings, roomRectWalls, setWallLength } from '../geometry/structure';
import { wallLength } from '../geometry/walls';
import { newId } from './ids';
import { activeItems, withActiveItems } from './layout';
import type { Background, Item, Opening, Plan, Product, Room, Vec2, Wall } from './schema';

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
  setBackground(background: Background | undefined): void;
  updateBackground(patch: Partial<Background>): void;
  undo(): void;
  redo(): void;
};

const normalizeDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360;
const roundVec = (p: Vec2): Vec2 => ({ x: Math.round(p.x), y: Math.round(p.y) });

function normalizeItem(item: Item): Item {
  return { ...item, x: Math.round(item.x), y: Math.round(item.y), rotation: normalizeDeg(item.rotation) };
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
        const copy = { ...src, id: newId('item'), x: src.x + 20, y: src.y + 20 };
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
        const fit = refitOpenings(walls, origin.openings);
        if (!fit.ok) return;
        set({ plan: { ...get().plan, walls, openings: fit.openings } });
      },

      endDrag: () => {
        const { dragOrigin, plan, past } = get();
        if (dragOrigin && dragOrigin !== plan) {
          set({ past: [...past, dragOrigin].slice(-HISTORY_LIMIT), future: [], dragOrigin: null });
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

      addWalls: (walls) => {
        const created = walls.map((w) => ({ ...w, a: roundVec(w.a), b: roundVec(w.b), id: newId('wall') }));
        if (created.length === 0) return [];
        commit({ ...get().plan, walls: [...get().plan.walls, ...created] });
        return created.map((w) => w.id);
      },

      updateWall: (id, patch) => {
        const plan = get().plan;
        if (!plan.walls.some((w) => w.id === id)) return;
        commit({ ...plan, walls: plan.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
      },

      resizeWall: (id, length) => {
        const plan = get().plan;
        const wall = plan.walls.find((w) => w.id === id);
        if (!wall) return null;
        if (!(length >= 1)) return '길이는 1cm 이상이어야 합니다.';
        const walls = moveEndpoint(plan.walls, wall.b, setWallLength(wall, length).b);
        const fit = refitOpenings(walls, plan.openings);
        if (!fit.ok) return openingError(plan, fit.openingId);
        commit({ ...plan, walls, openings: fit.openings });
        return null;
      },

      removeWall: (id) => {
        const plan = get().plan;
        if (!plan.walls.some((w) => w.id === id)) return;
        const gone = new Set([id, ...plan.openings.filter((o) => o.wallId === id).map((o) => o.id)]);
        commit(
          { ...plan, walls: plan.walls.filter((w) => w.id !== id), openings: plan.openings.filter((o) => o.wallId !== id) },
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
