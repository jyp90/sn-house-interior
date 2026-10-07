import { describe, expect, it } from 'vitest';
import { activeItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { createPlanStore } from '../model/store';
import {
  addRevision, AUTO_REVISION_MS, formatRevisionTime, loadRevisions, MAX_REVISIONS, recordAutoRevision, REVISIONS_KEY, saveRevisions, shouldAutoSnapshot,
} from './revisions';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

function throwingStorage(): Storage {
  const s = memoryStorage();
  s.getItem = () => { throw new Error('SecurityError'); };
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  return s;
}

describe('revisions', () => {
  it('최근 20개만 남기고 이름은 앞뒤 공백을 지운다', () => {
    let list = addRevision([], SAMPLE_PLAN, 0, '  처음 ');
    expect(list[0]).toMatchObject({ at: 0, label: '처음', plan: SAMPLE_PLAN });
    for (let i = 1; i <= 25; i++) list = addRevision(list, SAMPLE_PLAN, i);
    expect(list).toHaveLength(MAX_REVISIONS);
    expect(list[0].at).toBe(6);
  });

  it('저장한 이력을 다시 읽고, 깨진 항목은 건너뛴다', () => {
    const st = memoryStorage();
    const list = addRevision([], SAMPLE_PLAN, 10);
    expect(saveRevisions(list, st)).toBe(true);
    const raw = JSON.parse(st.getItem(REVISIONS_KEY)!);
    st.setItem(REVISIONS_KEY, JSON.stringify([...raw, { id: 'x', at: 1, plan: { version: 9 } }, 'junk']));
    expect(loadRevisions(st)).toEqual(list);
  });

  it('v1 평면 이력도 v2로 읽는다', () => {
    const st = memoryStorage();
    const v1 = { version: 1, info: SAMPLE_PLAN.info, walls: [], openings: [], rooms: [], items: [], fixtures: [], checklist: [], customProducts: [] };
    st.setItem(REVISIONS_KEY, JSON.stringify([{ id: 'r', at: 5, plan: v1 }]));
    expect(loadRevisions(st)[0].plan.layouts[0].name).toBe('A안');
  });

  it('저장소가 throw하면 빈 목록과 false', () => {
    const st = throwingStorage();
    expect(loadRevisions(st)).toEqual([]);
    expect(saveRevisions([], st)).toBe(false);
    expect(recordAutoRevision(SAMPLE_PLAN, 0, st)).toBe(false);
  });

  it('자동 스냅샷은 마지막 이력에서 5분이 지났을 때만', () => {
    const st = memoryStorage();
    expect(recordAutoRevision(SAMPLE_PLAN, 1000, st)).toBe(true);
    expect(recordAutoRevision(SAMPLE_PLAN, 1000 + AUTO_REVISION_MS - 1, st)).toBe(false);
    expect(recordAutoRevision(SAMPLE_PLAN, 1000 + AUTO_REVISION_MS, st)).toBe(true);
    expect(loadRevisions(st)).toHaveLength(2);
    expect(shouldAutoSnapshot([], 0)).toBe(true);
  });

  it('시각을 YYYY-MM-DD HH:MM로', () => {
    expect(formatRevisionTime(new Date(2026, 9, 8, 9, 5).getTime())).toBe('2026-10-08 09:05');
  });

  it('복원은 실행 취소 한 번으로 되돌아간다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem('p', 'v', { x: 0, y: 0 });
    const current = s.getState().plan;
    s.getState().replacePlan(addRevision([], SAMPLE_PLAN, 0)[0].plan);
    expect(activeItems(s.getState().plan)).toEqual([]);
    s.getState().undo();
    expect(s.getState().plan).toBe(current);
  });
});
