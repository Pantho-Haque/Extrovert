/**
 * One isolated, persistent web view per service instance. Views stay alive in the background so
 * unread counts and notifications keep flowing (FR-N02, FR-A02); sleeping instances have none.
 */
import { join } from 'node:path';
import { app, type BaseWindow, session, WebContentsView } from 'electron';
import { ICON_PROBE, pickIcon, type IconCandidate } from '../core/services/site-icon';
import { iconDataUrl } from './site-icons';
import { domainsOf, isServiceUrl } from '../core/services/catalog';
import { partitionFor, startUrl } from '../core/workspaces/model';
import type { Instance, Workspace } from '../shared/types';

export const SIDEBAR_WIDTH = 68;
/** macOS: a thin title bar holds the window buttons, so nothing sits under them. */
export const TITLEBAR_HEIGHT = process.platform === 'darwin' ? 30 : 0;
const ICON_WORLD = 1001; // isolated JS world: reads the page's DOM without the page seeing us

export interface ViewEvents {
  title(instanceId: string, title: string): void;
  navigated(instanceId: string, url: string): void;
  loading(instanceId: string, loading: boolean): void;
  failed(instanceId: string, code: number, description: string): void;
  crashed(instanceId: string, reason: string): void;
  icon(instanceId: string, dataUrl: string): void;
  playing(instanceId: string, playing: boolean): void;
  /** A link the service wants to open in a new window. */
  openLink(instanceId: string, url: string): void;
  found(matches: number, active: number): void;
  /** Called once per new session, so the app can add permissions, downloads and screen sharing. */
  configureSession(ses: Electron.Session, ws: Workspace, inst: Instance): void;
}

interface Entry {
  view: WebContentsView;
  workspaceId: string;
  type: Instance['type'];
  url?: string;
  iconUrl?: string;
}

export class ViewHost {
  private views = new Map<string, Entry>();
  private byWebContents = new Map<number, string>();
  private configured = new WeakSet<Electron.Session>();
  private active: string | null = null;
  private overlay = false;
  private zen = false;
  /** A view moved into the call bubble window is "detached" and left alone by layout(). */
  private detached = new Set<string>();
  /** Small always-on-top panels (toasts, find bar, peek). */
  floating: WebContentsView[] = [];
  /** Last picture of each page, taken as the user leaves it; used by peek if a live capture fails. */
  private snapshots = new Map<string, string>();

  constructor(
    private readonly win: BaseWindow,
    private readonly shell: WebContentsView,
    private readonly userAgent: string,
    private readonly events: ViewEvents,
  ) {
    win.on('resize', () => this.layout());
  }

  has(instanceId: string): boolean {
    return this.views.has(instanceId);
  }

  webContents(instanceId: string): Electron.WebContents | undefined {
    const wc = this.views.get(instanceId)?.view.webContents;
    return wc && !wc.isDestroyed() ? wc : undefined;
  }

  view(instanceId: string): WebContentsView | undefined {
    return this.views.get(instanceId)?.view;
  }

  instanceFor(wc: Electron.WebContents): string | undefined {
    return this.byWebContents.get(wc.id);
  }

  all(): { instanceId: string; wc: Electron.WebContents }[] {
    return [...this.views.entries()].flatMap(([instanceId, e]) => (e.view.webContents.isDestroyed() ? [] : [{ instanceId, wc: e.view.webContents }]));
  }

  /** Creates the view and starts loading, unless it already exists. */
  ensure(ws: Workspace, inst: Instance): void {
    if (this.views.has(inst.id)) return;
    const ses = session.fromPartition(partitionFor(ws.id, inst.session));
    if (!this.configured.has(ses)) {
      ses.setUserAgent(this.userAgent);
      this.events.configureSession(ses, ws, inst);
      this.configured.add(ses);
    }
    const view = new WebContentsView({
      webPreferences: {
        session: ses,
        preload: join(__dirname, '../preload/service.js'),
        sandbox: true,
        contextIsolation: true,
        autoplayPolicy: inst.autoplay ? 'no-user-gesture-required' : 'document-user-activation-required',
        spellcheck: true,
      },
    });
    view.setBackgroundColor('#FFFFFF');
    const wc = view.webContents;
    const id = inst.id;
    const entry: Entry = { view, workspaceId: ws.id, type: inst.type, ...(inst.url ? { url: inst.url } : {}) };
    this.views.set(id, entry);
    this.byWebContents.set(wc.id, id);

    wc.setZoomFactor(inst.zoom / 100);
    wc.on('page-title-updated', (_e, title) => this.events.title(id, title));
    wc.on('did-start-loading', () => this.events.loading(id, true));
    wc.on('did-stop-loading', () => this.events.loading(id, false));
    wc.on('did-navigate', (_e, url) => this.events.navigated(id, url));
    wc.on('did-navigate-in-page', (_e, url, isMainFrame) => isMainFrame && this.events.navigated(id, url));
    wc.on('did-fail-load', (_e, code, description, _url, isMainFrame) => {
      if (isMainFrame && code !== -3) this.events.failed(id, code, description); // -3: navigation replaced, not a failure
    });
    wc.on('render-process-gone', (_e, details) => this.events.crashed(id, details.reason));
    wc.on('media-started-playing', () => this.events.playing(id, true));
    wc.on('media-paused', () => this.events.playing(id, false));
    if (inst.type === 'custom') wc.on('page-favicon-updated', () => void this.refreshIcon(id)); // catalog services use the icon pack
    wc.on('found-in-page', (_e, r) => this.events.found(r.matches, r.activeMatchOrdinal));
    // Sites like Gmail register "Leave site?" handlers; Electron would silently cancel quitting.
    wc.on('will-prevent-unload', (e) => e.preventDefault());
    wc.setWindowOpenHandler(({ url }) => {
      // Popups inside the service (logins, attachments) stay in-app; everything else is routed.
      if (isServiceUrl({ domains: domainsOf(entry.type, entry.url) }, url)) return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: { session: ses } } };
      this.events.openLink(id, url);
      return { action: 'deny' };
    });

    this.win.contentView.addChildView(view);
    this.raiseTops();
    this.layout();
    void wc.loadURL(startUrl(ws, inst));
  }

  /** Frees the view (sleep, sign-out, removal). Its session and logins stay on disk. */
  destroy(instanceId: string): void {
    const e = this.views.get(instanceId);
    if (!e) return;
    this.views.delete(instanceId);
    this.detached.delete(instanceId);
    if (!e.view.webContents.isDestroyed()) {
      this.byWebContents.delete(e.view.webContents.id);
      this.win.contentView.removeChildView(e.view);
      e.view.webContents.close({ waitForBeforeUnload: false });
    }
  }

  show(instanceId: string | null): void {
    const leaving = this.active;
    if (leaving && leaving !== instanceId) void this.remember(leaving);
    this.active = instanceId;
    this.layout();
    // Focus the page only when the user switched to it while using Extrovert. Focusing a page at any
    // other moment (a background page finished loading, a cookie changed) pulls the app to the front on macOS.
    if (instanceId && instanceId !== leaving && !this.overlay && this.win.isFocused()) this.webContents(instanceId)?.focus();
  }

  setOverlay(open: boolean): void {
    this.overlay = open;
    // The shell draws modals on a transparent background above the live service view.
    if (!open) {
      this.win.contentView.removeChildView(this.shell);
      this.win.contentView.addChildView(this.shell, 0);
    }
    this.raiseTops();
    if (!this.win.isFocused()) return; // never grab focus while the user is in another app
    if (open) this.shell.webContents.focus();
    else if (this.active) this.webContents(this.active)?.focus();
  }

  setZen(zen: boolean): void {
    this.zen = zen;
    this.layout();
  }

  detach(instanceId: string): WebContentsView | undefined {
    const e = this.views.get(instanceId);
    if (!e) return undefined;
    this.detached.add(instanceId);
    this.win.contentView.removeChildView(e.view);
    return e.view;
  }

  attach(instanceId: string): void {
    const e = this.views.get(instanceId);
    if (!e || !this.detached.delete(instanceId)) return;
    this.win.contentView.addChildView(e.view);
    this.raiseTops();
    this.layout();
  }

  /**
   * A picture of a page for peek (FR-X08). Hidden pages don't paint, so the page is shown for a
   * moment *underneath* the visible one, captured, and hidden again; the user never sees it.
   */
  async snapshot(instanceId: string): Promise<string | undefined> {
    const e = this.views.get(instanceId);
    if (!e || e.view.webContents.isDestroyed()) return undefined;
    const hidden = instanceId !== this.active;
    try {
      if (hidden) {
        e.view.setVisible(true);
        const top = this.active && this.views.get(this.active)?.view;
        if (top) this.win.contentView.addChildView(top); // keep the visible page above
        this.raiseTops();
        await new Promise((r) => setTimeout(r, 120)); // let it paint a frame
      }
      const url = (await e.view.webContents.capturePage()).resize({ width: 880 }).toDataURL();
      this.snapshots.set(instanceId, url);
      return url;
    } catch {
      return this.snapshots.get(instanceId);
    } finally {
      if (hidden && instanceId !== this.active) e.view.setVisible(false);
    }
  }

  private async remember(instanceId: string): Promise<void> {
    const wc = this.webContents(instanceId);
    if (!wc) return;
    try {
      this.snapshots.set(instanceId, (await wc.capturePage()).resize({ width: 880 }).toDataURL());
    } catch {
      // nothing to remember yet
    }
  }

  /** Z-order, bottom to top: shell (normal) → service views → shell (when a modal is open) → floating panels. */
  raiseTops(): void {
    if (this.overlay) this.win.contentView.addChildView(this.shell); // re-adding moves a view to the top
    for (const f of this.floating) this.win.contentView.addChildView(f);
  }

  layout(): void {
    const { width, height } = this.win.getContentBounds();
    this.shell.setBounds({ x: 0, y: 0, width, height });
    const left = this.zen ? 0 : SIDEBAR_WIDTH;
    for (const [id, e] of this.views) {
      if (this.detached.has(id)) continue;
      e.view.setBounds({ x: left, y: TITLEBAR_HEIGHT, width: Math.max(0, width - left), height: Math.max(0, height - TITLEBAR_HEIGHT) });
      e.view.setVisible(id === this.active);
    }
  }

  /** Uses the icon the site itself shows, re-checked whenever the page changes it (Gmail: Google → Gmail after login). */
  private async refreshIcon(instanceId: string): Promise<void> {
    const e = this.views.get(instanceId);
    const wc = this.webContents(instanceId);
    if (!e || !wc) return;
    try {
      const candidates = (await wc.executeJavaScriptInIsolatedWorld(ICON_WORLD, [{ code: ICON_PROBE }])) as IconCandidate[];
      const iconUrl = pickIcon(candidates, wc.getURL());
      if (e.iconUrl === iconUrl) return;
      e.iconUrl = iconUrl;
      const res = await wc.session.fetch(iconUrl);
      const icon = res.ok ? iconDataUrl((res.headers.get('content-type') ?? '').split(';')[0]!.trim(), Buffer.from(await res.arrayBuffer())) : undefined;
      if (icon) this.events.icon(instanceId, icon);
    } catch (err) {
      e.iconUrl = undefined; // try again next time the page updates its icon
      if (!app.isPackaged) console.log(`[icon] ${instanceId} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
