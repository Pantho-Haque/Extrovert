/**
 * Updates from GitHub Releases (FR-L02, §7.4): check at startup and every 6 hours, download in the
 * background, install on restart. Unsigned Mac builds can't self-install (decision D9), so they get
 * a "download from GitHub" link instead.
 */
import { app, shell } from 'electron';
import electronUpdater from 'electron-updater';
import type { Extrovert } from './app';

const { autoUpdater } = electronUpdater;
const RELEASES = 'https://github.com/Pantho-Haque/Extrovert/releases/latest';
const SIX_HOURS = 6 * 3_600_000;

export class Updates {
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly app: Extrovert) {
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-available', (info) => {
      app.store.runtime.update = { version: info.version, ready: false };
      app.store.emit();
    });
    autoUpdater.on('update-downloaded', (info) => {
      app.store.runtime.update = { version: info.version, ready: true, ...(typeof info.releaseNotes === 'string' ? { notes: info.releaseNotes } : {}) };
      app.toast(`Extrovert ${info.version} is ready to install.`, { persistent: true, actions: [{ label: 'Restart now', action: 'installUpdate' }] });
    });
    autoUpdater.on('error', () => {
      if (app.store.runtime.update && !app.store.runtime.update.ready) {
        app.toast(`Extrovert ${app.store.runtime.update.version} is available.`, { persistent: true, actions: [{ label: 'Download', action: 'openExternal', payload: { url: RELEASES } }] });
      }
    });
    this.configure();
  }

  configure(): void {
    clearInterval(this.timer);
    autoUpdater.allowPrerelease = this.app.store.settings.updates.channel === 'beta';
    if (!app.isPackaged || !this.app.store.settings.updates.autoCheck) return;
    void autoUpdater.checkForUpdates().catch(() => undefined);
    this.timer = setInterval(() => void autoUpdater.checkForUpdates().catch(() => undefined), SIX_HOURS);
  }

  async check(): Promise<void> {
    if (!app.isPackaged) {
      this.app.toast('Updates are checked in the installed app, from GitHub Releases.', { actions: [{ label: 'Open releases', action: 'openExternal', payload: { url: RELEASES } }] });
      return;
    }
    this.app.toast('Checking for updates…', { ttl: 2500 });
    const result = await autoUpdater.checkForUpdates().catch(() => null);
    if (!result?.isUpdateAvailable) this.app.toast(`You're up to date (Extrovert ${app.getVersion()}).`);
  }

  install(): void {
    if (this.app.store.runtime.update?.ready) autoUpdater.quitAndInstall();
    else void shell.openExternal(RELEASES);
  }
}
