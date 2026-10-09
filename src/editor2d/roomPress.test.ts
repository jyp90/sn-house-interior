import { describe, expect, it } from 'vitest';
import { isRoomPress, markRoomPress } from './roomPress';

describe('roomPress', () => {
  it('표시한 이벤트만 방 누름으로 판정한다', () => {
    const a = new Event('pointerdown');
    const b = new Event('pointerdown');
    markRoomPress(a);
    expect(isRoomPress(a)).toBe(true);
    expect(isRoomPress(b)).toBe(false);
  });
});
