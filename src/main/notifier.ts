/**
 * Notifications (FR-A05…A10, FR-X03…X06): history, native alerts with previews, VIPs, Do Not
 * Disturb, digest, snooze-to-chat and the while-you-were-away recap.
 */
import { randomUUID } from 'node:crypto';
import { ipcMain, nativeImage, Notification, shell } from 'electron';
import { decideAlert, snoozeUntil, type SnoozeChoice } from '../core/notifications/rules';
import { domainsOf, isServiceUrl, serviceDef } from '../core/services/catalog';
import { instanceName } from '../core/workspaces/model';
import type { Banner } from '../shared/ipc';
import type { NotificationEntry } from '../shared/types';
import type { Extrovert } from './app';

const HISTORY_CAP = 1000;

export class Notifier {
  /** Electron drops click handlers of garbage-collected notifications, so keep them alive. */
  private shown = new Set<Notification>();
  private lastDigestAt = Date.now();

  constructor(private readonly app: Extrovert) {
    ipcMain.on('svc:notify', (e, payload: { id: string; title: string; body: string; handlesClick?: boolean; url?: string }) => {
      const instanceId = app.views.instanceFor(e.sender);
      if (instanceId) this.incoming(instanceId, payload);
    });
    app.every(15_000, () => this.tick());
  }

  // ---------------------------------------------------------------- announcements from titles and counts
  // One message, one notification: services sharing a login (Facebook + Messenger, the Google apps)
  // announce the same message, and a flashing title repeats it until it's read.
  private lastPage = new Map<string, number>(); // login → the page's own last notification
  private lastAny = new Map<string, number>(); // login → any notification, from any source
  private announced = new Map<string, Map<string, number>>(); // login → announcement → when
  private pending = new Map<string, { at: number; instances: Set<string>; sender: string; body: string }>();

  private loginOf(instanceId: string): string | null {
    const loc = this.app.store.locate(instanceId);
    return loc ? `${loc.ws.id}\n${loc.inst.session}` : null;
  }

  /** Not announced since that login's messages were last read, nor in the last 10 minutes. */
  private isNew(login: string, key: string, now: number): boolean {
    const at = this.announced.get(login)?.get(key);
    return at === undefined || now - at > 10 * 60_000;
  }

  /** A message the service only announced in its title (sites that notify from a service worker). */
  fromTitle(instanceId: string, sender: string, body: string): void {
    this.queue(instanceId, `msg:${sender.toLowerCase()}`, sender, body, 2500);
  }

  /** The unread count rose with no other signal: the last resort, so nothing goes unnoticed. */
  fromCount(instanceId: string, body: string): void {
    this.queue(instanceId, 'count', '', body, 4000);
  }

  private queue(instanceId: string, key: string, sender: string, body: string, wait: number): void {
    const login = this.loginOf(instanceId);
    if (!login) return;
    const now = Date.now();
    if (!this.isNew(login, key, now)) return;
    const id = `${login}\n${key}`;
    const p = this.pending.get(id);
    if (p) return void p.instances.add(instanceId); // the same message, seen by another service on this login
    this.pending.set(id, { at: now, instances: new Set([instanceId]), sender, body });
    setTimeout(() => {
      const job = this.pending.get(id);
      this.pending.delete(id);
      if (!job) return;
      // Anything else announced this login meanwhile (the page itself, or a title)? Then the count is covered.
      // The page sent its own notification meanwhile; for a bare count, anything in the last 15 s covers it.
      const covered = key === 'count' ? (this.lastAny.get(login) ?? 0) >= job.at - 15_000 : (this.lastPage.get(login) ?? 0) >= job.at;
      if (covered) return;
      if (key === 'count' && [...(this.announced.get(login)?.keys() ?? [])].some((k) => k.startsWith('msg:'))) return;
      const chosen = [...job.instances].sort((a, b) => this.chatFirst(a) - this.chatFirst(b))[0]!;
      const loc = this.app.store.locate(chosen);
      if (!loc) return;
      this.announced.set(login, (this.announced.get(login) ?? new Map()).set(key, Date.now()));
      this.incoming(chosen, { id: '', title: job.sender || instanceName(loc.inst), body: job.body, source: key === 'count' ? 'count' : 'title' });
    }, wait);
  }

  private chatFirst(instanceId: string): number {
    const type = this.app.store.locate(instanceId)?.inst.type;
    return type === 'messenger' || type === 'whatsapp' || type === 'chat' || type === 'gmail' ? 0 : 1;
  }

  /** That login's messages were read: its next message is announced again. */
  markRead(instanceId: string): void {
    const login = this.loginOf(instanceId);
    const loc = this.app.store.locate(instanceId);
    if (!login || !loc) return;
    const sharing = loc.ws.instances.filter((i) => i.session === loc.inst.session);
    if (sharing.every((i) => !this.app.store.statuses[i.id]?.unread)) this.announced.delete(login);
  }

  incoming(instanceId: string, page: { id: string; title: string; body: string; handlesClick?: boolean; url?: string; source?: 'title' | 'count' }): void {
    const { store } = this.app;
    const loc = store.locate(instanceId);
    if (!loc) return;
    const login = this.loginOf(instanceId);
    if (login) {
      this.lastAny.set(login, Date.now());
      if (page.id) this.lastPage.set(login, Date.now());
    }
    // A conversation address is only kept if it belongs to this service.
    const url = page.url && isServiceUrl({ domains: domainsOf(loc.inst.type, loc.inst.url) }, page.url) ? page.url : undefined;
    const entry: NotificationEntry = {
      id: randomUUID(), workspaceId: loc.ws.id, instanceId, sender: page.title || instanceName(loc.inst), body: page.body, at: Date.now(),
      ...(page.id ? { pageId: page.id } : {}), ...(page.handlesClick ? { pageHandlesClick: true } : {}), ...(url ? { url } : {}), ...(page.source ? { source: page.source } : {}),
    };
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

  private bannerTimers = new Map<string, NodeJS.Timeout>();

  /** Shows a notification: inside Extrovert if it's the app you're using, else from the system. */
  private native(entry: NotificationEntry, opts: { vip: boolean; hidePreview: boolean; sound: boolean; prefix?: string }): void {
    const loc = this.app.store.locate(entry.instanceId);
    if (!loc) return;
    const where = `${instanceName(loc.inst)} · ${loc.ws.name}`;
    // macOS shows no banner for the app in front, so a notification would only reach the history.
    if (this.app.win.isFocused() && !this.app.store.runtime.locked) {
      return this.banner({ id: entry.id, instanceId: entry.instanceId, sender: opts.hidePreview ? 'New notification' : entry.sender, body: opts.hidePreview ? 'Preview hidden' : entry.body, where, vip: opts.vip }, opts.sound, opts.vip ? 9000 : 6000);
    }
    if (!Notification.isSupported()) return;
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

  private banner(b: Banner, sound: boolean, ms: number): void {
    const rt = this.app.store.runtime;
    rt.banners = [...rt.banners.slice(-2), b];
    this.app.floating.layout();
    this.app.store.emit();
    if (sound) shell.beep();
    this.bannerTimers.set(b.id, setTimeout(() => this.dismissBanner(b.id), ms));
  }

  dismissBanner(id: string): void {
    clearTimeout(this.bannerTimers.get(id));
    this.bannerTimers.delete(id);
    const rt = this.app.store.runtime;
    if (!rt.banners.some((b) => b.id === id)) return;
    rt.banners = rt.banners.filter((b) => b.id !== id);
    this.app.floating.layout();
    this.app.store.emit();
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
    this.dismissBanner(id);
    if (id.startsWith('digest:')) {
      this.app.setOverlay(false);
      return this.app.command('notifications');
    }
    const entry = this.find(id);
    if (!entry) return;
    this.app.showWindow();
    this.app.setOverlay(false);
    this.app.selectInstance(entry.workspaceId, entry.instanceId);
    const wc = this.app.views.webContents(entry.instanceId);
    const loc = this.app.store.locate(entry.instanceId);
    if (!wc || !loc) return;
    // 1. The page opens the chat itself (its own click handler).
    if (entry.pageId && entry.pageHandlesClick) return void wc.send('svc:click', entry.pageId);
    // 2. The site gave the conversation's address.
    if (entry.url) return void wc.loadURL(entry.url);
    // 3. Only the title or count announced it: the messages page, newest conversation first.
    const def = serviceDef(loc.inst.type);
    const target = entry.source === 'count' && def.kind === 'feed' ? def.notificationsUrl : def.messagesUrl;
    // Always load it, even from another conversation: it opens on the newest one, the one just announced.
    if (target) void wc.loadURL(target);
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
    const title = `${batch.length} notification${batch.length > 1 ? 's' : ''} from ${services} service${services > 1 ? 's' : ''}`;
    const body = batch.slice(0, 3).map((e) => `${e.sender}: ${e.body}`).join('\n') + (batch.length > 3 ? `\n+${batch.length - 3} more` : '');
    // While you're using Extrovert, macOS shows no system banner: show the digest inside the app.
    if (this.app.win.isFocused() && !this.app.store.runtime.locked) {
      return this.banner({ id: `digest:${Date.now()}`, instanceId: '', sender: title, body, where: 'Digest', vip: false }, false, 9000);
    }
    if (!Notification.isSupported()) return;
    const n = new Notification({ title, body });
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
