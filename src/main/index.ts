import { app } from 'electron';
import { registerActions } from './actions';
import { Extrovert } from './app';

// Dev/tests only: a throwaway profile so experiments never touch real logins.
if (!app.isPackaged && process.env.EXTROVERT_PROFILE_DIR) app.setPath('userData', process.env.EXTROVERT_PROFILE_DIR);
// Test runs: keep drawing while other windows cover this one (the app never jumps to the front), so screenshots work.
if (!app.isPackaged && process.env.EXTROVERT_DEBUG_SCRIPT) {
  app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
}
app.setName('Extrovert');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  const extrovert = new Extrovert();
  app.on('second-instance', () => extrovert.showWindow());
  app.on('activate', () => extrovert.showWindow());
  app.on('before-quit', () => extrovert.store.flush());
  app.on('window-all-closed', () => app.quit()); // ponytail: macOS keep-in-dock-without-window comes with background mode

  void app.whenReady().then(() => {
    extrovert.start();
    // Only Extrovert's own UI (shell, panels, tray) may call actions; service pages never can.
    const devUrl = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined;
    // Dev only: a script can drive the app for automated end-to-end checks (ignored in packaged builds).
    if (!app.isPackaged && process.env.EXTROVERT_DEBUG_SCRIPT) {
      const script = process.env.EXTROVERT_DEBUG_SCRIPT;
      setTimeout(() => void (require(script) as (x: Extrovert) => Promise<void>)(extrovert).catch((e) => console.error('[debug-script]', e)), 2500);
    }
    registerActions(extrovert, (wc) => {
      if (extrovert.views.instanceFor(wc)) return false;
      const url = wc.getURL();
      return url.startsWith('file://') || (!!devUrl && url.startsWith(devUrl));
    });
  });
}
