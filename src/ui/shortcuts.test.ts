import { describe, expect, it } from 'vitest';
import { activeItems } from '../model/layout';
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
    expect(activeItems(store.getState().plan)[0]).toMatchObject({ x: 101, y: 90 });
  });

  it('R은 90° 회전', () => {
    const { store, press } = setup();
    press('r');
    expect(activeItems(store.getState().plan)[0].rotation).toBe(90);
  });

  it('Delete는 선택 아이템을 삭제', () => {
    const { store, press } = setup();
    press('Delete');
    expect(activeItems(store.getState().plan)).toHaveLength(0);
  });

  it('Ctrl+D는 복제, Ctrl+Z/Ctrl+Shift+Z는 실행 취소/다시 실행', () => {
    const { store, press } = setup();
    press('d', { mod: true });
    expect(activeItems(store.getState().plan)).toHaveLength(2);
    press('z', { mod: true });
    expect(activeItems(store.getState().plan)).toHaveLength(1);
    press('Z', { mod: true, shiftKey: true });
    expect(activeItems(store.getState().plan)).toHaveLength(2);
  });

  it('입력 필드에서는 무시한다', () => {
    const { store, press } = setup();
    expect(press('Delete', { targetTag: 'INPUT' })).toBe(false);
    expect(activeItems(store.getState().plan)).toHaveLength(1);
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
    expect(activeItems(store.getState().plan)).toHaveLength(1);
  });

  it('버튼에 포커스가 있어도 Ctrl+Z / Ctrl+Shift+Z는 동작한다', () => {
    const { store, press } = setup();
    expect(press('z', { mod: true, targetTag: 'BUTTON' })).toBe(true);
    expect(activeItems(store.getState().plan)).toHaveLength(0);
    expect(press('z', { mod: true, shiftKey: true, targetTag: 'BUTTON' })).toBe(true);
    expect(activeItems(store.getState().plan)).toHaveLength(1);
  });

  it('입력 필드에서는 Ctrl+Z를 가로채지 않는다', () => {
    const { store, press } = setup();
    expect(press('z', { mod: true, targetTag: 'INPUT' })).toBe(false);
    expect(activeItems(store.getState().plan)).toHaveLength(1);
  });
});

describe('구조 단축키', () => {
  it('선택한 개구부·벽·방 이름은 Delete/Backspace로 지운다', () => {
    const store = createPlanStore(SAMPLE_PLAN);
    const press = (key: string) => applyShortcut(store.getState(), { key, shiftKey: false, mod: false });
    store.getState().select('o1');
    expect(press('Delete')).toBe(true);
    expect(store.getState().plan.openings.some((o) => o.id === 'o1')).toBe(false);
    store.getState().select('w1');
    expect(press('Backspace')).toBe(true);
    expect(store.getState().plan.walls.some((w) => w.id === 'w1')).toBe(false);
    store.getState().select('r1');
    expect(press('Delete')).toBe(true);
    expect(store.getState().plan.rooms.some((r) => r.id === 'r1')).toBe(false);
  });

  it('선택한 전기 설비는 Delete로 지운다', () => {
    const store = createPlanStore(SAMPLE_PLAN);
    const id = store.getState().addFixture({ kind: 'light', pos: { x: 100, y: 100 }, height: 230 });
    expect(applyShortcut(store.getState(), { key: 'Delete', shiftKey: false, mod: false })).toBe(true);
    expect(store.getState().plan.fixtures.some((f) => f.id === id)).toBe(false);
    expect(applyShortcut(store.getState(), { key: 'r', shiftKey: false, mod: false })).toBe(false);
  });

  it('벽 선택 중 R과 방향키는 처리하지 않는다', () => {
    const store = createPlanStore(SAMPLE_PLAN);
    store.getState().select('w1');
    expect(applyShortcut(store.getState(), { key: 'r', shiftKey: false, mod: false })).toBe(false);
    expect(applyShortcut(store.getState(), { key: 'ArrowLeft', shiftKey: false, mod: false })).toBe(false);
  });
});

it('잠긴 아이템은 방향키와 R을 무시한다', () => {
  const { store, id, press } = setup();
  store.getState().updateItem(id, { locked: true });
  expect(press('ArrowRight')).toBe(false);
  expect(press('r')).toBe(false);
  expect(activeItems(store.getState().plan)[0]).toMatchObject({ x: 100, y: 100, rotation: 0 });
});
