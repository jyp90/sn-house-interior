import { DEFAULT_LAYOUT_ID } from './layout';
import type { Plan } from './schema';

export function emptyPlanFields(): Pick<Plan, 'layouts' | 'activeLayoutId' | 'fixtures' | 'checklist' | 'customProducts'> {
  return {
    layouts: [{ id: DEFAULT_LAYOUT_ID, name: 'A안', items: [] }],
    activeLayoutId: DEFAULT_LAYOUT_ID,
    fixtures: [],
    checklist: [],
    customProducts: [],
  };
}

// 익명 샘플: 600×400cm, 칸막이 하나와 문 하나
export const SAMPLE_PLAN: Plan = {
  version: 3,
  info: { title: '샘플 평면' },
  walls: [
    { id: 'w1', a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, thickness: 20, height: 230 },
    { id: 'w2', a: { x: 600, y: 0 }, b: { x: 600, y: 400 }, thickness: 20, height: 230 },
    { id: 'w3', a: { x: 600, y: 400 }, b: { x: 0, y: 400 }, thickness: 20, height: 230 },
    { id: 'w4', a: { x: 0, y: 400 }, b: { x: 0, y: 0 }, thickness: 20, height: 230 },
    { id: 'w5', a: { x: 350, y: 0 }, b: { x: 350, y: 400 }, thickness: 12, height: 230 },
  ],
  openings: [
    { id: 'o1', wallId: 'w5', kind: 'door', offset: 250, width: 90, height: 210, sill: 0, hinge: 'start', swingIn: true },
    { id: 'o2', wallId: 'w1', kind: 'window', offset: 80, width: 180, height: 120, sill: 90, hinge: 'start', swingIn: false },
  ],
  rooms: [
    { id: 'r1', name: '거실', label: { x: 175, y: 200 } },
    { id: 'r2', name: '방', label: { x: 475, y: 200 } },
  ],
  ...emptyPlanFields(),
};
