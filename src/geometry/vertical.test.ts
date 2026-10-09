import { describe, expect, it } from 'vitest';
import { itemSpan, spansOverlap } from './vertical';

describe('spansOverlap', () => {
  it('겹치면 true', () => {
    expect(spansOverlap({ lo: 0, hi: 100 }, { lo: 50, hi: 150 })).toBe(true);
    expect(spansOverlap({ lo: 50, hi: 60 }, { lo: 0, hi: 100 })).toBe(true);
  });
  it('경계만 닿으면 false (세탁기 0–110 위 건조기 110–195)', () => {
    expect(spansOverlap({ lo: 0, hi: 110 }, { lo: 110, hi: 195 })).toBe(false);
    expect(spansOverlap({ lo: 110, hi: 195 }, { lo: 0, hi: 110 })).toBe(false);
  });
  it('떨어져 있으면 false', () => {
    expect(spansOverlap({ lo: 0, hi: 80 }, { lo: 90, hi: 186 })).toBe(false);
  });
});

describe('itemSpan', () => {
  it('밑면 높이와 제품 높이로 구간을 만든다', () => {
    expect(itemSpan(87, 6)).toEqual({ lo: 87, hi: 93 });
  });
});
