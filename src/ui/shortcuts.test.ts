import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { createPlanStore } from '../model/store';
import { applyShortcut } from './shortcuts';

function setup() {
  const store = createPlanStore(SAMPLE_PLAN);
  const id = store.getState().addItem('p', 'v', { x: 100, y: 100 });
  const press = (key: string, o: { shiftKey?: boolean; mod?: boolean; targetTag?: string } = {}) =>
    applyShortcut(store.getState(), { key, shiftKey: !!o.shiftKey, mod: !!o.mod, targetTag: o.targetTag });
  return { store, id, press };
}

describe('applyShortcut', () => {
  it('방향키는 1cm, Shift+방향키는 10cm 이동', () => {
    const { store, press } = setup();
    expect(press('ArrowRight')).toBe(true);
    press('ArrowUp', { shiftKey: true });
    expect(store.getState().plan.items[0]).toMatchObject({ x: 101, y: 90 });
  });

  it('R은 90° 회전', () => {
    const { store, press } = setup();
    press('r');
    expect(store.getState().plan.items[0].rotation).toBe(90);
  });

  it('Delete는 선택 아이템을 삭제', () => {
    const { store, press } = setup();
    press('Delete');
    expect(store.getState().plan.items).toHaveLength(0);
  });

  it('Ctrl+D는 복제, Ctrl+Z/Ctrl+Shift+Z는 실행 취소/다시 실행', () => {
    const { store, press } = setup();
    press('d', { mod: true });
    expect(store.getState().plan.items).toHaveLength(2);
    press('z', { mod: true });
    expect(store.getState().plan.items).toHaveLength(1);
    press('Z', { mod: true, shiftKey: true });
    expect(store.getState().plan.items).toHaveLength(2);
  });

  it('입력 필드에서는 무시한다', () => {
    const { store, press } = setup();
    expect(press('Delete', { targetTag: 'INPUT' })).toBe(false);
    expect(store.getState().plan.items).toHaveLength(1);
  });

  it('선택이 없으면 편집 단축키는 무시한다', () => {
    const { store, press } = setup();
    store.getState().select(null);
    expect(press('Delete')).toBe(false);
  });

  it('버튼에 포커스가 있으면 삭제 단축키를 무시한다', () => {
    const { store, press } = setup();
    expect(press('Backspace', { targetTag: 'BUTTON' })).toBe(false);
    expect(press('Delete', { targetTag: 'BUTTON' })).toBe(false);
    expect(store.getState().plan.items).toHaveLength(1);
  });
});
