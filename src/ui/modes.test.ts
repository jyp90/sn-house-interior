import { describe, expect, it } from 'vitest';
import { canSelectInMode, isPageMode, MODES, shows2d } from './modes';

describe('modes', () => {
  it('모드 탭 순서와 이름', () => {
    expect(MODES).toEqual([
      ['structure', '구조'],
      ['place', '배치'],
      ['electric', '전기'],
    ]);
  });

  it('모드마다 선택할 수 있는 대상이 정해져 있다', () => {
    expect(canSelectInMode('structure', 'wall')).toBe(true);
    expect(canSelectInMode('structure', 'item')).toBe(false);
    expect(canSelectInMode('place', 'item')).toBe(true);
    expect(canSelectInMode('place', 'fixture')).toBe(false);
    expect(canSelectInMode('electric', 'fixture')).toBe(true);
    expect(canSelectInMode('electric', 'item')).toBe(false);
  });

  it('구조·전기는 항상 2D, 배치는 보기 설정을 따른다', () => {
    expect(shows2d('structure', 'persp')).toBe(true);
    expect(shows2d('electric', 'top')).toBe(true);
    expect(shows2d('place', '2d')).toBe(true);
    expect(shows2d('place', 'persp')).toBe(false);
    expect(isPageMode('electric')).toBe(false);
  });
});
