import { describe, expect, it } from 'vitest';
import { saveLabel } from './saveLabel';

describe('saveLabel', () => {
  it('저장 상태를 문구로', () => {
    expect(saveLabel({ state: 'clean' })).toBe('변경 없음');
    expect(saveLabel({ state: 'pending' })).toBe('저장 중…');
    expect(saveLabel({ state: 'error' })).toBe('저장 실패');
    expect(saveLabel({ state: 'saved', at: new Date(2026, 9, 8, 9, 5).getTime() })).toBe('저장됨 09:05');
  });
});
