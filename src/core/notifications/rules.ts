/** What happens to an incoming notification: VIPs, Do Not Disturb, digest, work hours, snooze. */
import type { NotificationEntry, Settings } from '../../shared/types';

/** Different names for the same person across platforms map to one canonical name (FR-X07). */
export const canonicalPerson = (name: string, links: Record<string, string>): string => links[name] ?? name;

export function isVip(sender: string, settings: Pick<Settings, 'vips' | 'personLinks'>): boolean {
  const who = canonicalPerson(sender, settings.personLinks).toLowerCase();
  return settings.vips.some((v) => canonicalPerson(v, settings.personLinks).toLowerCase() === who);
}

export type AlertDecision =
  | { action: 'show'; vip: boolean; hidePreview: boolean }
  | { action: 'digest' }
  | { action: 'silent'; reason: 'dnd' | 'work-hours' | 'muted' | 'alerts-off' | 'locked' };

/**
 * Badges always update; this only decides whether the user is interrupted.
 * VIPs break through DND, digest and work hours, but never a muted service or a locked app.
 */
export function decideAlert(input: {
  settings: Pick<Settings, 'dnd' | 'digest' | 'vips' | 'personLinks' | 'previews' | 'shareShield'>;
  sender: string;
  instanceMuted: boolean;
  instanceAlerts: boolean;
  outsideWorkHours: boolean;
  sharingScreen: boolean;
  locked: boolean;
}): AlertDecision {
  const { settings } = input;
  if (input.instanceMuted) return { action: 'silent', reason: 'muted' };
  if (!input.instanceAlerts) return { action: 'silent', reason: 'alerts-off' };
  if (input.locked) return { action: 'silent', reason: 'locked' };
  const vip = isVip(input.sender, settings);
  const hidePreview = !settings.previews || (input.sharingScreen && settings.shareShield);
  if (vip) return { action: 'show', vip, hidePreview };
  if (settings.dnd) return { action: 'silent', reason: 'dnd' };
  if (input.outsideWorkHours) return { action: 'silent', reason: 'work-hours' };
  if (settings.digest.enabled) return { action: 'digest' };
  return { action: 'show', vip, hidePreview };
}

export type SnoozeChoice = '15m' | '1h' | 'tonight' | 'tomorrow';

/** When a snoozed notification comes back. "Tonight" is 20:00; "tomorrow" is 09:00. */
export function snoozeUntil(choice: SnoozeChoice, now: Date): number {
  const t = new Date(now);
  switch (choice) {
    case '15m':
      return now.getTime() + 15 * 60_000;
    case '1h':
      return now.getTime() + 60 * 60_000;
    case 'tonight':
      t.setHours(20, 0, 0, 0);
      if (t <= now) t.setDate(t.getDate() + 1);
      return t.getTime();
    case 'tomorrow':
      t.setDate(t.getDate() + 1);
      t.setHours(9, 0, 0, 0);
      return t.getTime();
  }
}

export const pruneHistory = (entries: NotificationEntry[], days: number, now: number): NotificationEntry[] =>
  entries.filter((e) => now - e.at < days * 86_400_000);

export interface PersonGroup {
  person: string;
  names: string[];
  entries: NotificationEntry[];
}

/** "Who's waiting on me": notifications grouped by person across every platform (FR-X07). */
export function groupByPerson(entries: NotificationEntry[], links: Record<string, string>): PersonGroup[] {
  const groups = new Map<string, PersonGroup>();
  for (const e of entries) {
    const person = canonicalPerson(e.sender, links);
    const g = groups.get(person) ?? { person, names: [], entries: [] };
    if (!g.names.includes(e.sender)) g.names.push(e.sender);
    g.entries.push(e);
    groups.set(person, g);
  }
  return [...groups.values()];
}
