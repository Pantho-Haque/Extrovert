import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, loadSettings } from './defaults';

describe('loadSettings', () => {
  it('returns defaults for nothing or garbage', () => {
    expect(loadSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings('nope')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid stored values and fills in new settings', () => {
    const s = loadSettings({ dnd: true, digest: { enabled: true } });
    expect(s.dnd).toBe(true);
    expect(s.digest).toEqual({ enabled: true, intervalMin: 60 });
    expect(s.historyDays).toBe(30);
  });

  it('drops unknown keys and wrong types', () => {
    const s = loadSettings({ dnd: 'yes', bogus: 1, theme: 3 }) as unknown as Record<string, unknown>;
    expect(s.dnd).toBe(false);
    expect(s.theme).toBe('system');
    expect('bogus' in s).toBe(false);
  });

  it('keeps user-defined map entries of the right type', () => {
    const s = loadSettings({ personLinks: { Rahim: 'Rahim Uddin', bad: 5 }, feedGuard: { budgets: { tiktok: 10, facebook: 'x' } } });
    expect(s.personLinks).toEqual({ Rahim: 'Rahim Uddin' });
    expect(s.feedGuard.budgets).toEqual({ facebook: 30, instagram: 20, linkedin: 30, tiktok: 10 });
  });

  it('keeps the optional PIN hash only when it is a string', () => {
    expect(loadSettings({ appLock: { pinHash: 'abc' } }).appLock.pinHash).toBe('abc');
    expect(loadSettings({ appLock: { pinHash: 42 } }).appLock.pinHash).toBeUndefined();
  });

  it('does not share arrays with the defaults', () => {
    const s = loadSettings({});
    expect(s.vips).toEqual([]);
    expect(s.vips).not.toBe(DEFAULT_SETTINGS.vips);
    expect(s.feedGuard.budgets).not.toBe(DEFAULT_SETTINGS.feedGuard.budgets);
  });
});
