import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Item, Plan, Product, Vec2 } from './schema';

export const HISTORY_LIMIT = 100;

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
  endDrag(): void;
  replacePlan(plan: Plan): void;
  addCustomProduct(input: { name: string; w: number; d: number; h: number }): string;
  undo(): void;
  redo(): void;
};

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const normalizeDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360;

function normalizeItem(item: Item): Item {
  return { ...item, x: Math.round(item.x), y: Math.round(item.y), rotation: normalizeDeg(item.rotation) };
}

export function createPlanStore(initial: Plan): StoreApi<PlanState> {
  return createStore<PlanState>()((set, get) => {
    const commit = (plan: Plan, extra: Partial<PlanState> = {}) =>
      set((s) =>
        s.dragOrigin
          ? { plan, ...extra }
          : { plan, past: [...s.past, s.plan].slice(-HISTORY_LIMIT), future: [], ...extra },
      );
    const withItems = (fn: (items: Item[]) => Item[]): Plan => ({ ...get().plan, items: fn(get().plan.items) });

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
        if (!get().plan.items.some((i) => i.id === id)) return;
        commit(withItems((items) => items.map((i) => (i.id === id ? normalizeItem({ ...i, ...patch }) : i))));
      },

      removeItem: (id) => {
        if (!get().plan.items.some((i) => i.id === id)) return;
        commit(withItems((items) => items.filter((i) => i.id !== id)), {
          selectedId: get().selectedId === id ? null : get().selectedId,
        });
      },

      duplicateItem: (id) => {
        const src = get().plan.items.find((i) => i.id === id);
        if (!src) return null;
        const copy = { ...src, id: newId('item'), x: src.x + 20, y: src.y + 20 };
        commit(withItems((items) => [...items, copy]), { selectedId: copy.id });
        return copy.id;
      },

      rotateItem: (id, deltaDeg) => {
        const src = get().plan.items.find((i) => i.id === id);
        if (src) get().updateItem(id, { rotation: src.rotation + deltaDeg });
      },

      beginDrag: () => set({ dragOrigin: get().plan }),

      dragItem: (id, x, y) => {
        if (!get().dragOrigin) return;
        set({ plan: withItems((items) => items.map((i) => (i.id === id ? normalizeItem({ ...i, x, y }) : i))) });
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
