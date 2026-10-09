import { useEffect } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { findEntity } from '../model/entities';
import type { PlanState } from '../model/store';
import { useUi } from './uiStore';

export type KeyInput = { key: string; shiftKey: boolean; mod: boolean; targetTag?: string; viewOnly?: boolean };

const TEXT_INPUT = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function applyShortcut(s: PlanState, k: KeyInput): boolean {
  if (k.targetTag && TEXT_INPUT.has(k.targetTag)) return false;
  const key = k.key.toLowerCase();
  if (k.mod && key === 'z') {
    if (k.shiftKey) s.redo();
    else s.undo();
    return true;
  }
  // 보기 전용(모바일, 스펙 §33)에서는 실행 취소/다시 실행 외 편집 단축키를 모두 무시한다
  if (k.viewOnly) return false;
  // 패널 버튼을 누른 직후 포커스가 남아 있어도 Backspace로 지워지지 않게 한다
  if (k.targetTag === 'BUTTON') return false;
  const entity = findEntity(s.plan, s.selectedId);
  if (!entity) return false;
  const isDelete = k.key === 'Delete' || k.key === 'Backspace';
  if (entity.kind === 'wall') {
    if (isDelete) s.removeWall(entity.wall.id);
    return isDelete;
  }
  if (entity.kind === 'opening') {
    if (isDelete) s.removeOpening(entity.opening.id);
    return isDelete;
  }
  if (entity.kind === 'room') {
    if (isDelete) s.removeRoom(entity.room.id);
    return isDelete;
  }
  if (entity.kind === 'fixture') {
    if (isDelete) s.removeFixture(entity.fixture.id);
    return isDelete;
  }
  const item = entity.item;
  if (k.mod && key === 'd') {
    s.duplicateItem(item.id);
    return true;
  }
  if (isDelete) {
    s.removeItem(item.id);
    return true;
  }
  if (item.locked) return false;
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
        viewOnly: useUi.getState().viewOnly,
      });
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
}
