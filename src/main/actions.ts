/**
 * The only door from the UI into the app: every action is looked up by name and its payload is
 * checked before anything runs (NFR-04). Service pages can't reach this channel at all.
 */
import { clipboard, ipcMain, shell } from 'electron';
import { catalog, parseCustomUrl } from '../core/services/catalog';
import { cleanLook } from '../core/services/look';
import { siteIconFor } from './site-icons';
import type { SnoozeChoice } from '../core/notifications/rules';
import { MAX_DETAILS, MAX_TITLE, SEVERITIES, type Severity } from '../core/feedback/issue';
import type { ActionName, Actions, FloatingName } from '../shared/ipc';
import type { Instance, ServiceType, Settings, Workspace } from '../shared/types';
import type { Extrovert } from './app';
import { importSignIns, listBrowsers } from './browser-import';
import { exportConfig, importConfig, importFerdium } from './config-io';

class BadPayload extends Error {}
const str = (v: unknown, max = 2000): string => {
  if (typeof v !== 'string' || v.length > max) throw new BadPayload('Expected a string');
  return v;
};
const bool = (v: unknown): boolean => {
  if (typeof v !== 'boolean') throw new BadPayload('Expected a boolean');
  return v;
};
const num = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new BadPayload('Expected a number');
  return v;
};
const obj = (v: unknown): Record<string, unknown> => {
  if (typeof v !== 'object' || v === null) throw new BadPayload('Expected an object');
  return v as Record<string, unknown>;
};
const pick = <T extends object>(src: Record<string, unknown>, keys: readonly string[]): Partial<T> =>
  Object.fromEntries(Object.entries(src).filter(([k]) => keys.includes(k))) as Partial<T>;

const SERVICE_TYPES = new Set<string>(catalog.map((s) => s.id));
const INSTANCE_FIELDS = ['label', 'tag', 'url', 'enabled', 'muted', 'alerts', 'sound', 'badge', 'autoplay'] as const;
const WORKSPACE_FIELDS = ['name', 'color', 'suspended', 'proxy', 'workHours'] as const;
const SNOOZES = new Set(['15m', '1h', 'tonight', 'tomorrow']);
const FLOATING = new Set(['toasts', 'find', 'peek']);

type Handler = (app: Extrovert, p: Record<string, unknown>) => unknown;

const handlers: { [K in ActionName]: Handler } = {
  selectWorkspace: (a, p) => a.selectWorkspace(str(p.workspaceId)),
  selectInstance: (a, p) => a.selectInstance(str(p.workspaceId), str(p.instanceId)),
  signIn: (a) => a.signIn(),
  cancelSignIn: (a) => a.cancelSignIn(),
  signOut: (a, p) => a.signOut(str(p.workspaceId)),
  signOutAll: async (a) => {
    for (const w of [...a.store.workspaces]) await a.signOut(w.id);
  },
  updateWorkspace: (a, p) => a.updateWorkspace(str(p.workspaceId), pick<Workspace>(obj(p.patch), WORKSPACE_FIELDS)),
  addInstances: (a, p) => {
    const items = (Array.isArray(p.items) ? p.items : []).slice(0, 30).map((raw) => {
      const it = obj(raw);
      const type = str(it.type) as ServiceType;
      if (!SERVICE_TYPES.has(type)) throw new BadPayload('Unknown service');
      if (type === 'custom') {
        const parsed = parseCustomUrl(str(it.url ?? ''));
        if (!parsed) throw new BadPayload('That address is not a website');
        return { type, url: parsed.url, label: typeof it.label === 'string' && it.label.trim() ? it.label.trim() : parsed.name, ...cleanLook(it) };
      }
      return { type, ...(typeof it.label === 'string' && it.label.trim() ? { label: it.label.trim() } : {}) };
    });
    return a.addInstances(str(p.workspaceId), items);
  },
  updateInstance: (a, p) => {
    const patch: Partial<Instance> = { ...pick<Instance>(obj(p.patch), INSTANCE_FIELDS), ...cleanLook(obj(p.patch)) };
    const perms = obj(p.patch).permissions;
    if (perms !== undefined) {
      // Each device permission is allowed (true), blocked (false) or not decided yet (absent).
      const clean: Instance['permissions'] = {};
      for (const k of ['camera', 'microphone', 'location'] as const) {
        const v = obj(perms)[k];
        if (typeof v === 'boolean') clean[k] = v;
      }
      patch.permissions = clean;
    }
    a.updateInstance(str(p.instanceId), patch);
  },
  removeInstance: (a, p) => a.removeInstance(str(p.workspaceId), str(p.instanceId)),
  instanceMenu: (a, p) => a.instanceMenu(str(p.workspaceId), str(p.instanceId)),
  reload: (a, p) => a.reload(typeof p.instanceId === 'string' ? p.instanceId : undefined),
  sleep: (a, p) => a.sleep(str(p.instanceId)),
  wake: (a, p) => {
    const loc = a.store.locate(str(p.instanceId));
    if (loc) a.wake(loc.ws, loc.inst);
  },
  signInAgain: (a, p) => a.signInAgain(str(p.instanceId)),
  zoom: (a, p) => a.setZoom(str(p.instanceId), num(p.delta)),
  updateSettings: (a, p) => a.updateSettings(obj(p.patch) as Partial<Settings>), // validated by loadSettings
  setOverlay: (a, p) => a.setOverlay(bool(p.open)),
  nextUnread: (a) => a.goNextUnread(),
  openNotification: (a, p) => a.notifier.open(str(p.id)),
  snooze: (a, p) => {
    const choice = str(p.choice);
    if (!SNOOZES.has(choice)) throw new BadPayload('Unknown snooze');
    a.notifier.snooze(str(p.id), choice as SnoozeChoice);
  },
  toggleVip: (a, p) => {
    const name = str(p.name, 200).trim();
    const vips = a.store.settings.vips;
    const has = vips.some((v) => v.toLowerCase() === name.toLowerCase());
    a.updateSettings({ vips: has ? vips.filter((v) => v.toLowerCase() !== name.toLowerCase()) : [...vips, name] });
    a.toast(has ? `${name} is no longer a VIP.` : `${name} is now a VIP: their messages get through Do Not Disturb and digests on every platform.`);
  },
  linkNames: (a, p) => a.updateSettings({ personLinks: { ...a.store.settings.personLinks, [str(p.name, 200)]: str(p.to, 200) } }),
  deliverDigest: (a) => a.notifier.deliverDigest(),
  clearHistory: (a) => {
    a.store.history = [];
    a.store.save('history');
  },
  dismissRecap: (a) => {
    a.store.runtime.recap = null;
    a.store.emit();
  },
  openLink: (a, p) => a.openIn(str(p.workspaceId), str(p.instanceId), httpUrl(p.url)),
  openExternal: (_a, p) => shell.openExternal(httpUrl(p.url)),
  pinPage: (a, p) => a.pinPage(str(p.workspaceId), str(p.instanceId)),
  openPin: (a, p) => a.openPin(str(p.id)),
  removePin: (a, p) => a.updateSettings({ pins: a.store.settings.pins.filter((x) => x.id !== str(p.id)) }),
  insertReply: (a, p) => a.insertReply(str(p.text, 5000)),
  find: (a, p) => a.find(str(p.text, 500), p.forward !== false, p.next === true),
  stopFind: (a) => a.stopFind(),
  peek: (a, p) => a.peek(str(p.workspaceId), str(p.instanceId), num(p.x), num(p.y)),
  hidePeek: (a) => {
    a.store.runtime.peek = null;
    a.store.emit();
  },
  toggleZen: (a) => a.toggleZen(),
  lock: (a) => a.lock(),
  unlock: (a, p) => a.unlock({ ...(typeof p.pin === 'string' ? { pin: p.pin.slice(0, 32) } : {}), ...(p.touchId === true ? { touchId: true } : {}) }),
  setPin: (a, p) => a.setPin(p.pin === null ? null : str(p.pin, 32)),
  returnToCall: (a) => {
    const call = a.store.runtime.call;
    if (call) a.selectInstance(call.workspaceId, call.instanceId);
  },
  stopSharing: (a) => a.media.stopSharing(),
  pickScreen: (a, p) => a.media.pickScreen(p.sourceId === null ? null : str(p.sourceId, 300)),
  answerPermission: (a, p) => a.media.answerPermission(str(p.id), bool(p.allow)),
  feedGuard: (a, p) => a.usage.answerFeedGuard(str(p.choice) === 'break' ? 'break' : 'continue'),
  metrics: (a) => a.metrics(),
  listBrowsers: () => listBrowsers(),
  importSignIns: (a, p) =>
    importSignIns(a, { workspaceId: str(p.workspaceId), browserId: str(p.browserId), profileDir: str(p.profileDir, 200), instanceIds: (Array.isArray(p.instanceIds) ? p.instanceIds : []).map((x) => str(x)) }),
  importFerdium: (a, p) => importFerdium(a, str(p.workspaceId)),
  exportConfig: (a) => exportConfig(a),
  importConfig: (a) => importConfig(a),
  openDownload: (a, p) => {
    const d = a.store.downloads.find((x) => x.id === str(p.id));
    if (!d) return;
    if (p.reveal === true) shell.showItemInFolder(d.path);
    else void shell.openPath(d.path);
  },
  clearDownloads: (a) => {
    a.store.downloads = a.store.downloads.filter((d) => d.state === 'progressing');
    a.store.emit();
  },
  checkUpdates: (a) => a.updates.check(),
  installUpdate: (a) => a.updates.install(),
  systemInfo: (a) => a.systemInfo(),
  siteIcon: async (_a, p) => {
    const parsed = parseCustomUrl(str(p.url));
    return parsed ? ((await siteIconFor(parsed.url)) ?? null) : null;
  },
  reportProblem: (a, p) => {
    const severity = str(p.severity);
    if (!SEVERITIES.some((s) => s.id === severity)) throw new BadPayload('Unknown severity');
    a.reportProblem({ title: str(p.title, MAX_TITLE), details: str(p.details, MAX_DETAILS), severity: severity as Severity, where: str(p.where, 100) });
  },
  dismissToast: (a, p) => a.dismissToast(str(p.id)),
  toast: (a, p) => a.toast(str(p.text, 300)),
  showMainWindow: (a) => {
    a.tray.hide();
    a.showWindow();
  },
  setOnline: (a, p) => a.setOnline(bool(p.online)),
  copyText: (_a, p) => clipboard.writeText(str(p.text, 20000)),
  openBrowserImport: (a) => a.command('browserImport'),
  dismissWhatsNew: (a) => {
    a.store.runtime.whatsNew = null;
    a.store.emit();
  },
  resizeFloating: (a, p) => {
    const name = str(p.name);
    if (!FLOATING.has(name)) throw new BadPayload('Unknown panel');
    a.floating.resize(name as FloatingName, Math.min(900, num(p.width)), Math.min(900, num(p.height)));
  },
};

function httpUrl(v: unknown): string {
  const url = str(v, 4000);
  if (!/^(https?:|mailto:)/i.test(url)) throw new BadPayload('Only web links can be opened');
  return url;
}

export function registerActions(app: Extrovert, trusted: (wc: Electron.WebContents) => boolean): void {
  ipcMain.handle('get-state', (e) => (trusted(e.sender) ? app.store.snapshot() : null));
  ipcMain.handle('action', async (e, name: unknown, payload: unknown) => {
    if (!trusted(e.sender)) throw new Error('Not allowed');
    if (typeof name !== 'string' || !(name in handlers)) throw new Error(`Unknown action: ${String(name)}`);
    return handlers[name as keyof Actions](app, (payload ?? {}) as Record<string, unknown>);
  });
}
