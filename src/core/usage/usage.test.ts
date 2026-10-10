import { describe, expect, it } from 'vitest';
import { addSeconds, dayKey, feedGuardDue, pruneUsage, shouldCount, weekTotals } from './usage';

describe('shouldCount', () => {
  const active = { windowFocused: true, instanceOnScreen: true, idleSeconds: 5, mediaPlaying: false, screenLocked: false };
  it('counts only while focused, on screen and active', () => {
    expect(shouldCount(active)).toBe(true);
    expect(shouldCount({ ...active, windowFocused: false })).toBe(false);
    expect(shouldCount({ ...active, instanceOnScreen: false })).toBe(false);
    expect(shouldCount({ ...active, screenLocked: true })).toBe(false);
    expect(shouldCount({ ...active, idleSeconds: 61 })).toBe(false);
  });
  it('keeps counting while media plays without input (watching a reel)', () => {
    expect(shouldCount({ ...active, idleSeconds: 300, mediaPlaying: true })).toBe(true);
  });
});

describe('usage log', () => {
  const today = new Date('2026-10-12T12:00:00');
  it('adds seconds per day and instance', () => {
    let log = addSeconds({}, '2026-10-12', 'fb', 30);
    log = addSeconds(log, '2026-10-12', 'fb', 30);
    log = addSeconds(log, '2026-10-12', 'wa', 10);
    expect(log).toEqual({ '2026-10-12': { fb: 60, wa: 10 } });
  });
  it('builds a 7-day series ending today', () => {
    const week = weekTotals({ '2026-10-12': { a: 60, b: 40 }, '2026-10-06': { a: 5 }, '2026-10-01': { a: 999 } }, today);
    expect(week.map((d) => d.day)).toEqual(['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12']);
    expect(week[0]!.seconds).toBe(5);
    expect(week[6]!.seconds).toBe(100);
  });
  it('prunes old days', () => {
    expect(Object.keys(pruneUsage({ '2026-09-01': {}, '2026-10-12': {} }, today))).toEqual(['2026-10-12']);
  });
  it('formats local dates', () => {
    expect(dayKey(new Date('2026-01-05T23:59:00'))).toBe('2026-01-05');
  });
});

describe('feedGuardDue', () => {
  const base = { enabled: true, type: 'facebook' as const, isFeed: true, todaySeconds: 0, budgets: { facebook: 30 }, continuousSeconds: 0, nudgeAfterMin: 15, snoozedUntil: 0, now: 1000 };
  it('triggers past the daily budget or after a long session', () => {
    expect(feedGuardDue(base)).toBe(false);
    expect(feedGuardDue({ ...base, todaySeconds: 30 * 60 })).toBe(true);
    expect(feedGuardDue({ ...base, continuousSeconds: 15 * 60 })).toBe(true);
  });
  it('never limits messaging, and respects off and snooze', () => {
    expect(feedGuardDue({ ...base, isFeed: false, todaySeconds: 99999 })).toBe(false);
    expect(feedGuardDue({ ...base, enabled: false, todaySeconds: 99999 })).toBe(false);
    expect(feedGuardDue({ ...base, todaySeconds: 99999, snoozedUntil: 2000 })).toBe(false);
  });
});
