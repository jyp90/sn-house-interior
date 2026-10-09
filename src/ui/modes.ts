import type { Entity } from '../model/entities';
import type { Mode, View } from './uiStore';

// 탭 순서: 상담 흐름대로 체크리스트 → 구조 → 전기 → 배치 → 내보내기 (spec §41). 기본 모드는 여전히 'place'
export const MODES: [Mode, string][] = [
  ['checklist', '체크리스트'],
  ['structure', '구조'],
  ['electric', '전기'],
  ['place', '배치'],
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
