import { useEffect } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { PlanState } from '../model/store';

export type KeyInput = { key: string; shiftKey: boolean; mod: boolean; targetTag?: string };

const EDITABLE = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function applyShortcut(s: PlanState, k: KeyInput): boolean {
  if (k.targetTag && EDITABLE.has(k.targetTag)) return false;
  const key = k.key.toLowerCase();
  if (k.mod && key === 'z') {
    if (k.shiftKey) s.redo();
    else s.undo();
    return true;
  }
  const item = s.plan.items.find((i) => i.id === s.selectedId);
  if (!item) return false;
  if (k.mod && key === 'd') {
    s.duplicateItem(item.id);
    return true;
  }
  if (k.key === 'Delete' || k.key === 'Backspace') {
    s.removeItem(item.id);
    return true;
  }
  if (!k.mod && key === 'r') {
    s.rotateItem(item.id, 90);
    return true;
  }
  const arrow = ARROWS[k.key];
  if (arrow) {
    const step = k.shiftKey ? 10 : 1;
    s.updateItem(item.id, { x: item.x + arrow[0] * step, y: item.y + arrow[1] * step });
    return true;
  }
  return false;
}

export function useShortcuts(store: StoreApi<PlanState>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const handled = applyShortcut(store.getState(), {
        key: e.key,
        shiftKey: e.shiftKey,
        mod: e.metaKey || e.ctrlKey,
        targetTag: (e.target as HTMLElement | null)?.tagName,
      });
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
}
