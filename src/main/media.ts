/**
 * Everything a service session needs beyond loading pages: permission prompts (FR-S06, FR-X28),
 * screen sharing (FR-X11), camera/mic indicators and the call bubble (FR-X09, FR-X10),
 * downloads (FR-X26) and per-workspace proxies (FR-X13).
 */
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { app as electronApp, BaseWindow, desktopCapturer, ipcMain, screen, session, systemPreferences, webContents } from 'electron';
import { instanceName, partitionFor } from '../core/workspaces/model';
import type { DevicePermission, Instance, MediaKind, Workspace } from '../shared/types';
import type { Extrovert } from './app';

type Answer = (allow: boolean) => void;

export class Media {
  private pendingPermissions = new Map<string, Answer>();
  private pendingScreen: ((sourceId: string | null) => void) | null = null;
  private sharingToast: string | null = null;

  constructor(private readonly app: Extrovert) {
    ipcMain.on('svc:media', (e, kinds: MediaKind[]) => {
      const id = app.views.instanceFor(e.sender);
      if (id) this.onMedia(id, kinds);
    });
  }

  configureSession(ses: Electron.Session, ws: Workspace, inst: Instance): void {
    // Services sharing a login share this session: find which one is asking from its page.
    const who = (wc: Electron.WebContents | null | undefined) => (wc && this.app.views.instanceFor(wc)) || inst.id;
    ses.setPermissionRequestHandler((wc, permission, callback, details) => {
      const id = who(wc);
      if (permission === 'notifications' || permission === 'clipboard-sanitized-write' || permission === 'fullscreen') return callback(true);
      if (permission === 'media') {
        const types = (details as Electron.MediaAccessPermissionRequest).mediaTypes ?? [];
        const wanted: DevicePermission[] = [...(types.includes('video') ? ['camera' as const] : []), ...(types.includes('audio') ? ['microphone' as const] : [])];
        const devices = wanted.length ? wanted : ['microphone' as const];
        return void this.ask(id, devices).then(async (allow) => callback(allow && (await this.systemAccess(id, devices))));
      }
      if (permission === 'geolocation') return void this.ask(id, ['location']).then(callback);
      callback(false);
    });
    ses.setPermissionCheckHandler((wc, permission, _origin, details) => {
      const id = who(wc);
      if (permission === 'notifications' || permission === 'clipboard-sanitized-write' || permission === 'fullscreen') return true;
      const perms = this.app.store.locate(id)?.inst.permissions ?? {};
      // Only a "Block" counts as denied. Not asked yet must not look denied, or sites like Meet show
      // "blocked" and never ask; when they do ask, Extrovert's own prompt appears.
      if (permission === 'media') return (details as { mediaType?: string }).mediaType === 'video' ? perms.camera !== false : perms.microphone !== false;
      if (permission === 'geolocation') return !!perms.location;
      return false;
    });
    // macOS 15+ shows its own screen picker; elsewhere Extrovert shows one.
    ses.setDisplayMediaRequestHandler((request, callback) => {
      const id = who(request.frame ? webContents.fromFrame(request.frame) : undefined);
      void this.pickScreenFor(id).then((source) => (source ? callback({ video: source }) : callback({})));
    }, { useSystemPicker: true });
    ses.on('will-download', (_e, item, wc) => this.trackDownload(ws.id, who(wc), item));
    void this.applyProxy(ws, inst);
  }

  async applyProxy(ws: Workspace, inst: Instance): Promise<void> {
    const ses = session.fromPartition(partitionFor(ws.id, inst.session));
    await ses.setProxy(ws.proxy ? { proxyRules: ws.proxy } : { mode: 'system' });
  }

  // ---------------------------------------------------------------- permissions
  /** Asks once per instance and remembers the answer (it can be changed in Settings → Privacy). */
  private ask(instanceId: string, wanted: DevicePermission[]): Promise<boolean> {
    const loc = this.app.store.locate(instanceId);
    if (!loc) return Promise.resolve(false);
    const known = wanted.map((p) => loc.inst.permissions[p]);
    if (known.every((v) => v === true)) return Promise.resolve(true);
    if (known.some((v) => v === false)) return Promise.resolve(false);
    const promptId = randomUUID();
    const label = wanted.map((p) => ({ camera: 'camera', microphone: 'microphone', location: 'location' })[p]).join(' and ');
    this.app.store.runtime.permissionPrompt = { id: promptId, workspaceId: loc.ws.id, instanceId, what: label };
    this.app.store.emit();
    // Never jump in front of what the user is doing: the question waits, and a notification says so.
    if (!this.app.win.isFocused()) {
      this.app.notifier.system(`${instanceName(loc.inst)} wants to use your ${label}`, `${loc.ws.name}: open Extrovert to allow or block it.`, () => undefined);
    }
    return new Promise((resolve) => {
      this.pendingPermissions.set(promptId, (allow) => {
        for (const p of wanted) loc.inst.permissions[p] = allow;
        this.app.store.save('profile');
        resolve(allow);
      });
    });
  }

  /**
   * macOS also has to allow Extrovert itself to use the camera and microphone (it asks once). If it
   * was refused there, say where to turn it on instead of failing silently.
   */
  private async systemAccess(instanceId: string, devices: DevicePermission[]): Promise<boolean> {
    if (process.platform !== 'darwin') return true;
    for (const d of devices) {
      if (d === 'location') continue;
      const kind = d === 'camera' ? 'camera' : 'microphone';
      if (systemPreferences.getMediaAccessStatus(kind) === 'granted') continue;
      if (await systemPreferences.askForMediaAccess(kind)) continue;
      const loc = this.app.store.locate(instanceId);
      this.app.toast(`macOS isn't letting Extrovert use your ${kind}${loc ? ` for ${instanceName(loc.inst)}` : ''}. Turn it on in System Settings → Privacy & Security → ${kind === 'camera' ? 'Camera' : 'Microphone'}, then try again.`, {
        persistent: true,
        actions: [{ label: 'Open settings', action: 'openPrivacySettings', payload: { device: kind } }],
      });
      return false;
    }
    return true;
  }

  answerPermission(id: string, allow: boolean): void {
    this.pendingPermissions.get(id)?.(allow);
    this.pendingPermissions.delete(id);
    this.app.store.runtime.permissionPrompt = null;
    this.app.store.emit();
  }

  // ---------------------------------------------------------------- screen sharing
  private async pickScreenFor(instanceId: string): Promise<Electron.DesktopCapturerSource | null> {
    const sources = await desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 320, height: 200 } });
    this.app.store.runtime.screenPicker = {
      instanceId,
      sources: sources.map((s) => ({ id: s.id, name: s.name, thumbnail: s.thumbnail.toDataURL() })),
    };
    this.app.store.emit();
    const chosen = await new Promise<string | null>((resolve) => (this.pendingScreen = resolve));
    return sources.find((s) => s.id === chosen) ?? null;
  }

  pickScreen(sourceId: string | null): void {
    this.pendingScreen?.(sourceId);
    this.pendingScreen = null;
    this.app.store.runtime.screenPicker = null;
    this.app.store.emit();
  }

  stopSharing(): void {
    const sharing = this.app.store.runtime.sharing;
    if (sharing) this.app.views.webContents(sharing.instanceId)?.send('svc:stop-screen');
  }

  // ---------------------------------------------------------------- camera / mic / screen in use
  private onMedia(instanceId: string, kinds: MediaKind[]): void {
    const { store } = this.app;
    const loc = store.locate(instanceId);
    if (!loc) return;
    store.patchStatus(instanceId, { media: kinds });
    const rt = store.runtime;

    const inCall = kinds.includes('mic') || kinds.includes('camera');
    if (inCall && rt.call?.instanceId !== instanceId) {
      rt.call = { workspaceId: loc.ws.id, instanceId, startedAt: Date.now(), inBubble: false };
    } else if (!inCall && rt.call?.instanceId === instanceId) {
      this.app.bubble.close();
      rt.call = null;
      this.app.showActive();
    }

    const sharing = kinds.includes('screen');
    if (sharing && rt.sharing?.instanceId !== instanceId) {
      rt.sharing = { workspaceId: loc.ws.id, instanceId };
      const shield = store.settings.shareShield ? ' Shield on: previews and other workspaces are hidden.' : '';
      this.sharingToast = this.app.toast(`Sharing your screen from ${instanceName(loc.inst)} (${loc.ws.name}).${shield}`, {
        persistent: true, tone: 'warn', actions: [{ label: 'Stop sharing', action: 'stopSharing' }],
      });
    } else if (!sharing && rt.sharing?.instanceId === instanceId) {
      rt.sharing = null;
      if (this.sharingToast) this.app.dismissToast(this.sharingToast);
      this.sharingToast = null;
    }
    store.emit();
  }

  /** Leaving a call for another service pops the call out into the floating bubble (FR-X09). */
  onSwitch(toInstanceId: string): void {
    const call = this.app.store.runtime.call;
    if (!call) return;
    if (call.instanceId === toInstanceId) this.app.bubble.close();
    else if (!call.inBubble) this.app.bubble.open(call.instanceId);
  }

  // ---------------------------------------------------------------- downloads
  private trackDownload(workspaceId: string, instanceId: string, item: Electron.DownloadItem): void {
    const { store } = this.app;
    const path = uniquePath(join(electronApp.getPath('downloads'), item.getFilename()));
    item.setSavePath(path);
    const id = randomUUID();
    store.downloads = [{ id, name: basename(path), path, bytes: item.getTotalBytes(), received: 0, state: 'progressing' as const, workspaceId, instanceId, at: Date.now() }, ...store.downloads].slice(0, 50);
    store.emit();
    const update = (patch: Partial<(typeof store.downloads)[number]>) => {
      store.downloads = store.downloads.map((d) => (d.id === id ? { ...d, ...patch } : d));
      store.emit();
    };
    item.on('updated', (_e, state) => update({ received: item.getReceivedBytes(), bytes: item.getTotalBytes(), state: state === 'interrupted' ? 'interrupted' : 'progressing' }));
    item.once('done', (_e, state) => {
      update({ received: item.getReceivedBytes(), state });
      if (state === 'completed') this.app.toast(`Downloaded ${basename(path)}`, { actions: [{ label: 'Show in folder', action: 'openDownload', payload: { id, reveal: true } }] });
    });
  }
}

function uniquePath(path: string): string {
  if (!existsSync(path)) return path;
  const ext = extname(path);
  const stem = path.slice(0, path.length - ext.length);
  for (let n = 1; ; n++) if (!existsSync(`${stem} (${n})${ext}`)) return `${stem} (${n})${ext}`;
}

/** Floating, always-on-top window that hosts a call while the user uses other services. */
export class CallBubble {
  private win: BaseWindow | null = null;
  private instanceId: string | null = null;

  constructor(private readonly app: Extrovert) {}

  open(instanceId: string): void {
    const view = this.app.views.detach(instanceId);
    const loc = this.app.store.locate(instanceId);
    if (!view || !loc) return;
    const area = screen.getPrimaryDisplay().workArea;
    this.win = new BaseWindow({
      width: 400, height: 300, x: area.x + area.width - 424, y: area.y + area.height - 324,
      alwaysOnTop: true, minimizable: false, maximizable: false, fullscreenable: false,
      title: `${instanceName(loc.inst)} call · ${loc.ws.name}`,
    });
    this.win.contentView.addChildView(view);
    const fit = () => {
      const { width, height } = this.win!.getContentBounds();
      view.setBounds({ x: 0, y: 0, width, height });
      view.setVisible(true);
    };
    fit();
    this.win.on('resize', fit);
    // Closing the bubble keeps the call going; it just goes back into the main window.
    this.win.on('close', () => this.restore());
    this.instanceId = instanceId;
    if (this.app.store.runtime.call) this.app.store.runtime.call.inBubble = true;
    this.app.store.emit();
  }

  close(): void {
    if (this.win && !this.win.isDestroyed()) this.win.close();
    else this.restore();
  }

  private restore(): void {
    const id = this.instanceId;
    if (!id) return;
    const view = this.app.views.view(id);
    // Move the call view back before the bubble goes away (views outlive their window, so nothing reloads).
    if (view && this.win && !this.win.isDestroyed()) this.win.contentView.removeChildView(view);
    this.win = null;
    this.instanceId = null;
    this.app.views.attach(id);
    if (this.app.store.runtime.call) this.app.store.runtime.call.inBubble = false;
    this.app.showActive();
  }
}
