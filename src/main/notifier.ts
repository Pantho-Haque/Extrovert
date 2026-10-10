/**
 * Notifications (FR-A05…A10, FR-X03…X06): history, native alerts with previews, VIPs, Do Not
 * Disturb, digest, snooze-to-chat and the while-you-were-away recap.
 */
import { randomUUID } from 'node:crypto';
import { ipcMain, nativeImage, Notification } from 'electron';
import { decideAlert, snoozeUntil, type SnoozeChoice } from '../core/notifications/rules';
import { instanceName } from '../core/workspaces/model';
import type { NotificationEntry } from '../shared/types';
import type { Extrovert } from './app';

const HISTORY_CAP = 1000;

export class Notifier {
  /** Electron drops click handlers of garbage-collected notifications, so keep them alive. */
  private shown = new Set<Notification>();
  private lastDigestAt = Date.now();

  constructor(private readonly app: Extrovert) {
    ipcMain.on('svc:notify', (e, payload: { id: string; title: string; body: string }) => {
      const instanceId = app.views.instanceFor(e.sender);
      if (instanceId) this.incoming(instanceId, payload);
    });
    app.every(15_000, () => this.tick());
  }

  incoming(instanceId: string, page: { id: string; title: string; body: string }): void {
    const { store } = this.app;
    const loc = store.locate(instanceId);
    if (!loc) return;
    const entry: NotificationEntry = { id: randomUUID(), workspaceId: loc.ws.id, instanceId, sender: page.title || instanceName(loc.inst), body: page.body, at: Date.now(), pageId: page.id };
    store.history = [entry, ...store.history].slice(0, HISTORY_CAP);
    loc.inst.lastSignalAt = entry.at;
    store.save('history');

    const decision = decideAlert({
      settings: store.settings,
      sender: entry.sender,
      instanceMuted: loc.inst.muted,
      instanceAlerts: loc.inst.alerts,
      outsideWorkHours: !!store.runtime.outsideHours[loc.ws.id],
      sharingScreen: !!store.runtime.sharing,
      locked: store.runtime.locked,
    });
    if (decision.action === 'digest') {
      store.digest = [...store.digest, entry];
      store.emit();
    } else if (decision.action === 'show') {
      this.native(entry, { vip: decision.vip, hidePreview: decision.hidePreview, sound: loc.inst.sound });
    }
  }

  private native(entry: NotificationEntry, opts: { vip: boolean; hidePreview: boolean; sound: boolean; prefix?: string }): void {
    if (!Notification.isSupported()) return;
    const loc = this.app.store.locate(entry.instanceId);
    if (!loc) return;
    const where = `${instanceName(loc.inst)} · ${loc.ws.name}`;
    const icon = this.app.store.statuses[entry.instanceId]?.icon;
    const n = new Notification({
      title: opts.hidePreview ? `New notification · ${where}` : `${opts.prefix ?? ''}${opts.vip ? '★ ' : ''}${entry.sender}`,
      ...(opts.hidePreview ? {} : { subtitle: where }),
      body: opts.hidePreview ? 'Preview hidden' : entry.body || where,
      silent: !opts.sound,
      ...(opts.vip && opts.sound ? { sound: 'Glass' } : {}),
      ...(icon && !opts.hidePreview ? { icon: nativeImage.createFromDataURL(icon) } : {}),
    });
    n.on('click', () => this.open(entry.id));
    n.on('close', () => this.shown.delete(n));
    this.shown.add(n);
    n.show();
  }

  /** A notification from Extrovert itself (login watchdog, reminders). */
  system(title: string, body: string, onClick: () => void): void {
    if (!Notification.isSupported()) return;
    const n = new Notification({ title, body });
    n.on('click', () => {
      this.app.showWindow();
      onClick();
    });
    n.on('close', () => this.shown.delete(n));
    this.shown.add(n);
    n.show();
  }

  /** Opens the service and lets the page handle the click, which opens that exact chat (FR-X03). */
  open(id: string): void {
    const entry = this.find(id);
    if (!entry) return;
    this.app.showWindow();
    this.app.setOverlay(false);
    this.app.selectInstance(entry.workspaceId, entry.instanceId);
    if (entry.pageId) this.app.views.webContents(entry.instanceId)?.send('svc:click', entry.pageId);
  }

  snooze(id: string, choice: SnoozeChoice): void {
    const entry = this.find(id);
    if (!entry) return;
    const until = snoozeUntil(choice, new Date());
    this.app.store.snoozed = [...this.app.store.snoozed.filter((s) => s.entry.id !== id), { entry, until }];
    this.app.store.emit();
    this.app.toast(`Snoozed. Extrovert will remind you ${new Date(until).toLocaleString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.`);
  }

  deliverDigest(): void {
    const { store } = this.app;
    const batch = store.digest;
    this.lastDigestAt = Date.now();
    if (!batch.length) return;
    store.digest = [];
    store.emit();
    const services = new Set(batch.map((e) => e.instanceId)).size;
    if (!Notification.isSupported()) return;
    const n = new Notification({
      title: `${batch.length} notification${batch.length > 1 ? 's' : ''} from ${services} service${services > 1 ? 's' : ''}`,
      body: batch.slice(0, 3).map((e) => `${e.sender}: ${e.body}`).join('\n') + (batch.length > 3 ? `\n+${batch.length - 3} more` : ''),
    });
    n.on('click', () => {
      this.app.showWindow();
      this.app.command('notifications');
    });
    n.on('close', () => this.shown.delete(n));
    this.shown.add(n);
    n.show();
  }

  /** While-you-were-away recap (FR-X06): only when something actually arrived. */
  recap(since: number): void {
    const { store } = this.app;
    if (!store.settings.awayRecap.enabled) return;
    const arrived = store.history.filter((e) => e.at >= since);
    if (!arrived.length) return;
    store.runtime.recap = { since, until: Date.now() };
    store.emit();
  }

  private tick(): void {
    const { store } = this.app;
    const now = Date.now();
    const due = store.snoozed.filter((s) => s.until <= now);
    if (due.length) {
      store.snoozed = store.snoozed.filter((s) => s.until > now);
      store.emit();
      for (const { entry } of due) {
        const loc = store.locate(entry.instanceId);
        if (loc) this.native(entry, { vip: false, hidePreview: !!store.runtime.sharing && store.settings.shareShield, sound: loc.inst.sound, prefix: 'Reminder: ' });
      }
    }
    if (store.settings.digest.enabled && now - this.lastDigestAt >= store.settings.digest.intervalMin * 60_000) this.deliverDigest();
  }

  private find(id: string): NotificationEntry | undefined {
    const { store } = this.app;
    return store.history.find((e) => e.id === id) ?? store.snoozed.find((s) => s.entry.id === id)?.entry;
  }
}
