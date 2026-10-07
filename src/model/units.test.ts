import { describe, expect, it } from 'vitest';
import { cmToM, CM_PER_M, mToCm } from './units';

describe('units', () => {
  it('cm와 m를 서로 바꾼다', () => {
    expect(CM_PER_M).toBe(100);
    expect(cmToM(150)).toBe(1.5);
    expect(mToCm(2.5)).toBe(250);
  });
});
