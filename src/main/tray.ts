/** Menu-bar / tray icon with a mini view of unread counts and recent notifications (FR-X25). */
import { join } from 'node:path';
import { BrowserWindow, Menu, nativeImage, screen, Tray } from 'electron';
import { loadRenderer, type Extrovert } from './app';

const W = 340;
const H = 470;

export class TrayUI {
  private tray: Tray;
  private panel: BrowserWindow | null = null;

  constructor(private readonly app: Extrovert) {
    this.tray = new Tray(trayIcon());
    this.tray.setToolTip('Extrovert');
    this.tray.on('click', () => this.toggle());
    this.tray.on('right-click', () =>
      this.tray.popUpContextMenu(Menu.buildFromTemplate([
        { label: 'Open Extrovert', click: () => app.showWindow() },
        { label: 'Do Not Disturb', type: 'checkbox', checked: app.store.settings.dnd, click: (i) => app.updateSettings({ dnd: i.checked }) },
        { type: 'separator' },
        { role: 'quit' },
      ])),
    );
  }

  webContents(): Electron.WebContents[] {
    return this.panel && !this.panel.isDestroyed() ? [this.panel.webContents] : [];
  }

  setUnread(total: number): void {
    if (process.platform === 'darwin') this.tray.setTitle(total ? String(total > 99 ? '99+' : total) : '');
    this.tray.setToolTip(total ? `Extrovert · ${total} unread` : 'Extrovert');
  }

  private toggle(): void {
    if (this.panel?.isVisible()) return this.panel.hide();
    this.panel ??= this.create();
    const b = this.tray.getBounds();
    const area = screen.getDisplayNearestPoint({ x: b.x, y: b.y }).workArea;
    const x = Math.min(Math.max(area.x + 8, Math.round(b.x + b.width / 2 - W / 2)), area.x + area.width - W - 8);
    const below = b.y < area.y + area.height / 2; // macOS menu bar at the top, Windows taskbar usually at the bottom
    this.panel.setBounds({ x, y: below ? b.y + b.height + 4 : b.y - H - 4, width: W, height: H });
    this.panel.show();
    this.panel.focus();
    this.panel.webContents.send('state', this.app.store.snapshot());
  }

  private create(): BrowserWindow {
    const win = new BrowserWindow({
      width: W, height: H, show: false, frame: false, resizable: false, movable: false, skipTaskbar: true,
      alwaysOnTop: true, fullscreenable: false, transparent: true, backgroundColor: '#00000000',
      webPreferences: { preload: join(__dirname, '../preload/shell.js'), sandbox: true, contextIsolation: true },
    });
    win.on('blur', () => win.hide());
    loadRenderer(win.webContents, 'tray');
    return win;
  }

  hide(): void {
    this.panel?.hide();
  }
}

/** Two linked rings (the Extrovert mark), drawn as a template image so macOS tints it for light/dark menu bars. */
function trayIcon(): Electron.NativeImage {
  const size = 32; // 16pt at 2x
  const buf = Buffer.alloc(size * size * 4);
  const rings = [{ cx: 12, cy: 16 }, { cx: 20, cy: 16 }];
  const r = 7.2;
  const stroke = 2.6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // 4x4 supersampling for smooth edges.
      let cover = 0;
      for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
        const px = x + (sx + 0.5) / 4;
        const py = y + (sy + 0.5) / 4;
        if (rings.some(({ cx, cy }) => Math.abs(Math.hypot(px - cx, py - cy) - r) <= stroke / 2)) cover++;
      }
      const i = (y * size + x) * 4;
      buf[i + 3] = Math.round((cover / 16) * 255); // BGRA: black with alpha
    }
  }
  const img = nativeImage.createFromBitmap(buf, { width: size, height: size, scaleFactor: 2 });
  img.setTemplateImage(true);
  return img;
}
