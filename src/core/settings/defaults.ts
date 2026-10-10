/** Default value of every user setting, and safe loading of stored settings (FR-P01). */
import type { Settings } from '../../shared/types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  dnd: false,
  digest: { enabled: false, intervalMin: 60 },
  previews: true,
  awayRecap: { enabled: true, afterMin: 15 },
  historyDays: 30,
  vips: [],
  replies: ["Thanks! I'll get back to you shortly.", "Sorry, I'm in a meeting. I'll call you later."],
  personLinks: {},
  pins: [],
  appLock: { enabled: false, pinHash: undefined, afterIdleMin: 10 },
  blurOnIdle: false,
  shareShield: true,
  trackerBlocking: false,
  keepBackgroundRunning: true,
  smartHibernation: true,
  hibernateAfterMin: 0,
  usageTracking: true,
  feedGuard: { enabled: false, budgets: { facebook: 30, instagram: 20, linkedin: 30 }, nudgeAfterMin: 15 },
  sidebarLabels: false,
  language: 'en',
  updates: { channel: 'stable', autoCheck: true },
  launchAtLogin: false,
  tourDone: false,
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Maps whose keys are user data rather than fixed settings, with the type every value must have. */
const FREE_FORM = new Map<unknown, string>([
  [DEFAULT_SETTINGS.personLinks, 'string'],
  [DEFAULT_SETTINGS.feedGuard.budgets, 'number'],
]);

/**
 * Stored settings on top of the defaults: unknown keys are dropped, wrong types fall back to the
 * default, and settings added in newer versions get their default automatically.
 */
export function loadSettings(stored: unknown): Settings {
  return structuredClone(merge(DEFAULT_SETTINGS, stored)) as Settings; // never share arrays/objects with the defaults
}

function merge(defaults: unknown, stored: unknown): unknown {
  if (stored === undefined) return defaults;
  if (isObject(defaults)) {
    if (!isObject(stored)) return defaults;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(defaults)) out[k] = merge(defaults[k], stored[k]);
    const valueType = FREE_FORM.get(defaults);
    if (valueType) for (const [k, v] of Object.entries(stored)) if (typeof v === valueType) out[k] = v;
    return out;
  }
  if (Array.isArray(defaults)) return Array.isArray(stored) ? stored : defaults;
  if (defaults === undefined) return typeof stored === 'string' ? stored : undefined; // optional strings, e.g. appLock.pinHash
  return typeof stored === typeof defaults ? stored : defaults;
}
