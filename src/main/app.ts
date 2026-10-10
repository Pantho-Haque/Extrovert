/**
 * The app controller: owns the window, the service views and all state changes.
 * Feature areas live in their own modules (notifier, media, usage, tray, menu…) and call back here.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { app, BaseWindow, dialog, Menu, powerMonitor, screen, session, shell, systemPreferences, WebContentsView } from 'electron';
import { hashPin, verifyPin } from '../core/auth/pin';
import { chromeUserAgent } from '../core/browser/user-agent';
import { issueUrl, systemInfo, type Report } from '../core/feedback/issue';
import { addedIn } from '../core/guide/registry';
import { isLoginPage, serviceDef } from '../core/services/catalog';
import { nextUnread, totalUnread } from '../core/unread/aggregate';
import { DEFAULT_UNREAD_PATTERN, parseUnread } from '../core/unread/parse-title';
import { linkTargets } from '../core/routing/links';
import { instanceName, instanceUrl, newInstance, newWorkspace, orderedInstances, orphanPartitionFolders, outsideWorkHours, partitionFor } from '../core/workspaces/model';
import { loadSettings } from '../core/settings/defaults';
import type { InstanceMetrics, ShellCommand, Toast } from '../shared/ipc';
import type { Instance, ServiceType, Settings, Workspace } from '../shared/types';
import { CallBubble, Media } from './media';
import { Floating } from './floating';
import { buildMenu } from './menu';
import { Notifier } from './notifier';
import { blankStatus, sessionMoves, Store } from './store';
import { TrayUI } from './tray';
import { Updates } from './updates';
import { UsageTracker } from './usage-tracker';
import { ViewHost } from './views';
import { cancelSignIn, signInWithGoogle } from './google-sign-in';
import { listBrowsers, resyncSignIn } from './browser-import';

const NETWORK_ERRORS = new Set([-21, -100, -101, -102, -104, -105, -106, -109, -118, -130, -137]);
const STAGGER_MS = 1200;

export class Extrovert {
  readonly store = new Store();
  win!: BaseWindow;
  shellView!: WebContentsView;
  views!: ViewHost;
  floating!: Floating;
  notifier!: Notifier;
  media!: Media;
  usage!: UsageTracker;
  tray!: TrayUI;
  updates!: Updates;
  bubble = new CallBubble(this);

  /** When each instance was last on screen (for hibernation, FR-X18). */
  readonly lastUsed = new Map<string, number>();
  /** Logouts the user already acknowledged with "Sign in again", so we don't re-flag the login page. */
  private acknowledgedLogout = new Set<string>();
  private lastSmartSleep = 0;
  private bootQueue: string[] = [];
  private menuKey = '';

  start(): void {
    this.deleteOrphanLogins();
    app.userAgentFallback = chromeUserAgent(process.platform, process.versions.chrome);
    const bounds = this.store.profile.bounds;
    const onScreen = bounds && screen.getAllDisplays().some((d) => rectInside(bounds, d.workArea));
    this.win = new BaseWindow({
      ...(onScreen ? bounds : { width: 1360, height: 860 }),
      minWidth: 900,
      minHeight: 600,
      title: 'Extrovert',
      backgroundColor: '#F3F4F7',
      ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 12, y: 9 } } : {}),
    });

    // The shell (sidebar, pages, modals) fills the window and is transparent where services show through.
    this.shellView = new WebContentsView({ webPreferences: { preload: join(__dirname, '../preload/shell.js'), sandbox: true, contextIsolation: true } });
    this.shellView.setBackgroundColor('#00000000');
    this.win.contentView.addChildView(this.shellView);
    loadRenderer(this.shellView.webContents, '');

    this.views = new ViewHost(this.win, this.shellView, app.userAgentFallback, {
      title: (id, title) => this.onTitle(id, title),
      navigated: (id, url) => this.onNavigated(id, url),
      loading: (id, loading) => this.onLoading(id, loading),
      failed: (id, code, description) => {
        this.store.patchStatus(id, { state: NETWORK_ERRORS.has(code) ? 'offline' : 'crashed', error: `${description} (${code})` });
        this.showActive();
      },
      crashed: (id, reason) => {
        this.store.patchStatus(id, { state: 'crashed', error: `The page stopped (${reason})` });
        this.showActive();
      },
      icon: (id, icon) => {
        const loc = this.store.locate(id);
        if (!loc) return;
        // Catalog services use the outline icon pack; only custom websites show their own site icon.
        if (loc.inst.type === 'custom') this.store.patchStatus(id, { icon });
      },
      playing: (id, playing) => this.usage.setPlaying(id, playing),
      openLink: (id, url) => this.routeLink(id, url),
      found: (matches, active) => {
        this.store.runtime.find = { matches, active };
        this.store.emit();
      },
      configureSession: (ses, ws, inst) => {
        this.media.configureSession(ses, ws, inst);
        this.watchSignIn(ses, ws, inst.session);
      },
    });
    this.floating = new Floating(this);
    this.notifier = new Notifier(this);
    this.media = new Media(this);
    this.usage = new UsageTracker(this);
    this.tray = new TrayUI(this);
    this.updates = new Updates(this);

    this.store.subscribe((snap) => {
      for (const wc of [this.shellView.webContents, ...this.floating.webContents(), ...this.tray.webContents()]) {
        if (!wc.isDestroyed()) wc.send('state', snap);
      }
      const total = totalUnread(snap.workspaces, snap.statuses);
      app.setBadgeCount(total);
      this.tray.setUnread(total);
      this.floating.layout();
      this.refreshMenu();
    });

    this.win.on('resize', () => this.saveBounds());
    this.win.on('move', () => this.saveBounds());
    this.win.on('focus', () => this.store.runtime.locked || this.focusActive());
    this.win.on('close', () => this.store.flush());
    // Quitting closes the window first; nothing may tick against it after that.
    this.win.on('closed', () => this.timers.forEach(clearInterval));
    powerMonitor.on('resume', () => setTimeout(() => this.recover('Back from sleep'), 4000));
    this.every(60_000, () => this.minuteTick());

    this.store.runtime.touchId = process.platform === 'darwin' && systemPreferences.canPromptTouchID();
    if (this.store.settings.appLock.enabled && this.store.settings.appLock.pinHash) this.lock();
    this.checkWhatsNew();
    this.boot();
    this.minuteTick();
    this.refreshMenu();
  }

  // ---------------------------------------------------------------- startup
  /**
   * Logins live and die with their workspace: delete login storage left by signed-out workspaces,
   * removed services or older versions. Runs before any service session is opened.
   */
  private deleteOrphanLogins(): void {
    const dir = join(app.getPath('userData'), 'Partitions');
    if (!existsSync(dir)) return;
    // Older profiles: move each service's own login into the workspace's shared login (Google, Meta).
    for (const m of sessionMoves) {
      if (existsSync(join(dir, m.from)) && !existsSync(join(dir, m.to))) renameSync(join(dir, m.from), join(dir, m.to));
    }
    if (sessionMoves.length) this.store.save('profile');
    for (const name of orphanPartitionFolders(readdirSync(dir), this.store.workspaces)) rmSync(join(dir, name), { recursive: true, force: true });
  }
  /** Staggered startup (FR-X16): the visible service first, then messaging, then everything else. */
  private boot(): void {
    const active = this.store.activeWorkspace;
    const rank = (t: ServiceType) => ({ chat: 0, call: 1, mail: 2, tool: 3, custom: 4, feed: 5 })[serviceDef(t).kind];
    const order: string[] = [];
    for (const ws of [...this.store.workspaces].sort((a, b) => Number(b.id === active?.id) - Number(a.id === active?.id))) {
      for (const inst of ws.instances) {
        if (!inst.enabled) continue;
        this.store.statuses[inst.id] = { ...blankStatus(instanceUrl(inst)), state: ws.suspended ? 'sleeping' : 'loading' };
      }
      if (ws.suspended || (ws.id !== active?.id && !this.store.settings.keepBackgroundRunning)) continue;
      order.push(...[...ws.instances].filter((i) => i.enabled).sort((a, b) => rank(a.type) - rank(b.type)).map((i) => i.id));
    }
    const first = active && !active.suspended ? this.activeInstance(active) : undefined;
    this.bootQueue = first ? [first.id, ...order.filter((id) => id !== first.id)] : order;
    // Background workspaces that aren't kept running start asleep and load when opened.
    for (const [id, st] of Object.entries(this.store.statuses)) if (st.state === 'loading' && !this.bootQueue.includes(id)) st.state = 'sleeping';
    this.showActive();
    this.drainBootQueue();
  }

  private drainBootQueue(): void {
    const id = this.bootQueue.shift();
    if (!id) return;
    const loc = this.store.locate(id);
    if (loc && !loc.ws.suspended) this.views.ensure(loc.ws, loc.inst);
    this.showActive();
    if (this.bootQueue.length) setTimeout(() => this.drainBootQueue(), STAGGER_MS);
  }

  // ---------------------------------------------------------------- selection
  activeInstance(ws = this.store.activeWorkspace): Instance | undefined {
    if (!ws) return undefined;
    const list = orderedInstances(ws.instances);
    return list.find((i) => i.id === ws.activeInstanceId) ?? list[0];
  }

  selectWorkspace(workspaceId: string): void {
    const ws = this.store.workspace(workspaceId);
    if (!ws) return;
    this.store.profile.activeWorkspaceId = ws.id;
    if (ws.suspended) {
      // A paused workspace shows its "Resume" card instead of loading (FR-W10).
      this.store.save('profile');
      return this.showActive();
    }
    for (const inst of ws.instances.filter((i) => i.enabled)) {
      const st = this.store.statuses[inst.id] ?? blankStatus(instanceUrl(inst));
      this.store.statuses[inst.id] = st.state === 'sleeping' && !this.views.has(inst.id) ? { ...st, state: 'loading' } : st;
    }
    const active = this.activeInstance(ws);
    if (active) this.selectInstance(ws.id, active.id);
    // The rest of a newly opened workspace loads in the background.
    for (const inst of ws.instances) if (inst.enabled && !this.views.has(inst.id)) this.bootQueue.push(inst.id);
    if (this.bootQueue.length) setTimeout(() => this.drainBootQueue(), STAGGER_MS);
    this.store.save('profile');
  }

  selectInstance(workspaceId: string, instanceId: string): void {
    const ws = this.store.workspace(workspaceId);
    const inst = ws?.instances.find((i) => i.id === instanceId);
    if (!ws || !inst) return;
    this.store.profile.activeWorkspaceId = ws.id;
    ws.activeInstanceId = inst.id;
    if (!this.views.has(inst.id) && inst.enabled) this.wake(ws, inst);
    this.lastUsed.set(inst.id, Date.now());
    this.media.onSwitch(inst.id);
    this.usage.onSwitch();
    this.showActive();
    this.offerBrowserLogin();
    this.store.save('profile');
  }

  /** Shows the active service's page, or nothing when the shell must draw a state card over it. */
  private timers: NodeJS.Timeout[] = [];
  /** A repeating timer that stops when the window closes (on quit). Use it for anything that touches the window or views. */
  every(ms: number, fn: () => void): void {
    this.timers.push(setInterval(fn, ms));
  }

  showActive(): void {
    const ws = this.store.activeWorkspace;
    const inst = this.activeInstance(ws);
    const st = inst && this.store.statuses[inst.id];
    const pageVisible = !!ws && !ws.suspended && !!st && (st.state === 'live' || st.state === 'loading') && !(this.store.runtime.call?.inBubble && this.store.runtime.call.instanceId === inst?.id);
    this.views.show(pageVisible ? inst!.id : null);
    this.store.emit();
  }

  private focusActive(): void {
    const inst = this.activeInstance();
    if (inst && !this.store.runtime.overlay && this.win.isFocused()) this.views.webContents(inst.id)?.focus();
  }

  goNextUnread(): void {
    const ws = this.store.activeWorkspace;
    if (!ws) return;
    const next = nextUnread(this.store.workspaces, this.store.statuses, { workspaceId: ws.id, instanceId: this.activeInstance(ws)?.id ?? '' });
    if (!next) return void this.toast('Inbox zero everywhere 🎉');
    this.selectInstance(next.workspaceId, next.instanceId);
  }

  // ---------------------------------------------------------------- page events
  private onTitle(id: string, title: string): void {
    const loc = this.store.locate(id);
    if (!loc) return;
    const pattern = loc.inst.type === 'custom' ? DEFAULT_UNREAD_PATTERN : serviceDef(loc.inst.type).unreadPattern;
    const unread = parseUnread(title, pattern);
    if (unread > 0) loc.inst.lastSignalAt = Date.now();
    this.store.patchStatus(id, { title, unread });
  }

  private onNavigated(id: string, url: string): void {
    const loc = this.store.locate(id);
    const st = this.store.statuses[id];
    if (!loc || !st) return;
    // Services with a login cookie are tracked by watchSignIn(); the URL is the fallback for the rest.
    if (serviceDef(loc.inst.type).sessionCookie) return this.store.patchStatus(id, { url });
    const onLogin = isLoginPage(loc.inst.type, url);
    if (!onLogin) this.acknowledgedLogout.delete(id);
    // Login watchdog (FR-X02): only a service that was signed in before is "signed out".
    if (onLogin && loc.inst.signedInOnce && !this.acknowledgedLogout.has(id) && st.state !== 'signedout') {
      this.store.patchStatus(id, { url, state: 'signedout' });
      this.notifier.system(`${instanceName(loc.inst)} signed you out`, `${loc.ws.name}: sign in again to keep getting notifications.`, () => this.selectInstance(loc.ws.id, id));
      this.showActive();
      return;
    }
    this.store.patchStatus(id, { url });
  }

  private onLoading(id: string, loading: boolean): void {
    const loc = this.store.locate(id);
    const st = this.store.statuses[id];
    if (!loc || !st) return;
    if (loading) {
      if (st.state === 'offline' || st.state === 'crashed') this.store.patchStatus(id, { state: 'loading', error: undefined });
      return;
    }
    const url = this.views.webContents(id)?.getURL() ?? st.url;
    if (st.state === 'loading') this.store.patchStatus(id, { state: 'live', url });
    if (serviceDef(loc.inst.type).sessionCookie) void this.checkSignedIn(id);
    else if (!isLoginPage(loc.inst.type, url) && url.startsWith('http') && !loc.inst.signedInOnce) {
      loc.inst.signedInOnce = true;
      this.store.save('profile');
    }
    this.showActive();
  }

  // ---------------------------------------------------------------- signed in or not (login cookies)
  private signInChecks = new Map<string, NodeJS.Timeout>();
  private offeredBrowserLogin = new Set<string>();
  private browserLoginToast: { instanceId: string; toastId: string } | null = null;

  /**
   * The platform's login cookie appearing or disappearing is the moment the user signs in or out.
   * A shared login (all Google apps) updates every service that uses it.
   */
  private watchSignIn(ses: Electron.Session, ws: Workspace, sessionKey: string): void {
    ses.cookies.on('changed', (_e, cookie, cause) => {
      if (cause === 'overwrite') return;
      const sharing = (this.store.workspace(ws.id)?.instances ?? []).filter((i) => i.session === sessionKey);
      for (const inst of sharing) {
        if (!serviceDef(inst.type).sessionCookie?.names.includes(cookie.name)) continue;
        clearTimeout(this.signInChecks.get(inst.id));
        this.signInChecks.set(inst.id, setTimeout(() => void this.checkSignedIn(inst.id), 800));
      }
    });
  }

  async checkSignedIn(instanceId: string, settled = false): Promise<void> {
    const loc = this.store.locate(instanceId);
    const cookie = loc && serviceDef(loc.inst.type).sessionCookie;
    const st = this.store.statuses[instanceId];
    if (!loc || !cookie || !st || st.state === 'syncing') return;
    const found = await session.fromPartition(partitionFor(loc.ws.id, loc.inst.session)).cookies.get({ url: cookie.url });
    const hasCookie = found.some((c) => cookie.names.includes(c.name) && !!c.value);
    // The cookie can outlive the login: Google may reject it and show its account chooser instead.
    // Login pages also flash by during normal redirects, so only one that stays counts.
    const onLogin = isLoginPage(loc.inst.type, this.views.webContents(instanceId)?.getURL() ?? '');
    if (hasCookie && onLogin && !settled) {
      clearTimeout(this.signInChecks.get(instanceId));
      this.signInChecks.set(instanceId, setTimeout(() => void this.checkSignedIn(instanceId, true), 4000));
      return;
    }
    const signedIn = hasCookie && !onLogin;
    if (signedIn) {
      this.acknowledgedLogout.delete(instanceId);
      if (!loc.inst.signedInOnce) {
        loc.inst.signedInOnce = true;
        this.store.save('profile');
      }
      if (this.browserLoginToast?.instanceId === instanceId) this.dismissToast(this.browserLoginToast.toastId);
      this.store.patchStatus(instanceId, { signedIn, ...(st.state === 'signedout' ? { state: 'live' as const } : {}) });
    } else if (loc.inst.signedInOnce && !this.acknowledgedLogout.has(instanceId) && st.state !== 'signedout') {
      // Came from the user's browser? Copy it again from there instead of showing a login page.
      if (await this.resyncLogin(loc.ws, loc.inst.session)) return;
      // Login watchdog (FR-X02): it was signed in, and the login is gone.
      this.store.patchStatus(instanceId, { signedIn, state: 'signedout' });
      this.notifier.system(`${instanceName(loc.inst)} signed you out`, `${loc.ws.name}: sign in again to keep getting notifications.`, () => this.selectInstance(loc.ws.id, instanceId));
    } else {
      this.store.patchStatus(instanceId, { signedIn });
    }
    this.offerBrowserLogin();
    this.showActive();
  }

  private resyncedAt = new Map<string, number>();

  /**
   * A login copied from the user's browser expired (sites rotate their login cookies, so a copy goes
   * stale). Copy it again from that browser, hiding the login page meanwhile. At most every 10 minutes
   * per login, so a browser that is signed out too can't cause a loop.
   */
  private async resyncLogin(ws: Workspace, sessionKey: string): Promise<boolean> {
    const source = ws.loginSources?.[sessionKey];
    const key = `${ws.id}:${sessionKey}`;
    if (!source || Date.now() - (this.resyncedAt.get(key) ?? 0) < 600_000) return false;
    this.resyncedAt.set(key, Date.now());
    const open = ws.instances.filter((i) => i.session === sessionKey && this.views.has(i.id));
    const before = new Map(open.map((i) => [i.id, this.store.statuses[i.id]?.state ?? 'live']));
    for (const inst of open) this.store.patchStatus(inst.id, { state: 'syncing' });
    this.showActive();
    const ok = await resyncSignIn(this, ws, source, open.map((i) => i.id)).catch((e) => {
      console.warn('[extrovert] re-sync failed', e);
      return false;
    });
    if (!ok) for (const inst of open) if (this.store.statuses[inst.id]?.state === 'syncing') this.store.patchStatus(inst.id, { state: before.get(inst.id)! });
    this.showActive();
    return ok;
  }

  /** On the login page of a service? Offer the login the user already has in their browser (macOS). */
  private offerBrowserLogin(): void {
    const inst = this.activeInstance();
    const current = this.browserLoginToast;
    if (current && current.instanceId !== inst?.id) {
      this.dismissToast(current.toastId);
      this.browserLoginToast = null;
    }
    if (process.platform !== 'darwin' || !inst || this.store.runtime.overlay) return;
    const st = this.store.statuses[inst.id];
    if (st?.signedIn !== false || st.state !== 'live' || this.offeredBrowserLogin.has(inst.id)) return;
    const browser = this.defaultBrowser();
    if (!browser) return;
    this.offeredBrowserLogin.add(inst.id);
    const toastId = this.toast(`Not signed in to ${instanceName(inst)} here yet. Already signed in to it in ${browser}?`, {
      persistent: true,
      actions: [{ label: `Sign in with ${browser}`, action: 'openBrowserImport' }],
    });
    this.browserLoginToast = { instanceId: inst.id, toastId };
  }

  private browserName: string | null | undefined;
  private defaultBrowser(): string | null {
    if (this.browserName === undefined) {
      const list = listBrowsers();
      this.browserName = (list.find((b) => b.isDefault) ?? list[0])?.name ?? null;
    }
    return this.browserName;
  }

  /** Links that leave a service: open in the matching service if we have one, else the system browser (FR-X21). */
  routeLink(fromInstanceId: string, url: string): void {
    const from = this.store.locate(fromInstanceId);
    const target = linkTargets(url, this.store.workspaces, from?.ws.id ?? '').find((t) => t.instanceId !== fromInstanceId);
    if (target) return this.openIn(target.workspaceId, target.instanceId, url);
    if (/^(https?|mailto):/i.test(url)) void shell.openExternal(url);
  }

  openIn(workspaceId: string, instanceId: string, url: string): void {
    this.selectInstance(workspaceId, instanceId);
    const loc = this.store.locate(instanceId);
    void this.views.webContents(instanceId)?.loadURL(url);
    if (loc) this.toast(`Opened in ${instanceName(loc.inst)} · ${loc.ws.name}`);
  }

  // ---------------------------------------------------------------- instances
  addInstances(workspaceId: string, items: { type: ServiceType; url?: string; label?: string; icon?: string | undefined; color?: string | undefined }[]): string[] {
    const ws = this.store.workspace(workspaceId);
    if (!ws) return [];
    const ids: string[] = [];
    for (const item of items) {
      const inst = newInstance(item.type, ws.instances, `i-${randomUUID().slice(0, 8)}`, { ...(item.label ? { label: item.label } : {}), ...(item.url ? { url: item.url } : {}), ...(item.icon ? { icon: item.icon } : {}), ...(item.color ? { color: item.color } : {}) });
      ws.instances.push(inst);
      this.store.statuses[inst.id] = blankStatus(instanceUrl(inst));
      if (!ws.suspended) this.views.ensure(ws, inst);
      ids.push(inst.id);
    }
    if (ids[0] && ws.id === this.store.activeWorkspace?.id) this.selectInstance(ws.id, ids[0]);
    this.store.save('profile');
    return ids;
  }

  removeInstance(workspaceId: string, instanceId: string): void {
    const ws = this.store.workspace(workspaceId);
    if (!ws) return;
    const removed = ws.instances.find((i) => i.id === instanceId);
    this.views.destroy(instanceId);
    ws.instances = ws.instances.filter((i) => i.id !== instanceId);
    // Delete its login unless another service still shares it (e.g. Calendar after removing Gmail).
    if (removed && !ws.instances.some((i) => i.session === removed.session)) void this.wipeSession(ws.id, removed.session);
    delete this.store.statuses[instanceId];
    this.store.settings.pins = this.store.settings.pins.filter((p) => p.instanceId !== instanceId);
    this.showActive();
    this.store.save('profile', 'settings');
  }

  updateInstance(instanceId: string, patch: Partial<Instance>): void {
    const loc = this.store.locate(instanceId);
    if (!loc) return;
    const before = { ...loc.inst };
    Object.assign(loc.inst, patch);
    if (patch.enabled === false) this.sleep(instanceId, false);
    if (patch.enabled === true && !before.enabled) this.wake(loc.ws, loc.inst);
    // Changing the address or autoplay needs a fresh page.
    if ((patch.url !== undefined && patch.url !== before.url) || (patch.autoplay !== undefined && patch.autoplay !== before.autoplay)) {
      this.views.destroy(instanceId);
      this.wake(loc.ws, loc.inst);
    }
    this.showActive();
    this.store.save('profile');
  }

  sleep(instanceId: string, announce = true): void {
    if (!this.views.has(instanceId)) return;
    if (this.store.runtime.call?.instanceId === instanceId) return; // never sleep a call
    this.views.destroy(instanceId);
    this.store.patchStatus(instanceId, { state: 'sleeping', media: [] });
    if (announce) {
      const loc = this.store.locate(instanceId);
      if (loc) this.toast(`${instanceName(loc.inst)} is sleeping to save memory. Click it to wake it up.`);
    }
    this.showActive();
  }

  wake(ws: Workspace, inst: Instance): void {
    this.store.statuses[inst.id] = { ...(this.store.statuses[inst.id] ?? blankStatus(instanceUrl(inst))), state: 'loading', error: undefined };
    this.views.ensure(ws, inst);
    this.showActive();
  }

  reload(instanceId?: string): void {
    const id = instanceId ?? this.activeInstance()?.id;
    if (!id) return;
    const loc = this.store.locate(id);
    if (!loc) return;
    if (!this.views.has(id)) return this.wake(loc.ws, loc.inst);
    this.store.patchStatus(id, { state: 'loading', error: undefined });
    this.views.webContents(id)?.reload();
    this.showActive();
  }

  signInAgain(instanceId: string): void {
    const loc = this.store.locate(instanceId);
    if (!loc) return;
    this.acknowledgedLogout.add(instanceId);
    this.store.patchStatus(instanceId, { state: 'live' });
    this.showActive();
  }

  setZoom(instanceId: string, delta: number): void {
    const loc = this.store.locate(instanceId);
    if (!loc) return;
    loc.inst.zoom = delta === 0 ? 100 : Math.min(200, Math.max(50, loc.inst.zoom + delta));
    this.views.webContents(instanceId)?.setZoomFactor(loc.inst.zoom / 100);
    this.store.save('profile');
  }

  async wipeSession(workspaceId: string, sessionKey: string): Promise<void> {
    // A login the user removed must never come back by itself from their browser.
    const ws = this.store.workspace(workspaceId);
    if (ws?.loginSources) delete ws.loginSources[sessionKey];
    const ses = session.fromPartition(partitionFor(workspaceId, sessionKey));
    await ses.clearStorageData();
    await ses.clearCache();
  }

  // ---------------------------------------------------------------- workspaces & accounts
  async signIn(): Promise<{ ok: boolean; error?: string }> {
    this.store.runtime.signingIn = true;
    this.store.emit();
    try {
      this.adoptAccount(await signInWithGoogle());
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    } finally {
      this.store.runtime.signingIn = false;
      this.store.emit();
      this.win.focus();
    }
  }

  /** A Google account just signed in: switch to it if it's already here, otherwise create its workspace. */
  adoptAccount(profile: { sub: string; name: string; email: string; picture?: string }): void {
      const existing = this.store.workspaces.find((w) => w.googleSub === profile.sub);
      if (existing) {
        this.selectWorkspace(existing.id);
        this.toast(`${profile.email} is already signed in.`);
        return;
      }
      const ws = newWorkspace(profile, this.store.workspaces, `w-${randomUUID().slice(0, 8)}`);
      this.store.workspaces.push(ws);
      this.store.profile.activeWorkspaceId = ws.id;
      this.store.save('profile');
      this.showActive();
      if (this.store.workspaces.length > 1) this.toast(`Workspace “${ws.name}” created from ${ws.email}.`);
  }

  cancelSignIn(): void {
    cancelSignIn();
  }

  /**
   * Sign out of a Google account. Logins belong to their workspace, so every service's login and data
   * in it is deleted too. Signing in again starts that workspace fresh.
   */
  async signOut(workspaceId: string): Promise<void> {
    const ws = this.store.workspace(workspaceId);
    if (!ws) return;
    if (this.store.runtime.call?.workspaceId === workspaceId) this.bubble.close();
    for (const inst of ws.instances) {
      this.views.destroy(inst.id);
      delete this.store.statuses[inst.id];
    }
    for (const key of new Set(ws.instances.map((i) => i.session))) await this.wipeSession(ws.id, key);
    this.store.profile.workspaces = this.store.workspaces.filter((w) => w.id !== workspaceId);
    this.store.settings.pins = this.store.settings.pins.filter((p) => p.workspaceId !== workspaceId);
    if (this.store.profile.activeWorkspaceId === workspaceId) this.store.profile.activeWorkspaceId = this.store.workspaces[0]?.id ?? null;
    const next = this.store.activeWorkspace;
    if (next) this.selectWorkspace(next.id);
    this.store.save('profile', 'settings');
    this.showActive();
  }

  updateWorkspace(workspaceId: string, patch: Partial<Workspace>): void {
    const ws = this.store.workspace(workspaceId);
    if (!ws) return;
    const proxyChanged = patch.proxy !== undefined && patch.proxy !== ws.proxy;
    Object.assign(ws, patch);
    if (patch.suspended === true) for (const inst of ws.instances) this.sleep(inst.id, false);
    if (patch.suspended === false && ws.id === this.store.activeWorkspace?.id) this.selectWorkspace(ws.id);
    if (proxyChanged) for (const inst of ws.instances) void this.media.applyProxy(ws, inst);
    this.minuteTick();
    this.store.save('profile');
    this.showActive();
  }

  updateSettings(patch: Partial<Settings>): void {
    const before = this.store.settings;
    this.store.settings = loadSettings({ ...before, ...patch });
    const s = this.store.settings;
    if (patch.launchAtLogin !== undefined && process.platform !== 'linux') app.setLoginItemSettings({ openAtLogin: s.launchAtLogin });
    if (patch.digest && !s.digest.enabled) this.notifier.deliverDigest();
    if (patch.updates) this.updates.configure();
    this.store.save('settings');
  }

  // ---------------------------------------------------------------- shell overlay, zen, lock, peek, find
  setOverlay(open: boolean): void {
    if (this.store.runtime.overlay === open) return;
    this.store.runtime.overlay = open;
    this.views.setOverlay(open);
    if (!open) this.focusActive();
    this.store.emit();
  }

  toggleZen(): void {
    this.store.runtime.zen = !this.store.runtime.zen;
    this.views.setZen(this.store.runtime.zen);
    this.store.emit();
  }

  command(cmd: ShellCommand): void {
    if (this.store.runtime.locked) return;
    if (cmd === 'find') return this.floating.openFind();
    this.win.focus();
    this.shellView.webContents.send('command', cmd);
  }

  async lock(): Promise<void> {
    const inst = this.activeInstance();
    const wc = inst && this.views.webContents(inst.id);
    try {
      this.store.runtime.lockImage = wc ? (await wc.capturePage()).resize({ width: 480 }).toDataURL() : null;
    } catch {
      this.store.runtime.lockImage = null;
    }
    this.store.runtime.locked = true;
    this.setOverlay(true);
    this.store.emit();
  }

  async unlock(input: { pin?: string; touchId?: boolean }): Promise<{ ok: boolean }> {
    const hash = this.store.settings.appLock.pinHash;
    let ok = !hash;
    if (input.touchId && this.store.runtime.touchId) {
      ok = await systemPreferences.promptTouchID('unlock Extrovert').then(() => true, () => false);
    } else if (hash && input.pin) {
      ok = verifyPin(input.pin, hash);
    }
    if (ok) {
      this.store.runtime.locked = false;
      this.store.runtime.lockImage = null;
      this.store.emit();
    }
    return { ok };
  }

  setPin(pin: string | null): void {
    this.updateSettings({ appLock: { ...this.store.settings.appLock, enabled: !!pin, pinHash: pin ? hashPin(pin) : undefined } });
  }

  async peek(workspaceId: string, instanceId: string, x: number, y: number): Promise<void> {
    const image = await this.views.snapshot(instanceId);
    if (!image) return;
    this.store.runtime.peek = { workspaceId, instanceId, image };
    this.floating.showPeek(x, y);
    this.store.emit();
  }

  // ---------------------------------------------------------------- right-click menu, pins, replies, find
  /** Native context menu for a service icon (FR-S09-style actions, pins, zoom, logout). */
  instanceMenu(workspaceId: string, instanceId: string): void {
    const loc = this.store.locate(instanceId);
    if (!loc) return;
    const { ws, inst } = loc;
    const awake = this.views.has(inst.id);
    const pins = this.store.settings.pins.filter((p) => p.instanceId === inst.id);
    Menu.buildFromTemplate([
      { label: `${instanceName(inst)} · ${ws.name}`, enabled: false },
      ...(pins.length ? [{ type: 'separator' as const }, ...pins.map((p) => ({ label: `📌 ${p.title}`, click: () => this.openPin(p.id) }))] : []),
      { type: 'separator' },
      { label: 'Reload', click: () => this.reload(inst.id) },
      awake ? { label: 'Sleep now', click: () => this.sleep(inst.id) } : { label: 'Wake up', click: () => this.wake(ws, inst) },
      { label: inst.muted ? 'Unmute notifications' : 'Mute notifications', click: () => this.updateInstance(inst.id, { muted: !inst.muted }) },
      { label: 'Pin current page', enabled: awake, click: () => this.pinPage(workspaceId, inst.id) },
      { type: 'separator' },
      { label: `Zoom in (${inst.zoom}%)`, click: () => this.setZoom(inst.id, 10) },
      { label: 'Zoom out', click: () => this.setZoom(inst.id, -10) },
      { label: 'Actual size', click: () => this.setZoom(inst.id, 0) },
      { type: 'separator' },
      { label: 'Service settings…', click: () => this.command('settings') },
      { label: 'Log out & clear data', click: () => void this.logOutInstance(inst.id) },
      { label: 'Remove from sidebar…', click: () => void this.confirmRemove(workspaceId, inst.id) },
    ]).popup({ window: this.win });
  }

  private async logOutInstance(instanceId: string): Promise<void> {
    const loc = this.store.locate(instanceId);
    if (!loc) return;
    await this.wipeSession(loc.ws.id, loc.inst.session);
    // A shared login (all Google apps, or Facebook + Messenger) logs all of them out together.
    const sharing = loc.ws.instances.filter((i) => i.session === loc.inst.session);
    for (const inst of sharing) {
      inst.signedInOnce = false;
      this.reload(inst.id);
    }
    this.store.save('profile');
    const names = sharing.map(instanceName).join(', ');
    this.toast(sharing.length > 1 ? `Logged out of ${names} (they share one login) and cleared their data.` : `Logged out of ${names} and cleared its data. Other services weren't affected.`);
  }

  private async confirmRemove(workspaceId: string, instanceId: string): Promise<void> {
    const loc = this.store.locate(instanceId);
    if (!loc) return;
    const { response } = await dialog.showMessageBox(this.win, {
      type: 'question', buttons: ['Remove', 'Cancel'], defaultId: 1, cancelId: 1,
      message: `Remove ${instanceName(loc.inst)} from ${loc.ws.name}?`, detail: 'Its login and data on this computer are deleted too.',
    });
    if (response === 0) this.removeInstance(workspaceId, instanceId);
  }

  pinPage(workspaceId: string, instanceId: string): void {
    const wc = this.views.webContents(instanceId);
    const st = this.store.statuses[instanceId];
    if (!wc || !st) return;
    const pin = { id: randomUUID(), workspaceId, instanceId, title: (st.title || wc.getURL()).replace(/^\(\d+\+?\)\s*/, '').slice(0, 80), url: wc.getURL() };
    this.updateSettings({ pins: [...this.store.settings.pins, pin] });
    this.toast(`Pinned “${pin.title}”. Find it in ⌘K or by right-clicking the icon.`);
  }

  openPin(id: string): void {
    const pin = this.store.settings.pins.find((p) => p.id === id);
    if (pin) this.openIn(pin.workspaceId, pin.instanceId, pin.url);
  }

  /** Saved replies (FR-X23): typed into the focused field exactly like pasting. */
  insertReply(text: string): void {
    const inst = this.activeInstance();
    const wc = inst && this.views.webContents(inst.id);
    if (!wc) return;
    this.setOverlay(false);
    wc.focus();
    setTimeout(() => wc.insertText(text), 60);
  }

  find(text: string, forward: boolean, next: boolean): void {
    const inst = this.activeInstance();
    const wc = inst && this.views.webContents(inst.id);
    if (!wc) return;
    if (!text) {
      wc.stopFindInPage('clearSelection');
      this.store.runtime.find = { matches: 0, active: 0 };
      return this.store.emit();
    }
    wc.findInPage(text, { forward, findNext: !next });
  }

  stopFind(): void {
    const inst = this.activeInstance();
    if (inst) this.views.webContents(inst.id)?.stopFindInPage('clearSelection');
    this.store.runtime.find = null;
    this.store.emit();
    this.focusActive();
  }

  /** Task manager (FR-X19): memory and CPU per service process. */
  metrics(): InstanceMetrics[] {
    const byPid = new Map(app.getAppMetrics().map((m) => [m.pid, m]));
    return this.views.all().map(({ instanceId, wc }) => {
      const m = byPid.get(wc.getOSProcessId());
      return { instanceId, memoryMB: Math.round((m?.memory.workingSetSize ?? 0) / 1024), cpu: Math.round((m?.cpu.percentCPUUsage ?? 0) * 10) / 10 };
    });
  }

  /** Facts for a bug report: versions and service states only, never names, emails or addresses (issues are public). */
  systemInfo(): string {
    const s = this.store.settings;
    const os = ({ darwin: 'macOS', win32: 'Windows', linux: 'Linux' } as Record<string, string>)[process.platform] ?? process.platform;
    return systemInfo({
      version: app.getVersion(),
      os: `${os} ${process.getSystemVersion()}`,
      arch: process.arch,
      electron: process.versions.electron,
      chrome: process.versions.chrome,
      workspaces: this.store.workspaces.length,
      services: this.store.workspaces.flatMap((w) => w.instances.map((i) => {
        const st = this.store.statuses[i.id];
        return { name: serviceDef(i.type).name, state: i.enabled ? (st?.state ?? 'not loaded') : 'disabled', signedIn: st?.signedIn };
      })),
      settings: { 'Do Not Disturb': s.dnd, digest: s.digest.enabled, 'smart sleep': s.smartHibernation, 'app lock': s.appLock.enabled, 'time insights': s.usageTracking, 'feed guard': s.feedGuard.enabled },
    });
  }

  /** Opens the filled-in issue form on GitHub; the user submits it there with their own account. */
  reportProblem(report: Report): void {
    void shell.openExternal(issueUrl(report, this.systemInfo()));
    this.toast('Finish on GitHub: sign in if asked, add a screenshot if you like, then submit.', { ttl: 9000 });
  }

  // ---------------------------------------------------------------- toasts, recovery, timers
  toast(text: string, opts: Omit<Toast, 'id' | 'text'> & { ttl?: number } = {}): string {
    const { ttl = 5000, ...rest } = opts;
    const id = randomUUID();
    this.store.runtime.toasts = [...this.store.runtime.toasts.slice(-3), { id, text, ...rest }];
    this.floating.layout();
    this.store.emit();
    if (!rest.persistent) setTimeout(() => this.dismissToast(id), ttl);
    return id;
  }

  dismissToast(id: string): void {
    this.store.runtime.toasts = this.store.runtime.toasts.filter((t) => t.id !== id);
    this.floating.layout();
    this.store.emit();
  }

  /** Auto-recover (FR-X17): reload services that got stuck offline or crashed. */
  recover(reason: string): void {
    const stuck = Object.entries(this.store.statuses).filter(([, s]) => s.state === 'offline' || s.state === 'crashed').map(([id]) => id);
    for (const id of stuck) this.reload(id);
    const names = stuck.map((id) => this.store.locate(id)).filter((x) => !!x).map((x) => instanceName(x.inst));
    if (names.length) this.toast(`${reason}: reloaded ${names.join(', ')}.`);
  }

  setOnline(online: boolean): void {
    const was = this.store.runtime.online;
    this.store.runtime.online = online;
    this.store.emit();
    if (online && !was) setTimeout(() => this.recover('Back online'), 1500);
  }

  /** Work hours, smart hibernation and timed sleep, checked once a minute. */
  private minuteTick(): void {
    const now = new Date();
    const outside: Record<string, boolean> = {};
    for (const ws of this.store.workspaces) outside[ws.id] = outsideWorkHours(ws.workHours, now);
    if (JSON.stringify(outside) !== JSON.stringify(this.store.runtime.outsideHours)) {
      this.store.runtime.outsideHours = outside;
      this.store.emit();
    }
    this.hibernate();
  }

  /** Smart hibernation (FR-X18): under memory pressure, sleep the least-used feed. Messaging stays awake. */
  private hibernate(): void {
    const s = this.store.settings;
    const active = this.activeInstance()?.id;
    const candidates = this.views.all()
      .map(({ instanceId }) => ({ instanceId, loc: this.store.locate(instanceId) }))
      .filter((c) => c.loc && c.instanceId !== active && !['chat', 'mail', 'call'].includes(serviceDef(c.loc.inst.type).kind) && this.store.runtime.call?.instanceId !== c.instanceId)
      .sort((a, b) => (this.lastUsed.get(a.instanceId) ?? 0) - (this.lastUsed.get(b.instanceId) ?? 0));
    if (s.hibernateAfterMin > 0) {
      for (const c of candidates) if (Date.now() - (this.lastUsed.get(c.instanceId) ?? 0) > s.hibernateAfterMin * 60_000) this.sleep(c.instanceId, false);
    }
    // Silent on purpose: the task manager shows what's asleep, and clicking a service wakes it.
    if (s.smartHibernation && candidates[0] && Date.now() - this.lastSmartSleep > 10 * 60_000 && this.memoryPressure()) {
      this.lastSmartSleep = Date.now();
      this.sleep(candidates[0].instanceId, false);
    }
  }

  /**
   * Low on memory? macOS keeps almost nothing "free" by design (spare memory is cache), so there we
   * ask the kernel's own pressure level (1 normal, 2 warning, 4 critical) and act only on critical:
   * many Macs sit at "warning" all day. Elsewhere, free memory under 5%.
   */
  private memoryPressure(): boolean {
    if (process.platform === 'darwin') {
      try {
        return Number(execFileSync('sysctl', ['-n', 'kern.memorystatus_vm_pressure_level'], { encoding: 'utf8', timeout: 2000 }).trim()) >= 4;
      } catch {
        return false;
      }
    }
    const mem = process.getSystemMemoryInfo();
    return mem.free / mem.total < 0.05;
  }

  private checkWhatsNew(): void {
    const last = this.store.profile.lastVersion;
    const now = app.getVersion();
    if (last && last !== now && addedIn(now).length) this.store.runtime.whatsNew = now;
    if (last !== now) {
      this.store.profile.lastVersion = now;
      this.store.save('profile');
    }
  }

  private refreshMenu(): void {
    const ws = this.store.activeWorkspace;
    const key = JSON.stringify([this.store.workspaces.map((w) => [w.id, w.name]), ws?.id, ws && orderedInstances(ws.instances).map((i) => [i.id, i.label, i.type])]);
    if (key === this.menuKey) return;
    this.menuKey = key;
    buildMenu(this);
  }

  private saveBounds(): void {
    if (this.win.isMinimized() || this.win.isFullScreen()) return;
    this.store.profile.bounds = this.win.getBounds();
    this.store.save('profile');
  }

  showWindow(): void {
    if (this.win.isMinimized()) this.win.restore();
    this.win.show();
    this.win.focus();
  }
}

export function loadRenderer(wc: Electron.WebContents, hash: string): void {
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) void wc.loadURL(`${process.env.ELECTRON_RENDERER_URL}#${hash}`);
  else void wc.loadFile(join(__dirname, '../renderer/index.html'), { hash });
}

const rectInside = (r: { x: number; y: number; width: number; height: number }, area: Electron.Rectangle) =>
  r.x >= area.x - 50 && r.y >= area.y - 50 && r.x + r.width <= area.x + area.width + 50 && r.y + r.height <= area.y + area.height + 50;
