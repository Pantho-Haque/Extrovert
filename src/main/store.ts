/** All app state: persisted (workspaces, settings, history, usage) and runtime (statuses, overlays…). */
import { join } from 'node:path';
import { app } from 'electron';
import { loadSettings } from '../core/settings/defaults';
import { migrateSessions } from '../core/workspaces/model';
import { pruneHistory } from '../core/notifications/rules';
import { dayKey, pruneUsage, weekTotals, type UsageLog } from '../core/usage/usage';
import type { AppSnapshot, Runtime } from '../shared/ipc';
import type { DownloadEntry, Instance, InstanceStatus, NotificationEntry, Settings, Workspace } from '../shared/types';
import { JsonFile } from './persist';

interface Profile {
  version: 1;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  /** App version that last ran, to show What's new once after an update. */
  lastVersion?: string;
  bounds?: { x: number; y: number; width: number; height: number };
}

/** Login folders to move into shared logins, filled while loading an older profile (see migrateSessions). */
export const sessionMoves: { from: string; to: string }[] = [];

const parseProfile = (raw: unknown): Profile => {
  const p = raw as Partial<Profile> | undefined;
  const workspaces = Array.isArray(p?.workspaces) ? p.workspaces : [];
  // Fields added in later versions get defaults here.
  for (const w of workspaces) for (const i of w.instances) i.permissions ??= {};
  for (const w of workspaces) sessionMoves.push(...migrateSessions(w));
  return {
    version: 1,
    workspaces,
    activeWorkspaceId: typeof p?.activeWorkspaceId === 'string' ? p.activeWorkspaceId : null,
    ...(typeof p?.lastVersion === 'string' ? { lastVersion: p.lastVersion } : {}),
    ...(p?.bounds ? { bounds: p.bounds } : {}),
  };
};

const emptyRuntime = (): Runtime => ({
  zen: false, locked: false, overlay: false, online: true, signingIn: false, touchId: false,
  sharing: null, call: null, outsideHours: {}, recap: null, feedGuard: null, permissionPrompt: null,
  screenPicker: null, update: null, find: null, toasts: [], banners: [], peek: null, lockImage: null, whatsNew: null,
});

export const blankStatus = (url: string): InstanceStatus => ({ state: 'loading', unread: 0, dot: false, title: '', url, media: [] });

export class Store {
  profile: Profile;
  settings: Settings;
  history: NotificationEntry[];
  usage: UsageLog;
  statuses: Record<string, InstanceStatus> = {};
  runtime: Runtime = emptyRuntime();
  snoozed: { entry: NotificationEntry; until: number }[] = [];
  digest: NotificationEntry[] = [];
  downloads: DownloadEntry[] = [];

  private files;
  private listeners = new Set<(s: AppSnapshot) => void>();
  private emitTimer: NodeJS.Timeout | undefined;

  constructor(dir = app.getPath('userData')) {
    this.files = {
      profile: new JsonFile(join(dir, 'workspaces.json'), parseProfile),
      settings: new JsonFile(join(dir, 'settings.json'), loadSettings),
      history: new JsonFile(join(dir, 'history.json'), (raw) => (Array.isArray(raw) ? (raw as NotificationEntry[]) : [])),
      usage: new JsonFile(join(dir, 'usage.json'), (raw) => (raw && typeof raw === 'object' ? (raw as UsageLog) : {})),
    };
    this.profile = this.files.profile.read();
    this.settings = this.files.settings.read();
    this.history = pruneHistory(this.files.history.read(), this.settings.historyDays, Date.now());
    this.usage = pruneUsage(this.files.usage.read(), new Date());
  }

  get workspaces(): Workspace[] {
    return this.profile.workspaces;
  }

  get activeWorkspace(): Workspace | undefined {
    return this.workspaces.find((w) => w.id === this.profile.activeWorkspaceId) ?? this.workspaces[0];
  }

  workspace(id: string): Workspace | undefined {
    return this.workspaces.find((w) => w.id === id);
  }

  /** Finds an instance anywhere; instance ids are unique across workspaces. */
  locate(instanceId: string): { ws: Workspace; inst: Instance } | undefined {
    for (const ws of this.workspaces) {
      const inst = ws.instances.find((i) => i.id === instanceId);
      if (inst) return { ws, inst };
    }
    return undefined;
  }

  status(instanceId: string): InstanceStatus | undefined {
    return this.statuses[instanceId];
  }

  patchStatus(instanceId: string, patch: Partial<InstanceStatus>): void {
    const cur = this.statuses[instanceId];
    if (!cur) return;
    this.statuses[instanceId] = { ...cur, ...patch };
    this.emit();
  }

  /** Call after changing persisted data; saves the named files and notifies the UI. */
  save(...what: ('profile' | 'settings' | 'history' | 'usage')[]): void {
    for (const w of what) this.files[w].write(this[w] as never);
    this.emit();
  }

  flush(): void {
    for (const f of Object.values(this.files)) f.flush();
  }

  subscribe(listener: (s: AppSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Coalesces bursts (title updates, loading events) into one snapshot. */
  emit(): void {
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => {
      this.emitTimer = undefined;
      const snap = this.snapshot();
      for (const l of this.listeners) l(snap);
    }, 30);
  }

  snapshot(): AppSnapshot {
    const now = new Date();
    return {
      platform: process.platform,
      version: app.getVersion(),
      googleConfigured: !!import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID,
      workspaces: this.workspaces,
      activeWorkspaceId: this.activeWorkspace?.id ?? null,
      settings: this.settings,
      statuses: this.statuses,
      notifications: this.history,
      snoozed: this.snoozed,
      digest: this.digest,
      downloads: this.downloads,
      usage: { today: this.usage[dayKey(now)] ?? {}, week: weekTotals(this.usage, now) },
      runtime: this.runtime,
    };
  }
}
