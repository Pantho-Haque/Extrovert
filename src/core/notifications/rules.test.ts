import { describe, expect, it } from 'vitest';
import type { NotificationEntry } from '../../shared/types';
import { decideAlert, groupByPerson, isVip, pruneHistory, snoozeUntil } from './rules';

const settings = { dnd: false, digest: { enabled: false, intervalMin: 60 }, vips: ['Mom'], personLinks: { Rahim: 'Rahim Uddin' }, previews: true, shareShield: true };
const base = { settings, sender: 'Sara', instanceMuted: false, instanceAlerts: true, outsideWorkHours: false, sharingScreen: false, locked: false };

describe('decideAlert', () => {
  it('shows a normal message', () => {
    expect(decideAlert(base)).toEqual({ action: 'show', vip: false, hidePreview: false });
  });

  it('silences on DND and outside work hours, holds for digest', () => {
    expect(decideAlert({ ...base, settings: { ...settings, dnd: true } })).toEqual({ action: 'silent', reason: 'dnd' });
    expect(decideAlert({ ...base, outsideWorkHours: true })).toEqual({ action: 'silent', reason: 'work-hours' });
    expect(decideAlert({ ...base, settings: { ...settings, digest: { enabled: true, intervalMin: 30 } } })).toEqual({ action: 'digest' });
  });

  it('lets VIPs through DND, digest and work hours', () => {
    const loud = { ...base, sender: 'Mom', outsideWorkHours: true, settings: { ...settings, dnd: true, digest: { enabled: true, intervalMin: 30 } } };
    expect(decideAlert(loud)).toEqual({ action: 'show', vip: true, hidePreview: false });
  });

  it('never alerts for muted services, alerts-off or a locked app, even VIPs', () => {
    expect(decideAlert({ ...base, sender: 'Mom', instanceMuted: true })).toMatchObject({ action: 'silent', reason: 'muted' });
    expect(decideAlert({ ...base, sender: 'Mom', instanceAlerts: false })).toMatchObject({ action: 'silent', reason: 'alerts-off' });
    expect(decideAlert({ ...base, sender: 'Mom', locked: true })).toMatchObject({ action: 'silent', reason: 'locked' });
  });

  it('hides previews while sharing the screen (shield) or when previews are off', () => {
    expect(decideAlert({ ...base, sharingScreen: true })).toMatchObject({ hidePreview: true });
    expect(decideAlert({ ...base, sharingScreen: true, settings: { ...settings, shareShield: false } })).toMatchObject({ hidePreview: false });
    expect(decideAlert({ ...base, settings: { ...settings, previews: false } })).toMatchObject({ hidePreview: true });
  });
});

describe('isVip', () => {
  it('matches case-insensitively and through linked names', () => {
    expect(isVip('mom', settings)).toBe(true);
    expect(isVip('Rahim', { vips: ['Rahim Uddin'], personLinks: settings.personLinks })).toBe(true);
    expect(isVip('Sara', settings)).toBe(false);
  });
});

describe('snoozeUntil', () => {
  const now = new Date('2026-10-12T14:10:00');
  it('adds minutes', () => {
    expect(snoozeUntil('15m', now) - now.getTime()).toBe(15 * 60_000);
    expect(snoozeUntil('1h', now) - now.getTime()).toBe(3_600_000);
  });
  it('tonight is 20:00, or tomorrow 20:00 when already past', () => {
    expect(new Date(snoozeUntil('tonight', now)).toString()).toBe(new Date('2026-10-12T20:00:00').toString());
    expect(new Date(snoozeUntil('tonight', new Date('2026-10-12T21:00:00'))).toString()).toBe(new Date('2026-10-13T20:00:00').toString());
  });
  it('tomorrow is 09:00 the next day', () => {
    expect(new Date(snoozeUntil('tomorrow', now)).toString()).toBe(new Date('2026-10-13T09:00:00').toString());
  });
});

const entry = (sender: string, at = 0): NotificationEntry => ({ id: sender + at, workspaceId: 'w', instanceId: 'i', sender, body: 'hi', at });

describe('history', () => {
  it('drops entries older than the retention window', () => {
    const day = 86_400_000;
    expect(pruneHistory([entry('a', 0), entry('b', 9 * day)], 7, 10 * day).map((e) => e.sender)).toEqual(['b']);
  });

  it('groups by person through linked names', () => {
    const groups = groupByPerson([entry('Rahim'), entry('Rahim Uddin'), entry('Sara')], settings.personLinks);
    expect(groups.map((g) => [g.person, g.names, g.entries.length])).toEqual([
      ['Rahim Uddin', ['Rahim', 'Rahim Uddin'], 2],
      ['Sara', ['Sara'], 1],
    ]);
  });
});
