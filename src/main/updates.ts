/**
 * Updates from GitHub Releases: check at startup and every 6 hours.
 * - Windows and the Linux AppImage download the update in the background and install it on restart.
 * - macOS (the app isn't signed with a paid Apple certificate, so it can't replace itself) and .deb
 *   installs are told a new version is out, with a one-click download of that version's installer.
 * The beta channel also sees pre-releases (tags like v0.2.0-beta.1).
 */
import { app, shell } from 'electron';
import electronUpdater from 'electron-updater';
import type { Extrovert } from './app';

const { autoUpdater } = electronUpdater;
const REPO = 'https://github.com/Pantho-Haque/Extrovert';
const RELEASES = `${REPO}/releases`;
const SIX_HOURS = 6 * 3_600_000;

/** Installs that can't update themselves, and the installer they should download instead. */
const MANUAL_ASSET = process.platform === 'darwin' ? `Extrovert-mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}.dmg` : process.platform === 'linux' && !process.env.APPIMAGE ? 'Extrovert-linux.deb' : null;
export const downloadUrl = (version: string): string => (MANUAL_ASSET ? `${RELEASES}/download/v${version}/${MANUAL_ASSET}` : `${RELEASES}/tag/v${version}`);

export class Updates {
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly app: Extrovert) {
    autoUpdater.autoDownload = !MANUAL_ASSET;
    autoUpdater.on('update-available', (info) => {
      app.store.runtime.update = { version: info.version, ready: false, manual: !!MANUAL_ASSET };
      app.store.emit();
      if (MANUAL_ASSET) {
        app.toast(`Extrovert ${info.version} is out.`, {
          persistent: true,
          actions: [
            { label: 'Download', action: 'openExternal', payload: { url: downloadUrl(info.version) } },
            { label: "What's new", action: 'openExternal', payload: { url: `${RELEASES}/tag/v${info.version}` } },
          ],
        });
      }
    });
    autoUpdater.on('update-downloaded', (info) => {
      app.store.runtime.update = { version: info.version, ready: true, manual: false, ...(typeof info.releaseNotes === 'string' ? { notes: info.releaseNotes } : {}) };
      app.toast(`Extrovert ${info.version} is ready to install.`, { persistent: true, actions: [{ label: 'Restart now', action: 'installUpdate' }] });
    });
    autoUpdater.on('error', () => {
      // A failed background download: offer the release page instead of failing silently.
      const update = app.store.runtime.update;
      if (update && !update.ready && !update.manual) {
        app.toast(`Extrovert ${update.version} is available.`, { persistent: true, actions: [{ label: 'Download', action: 'openExternal', payload: { url: `${RELEASES}/tag/v${update.version}` } }] });
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
    const update = this.app.store.runtime.update;
    if (update?.ready) autoUpdater.quitAndInstall();
    else void shell.openExternal(update ? downloadUrl(update.version) : `${RELEASES}/latest`);
  }
}
