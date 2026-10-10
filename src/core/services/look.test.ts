import { describe, expect, it } from 'vitest';
import { cleanLook } from './look';

describe('cleanLook', () => {
  it('keeps well-formed icons and colors', () => {
    expect(cleanLook({ icon: 'brand-telegram', color: '#0ea5e9' })).toEqual({ icon: 'brand-telegram', color: '#0EA5E9' });
  });

  it('drops anything else, and never invents fields', () => {
    expect(cleanLook({ icon: '<script>', color: 'red', label: 'x' })).toEqual({});
    expect(cleanLook({})).toEqual({});
  });

  it('clears a field with an empty value', () => {
    expect(cleanLook({ icon: '', color: null })).toEqual({ icon: undefined, color: undefined });
  });
});
