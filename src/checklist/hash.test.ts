import { describe, expect, it } from 'vitest';
import { shortHash } from './hash';

describe('shortHash', () => {
  it('FNV-1a 32비트를 base36으로', () => {
    expect(shortHash('')).toBe((0x811c9dc5).toString(36));
    expect(shortHash('a')).toBe((0xe40c292c).toString(36));
    expect(shortHash('foobar')).toBe((0xbf9cf968).toString(36));
  });
  it('한글 문구도 같으면 같고 다르면 다르다', () => {
    expect(shortHash('전용회로 확인: 세탁기')).toBe(shortHash('전용회로 확인: 세탁기'));
    expect(shortHash('전용회로 확인: 세탁기')).not.toBe(shortHash('전용회로 확인: 건조기'));
  });
});
