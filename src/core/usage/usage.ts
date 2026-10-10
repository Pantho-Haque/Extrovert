/** Time insights (FR-X14) and feed guard budgets (FR-X15). Pure bookkeeping, no timers. */
import type { ServiceType } from '../../shared/types';

/** seconds[day "YYYY-MM-DD"][instanceId] */
export type UsageLog = Record<string, Record<string, number>>;

export const dayKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Idle threshold: time counts only with keyboard/mouse activity in the last minute, or media playing. */
export const IDLE_SECONDS = 60;

export function shouldCount(input: { windowFocused: boolean; instanceOnScreen: boolean; idleSeconds: number; mediaPlaying: boolean; screenLocked: boolean }): boolean {
  if (!input.windowFocused || !input.instanceOnScreen || input.screenLocked) return false;
  return input.idleSeconds < IDLE_SECONDS || input.mediaPlaying;
}

export function addSeconds(log: UsageLog, day: string, instanceId: string, seconds: number): UsageLog {
  const today = log[day] ?? {};
  return { ...log, [day]: { ...today, [instanceId]: (today[instanceId] ?? 0) + seconds } };
}

/** Keep only the last `days` days. */
export function pruneUsage(log: UsageLog, today: Date, days = 14): UsageLog {
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days + 1);
  const min = dayKey(cutoff);
  return Object.fromEntries(Object.entries(log).filter(([d]) => d >= min));
}

/** Last 7 days, oldest first, as total seconds per day. */
export function weekTotals(log: UsageLog, today: Date): { day: string; seconds: number }[] {
  return Array.from({ length: 7 }, (_, k) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - k));
    const key = dayKey(d);
    return { day: key, seconds: Object.values(log[key] ?? {}).reduce((a, b) => a + b, 0) };
  });
}

/**
 * Feed guard: check in once today's time on a feed passes its budget, and again after every
 * further `nudgeAfterMin` of continuous scrolling. Messaging is never limited.
 */
export function feedGuardDue(input: {
  enabled: boolean;
  type: ServiceType;
  isFeed: boolean;
  todaySeconds: number;
  budgets: Partial<Record<ServiceType, number>>;
  continuousSeconds: number;
  nudgeAfterMin: number;
  snoozedUntil: number;
  now: number;
}): boolean {
  if (!input.enabled || !input.isFeed || input.now < input.snoozedUntil) return false;
  const budget = input.budgets[input.type];
  const overBudget = budget !== undefined && input.todaySeconds >= budget * 60;
  const longSession = input.continuousSeconds >= input.nudgeAfterMin * 60;
  return overBudget || longSession;
}
