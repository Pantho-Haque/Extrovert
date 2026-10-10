/**
 * Small always-on-top panels drawn over the service area without blocking it: toasts (bottom
 * center), the find bar (top right) and peek (next to the sidebar). Each is a transparent view
 * sized to its content, so clicks elsewhere still reach the page underneath.
 */
import { join } from 'node:path';
import { WebContentsView } from 'electron';
import type { FloatingName } from '../shared/ipc';
import { loadRenderer, type Extrovert } from './app';
import { SIDEBAR_WIDTH, TITLEBAR_HEIGHT } from './views';

export class Floating {
  private panels: Record<FloatingName, WebContentsView>;
  private sizes: Record<FloatingName, { width: number; height: number }> = {
    toasts: { width: 0, height: 0 },
    find: { width: 380, height: 52 },
    peek: { width: 472, height: 320 },
  };
  private peekAt = { x: 0, y: 0 };

  constructor(private readonly app: Extrovert) {
    const make = (name: FloatingName) => {
      const v = new WebContentsView({ webPreferences: { preload: join(__dirname, '../preload/shell.js'), sandbox: true, contextIsolation: true } });
      v.setBackgroundColor('#00000000');
      v.setVisible(false);
      app.win.contentView.addChildView(v);
      loadRenderer(v.webContents, name);
      return v;
    };
    this.panels = { toasts: make('toasts'), find: make('find'), peek: make('peek') };
    app.views.floating = Object.values(this.panels);
    app.win.on('resize', () => this.layout());
  }

  webContents(): Electron.WebContents[] {
    return Object.values(this.panels).map((p) => p.webContents);
  }

  resize(name: FloatingName, width: number, height: number): void {
    // Peek has a fixed size: a zero-size hidden view never lays out, so it could never report one.
    if (name === 'peek') return;
    this.sizes[name] = { width: Math.ceil(width), height: Math.ceil(height) };
    this.layout();
  }

  openFind(): void {
    this.app.store.runtime.find = { matches: 0, active: 0 };
    this.app.store.emit();
    this.layout();
    this.panels.find.webContents.focus();
  }

  showPeek(x: number, y: number): void {
    this.peekAt = { x, y };
    this.layout();
  }

  layout(): void {
    const { width, height } = this.app.win.getContentBounds();
    const left = this.app.store.runtime.zen ? 0 : SIDEBAR_WIDTH;
    const rt = this.app.store.runtime;

    const t = this.sizes.toasts;
    const showToasts = rt.toasts.length > 0 && t.height > 0;
    this.panels.toasts.setVisible(showToasts);
    if (showToasts) this.panels.toasts.setBounds({ x: Math.round(left + (width - left - t.width) / 2), y: height - t.height - 8, width: t.width, height: t.height });

    const f = this.sizes.find;
    this.panels.find.setVisible(!!rt.find);
    if (rt.find) this.panels.find.setBounds({ x: width - f.width - 12, y: TITLEBAR_HEIGHT + 10, width: f.width, height: f.height });

    const p = this.sizes.peek;
    this.panels.peek.setVisible(!!rt.peek);
    if (rt.peek) this.panels.peek.setBounds({ x: left + 8, y: Math.max(TITLEBAR_HEIGHT + 8, Math.min(height - p.height - 8, this.peekAt.y - 60)), width: p.width, height: p.height });
  }
}
