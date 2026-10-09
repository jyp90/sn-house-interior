import { describe, expect, it } from 'vitest';
import { modeFromHash, modeToHash } from './modeHash';

describe('modeFromHash', () => {
  it('reads a known mode from the hash', () => {
    expect(modeFromHash('#structure')).toBe('structure');
    expect(modeFromHash('#checklist')).toBe('checklist');
    expect(modeFromHash('#export')).toBe('export');
  });
  it('returns null for empty or unknown hashes', () => {
    expect(modeFromHash('')).toBeNull();
    expect(modeFromHash('#')).toBeNull();
    expect(modeFromHash('#foo')).toBeNull();
    expect(modeFromHash('#Place')).toBeNull();
  });
});

describe('modeToHash', () => {
  it('formats a mode as a hash', () => {
    expect(modeToHash('place')).toBe('#place');
  });
});
