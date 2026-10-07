import type { Entity } from '../model/entities';
import type { Mode, View } from './uiStore';

export const MODES: [Mode, string][] = [
  ['structure', '구조'],
  ['place', '배치'],
  ['electric', '전기'],
  ['checklist', '체크리스트'],
  ['export', '내보내기'],
];

const SELECTABLE: Record<Mode, Entity['kind'][]> = {
  structure: ['wall', 'opening', 'room'],
  place: ['item'],
  electric: ['fixture'],
  checklist: [],
  export: [],
};

export function canSelectInMode(mode: Mode, kind: Entity['kind']): boolean {
  return SELECTABLE[mode].includes(kind);
}

// 가운데에 2D·3D 대신 별도 화면을 띄우는 모드
export function isPageMode(mode: Mode): boolean {
  return SELECTABLE[mode].length === 0;
}

export function shows2d(mode: Mode, view: View): boolean {
  return mode === 'structure' || mode === 'electric' || (mode === 'place' && view === '2d');
}
