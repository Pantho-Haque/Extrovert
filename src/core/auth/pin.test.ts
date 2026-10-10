import { describe, expect, it } from 'vitest';
import { hashPin, verifyPin } from './pin';

describe('PIN', () => {
  it('verifies the right PIN only', () => {
    const stored = hashPin('2468');
    expect(verifyPin('2468', stored)).toBe(true);
    expect(verifyPin('2469', stored)).toBe(false);
  });

  it('salts every hash', () => {
    expect(hashPin('1111')).not.toBe(hashPin('1111'));
  });

  it('never stores the PIN itself', () => {
    expect(hashPin('8642')).not.toContain('8642');
  });

  it('rejects malformed stored values', () => {
    expect(verifyPin('1234', 'garbage')).toBe(false);
  });
});
