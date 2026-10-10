/**
 * Runs inside every service page (sandboxed). It only *observes*: the page's own notifications
 * (FR-A03 #2) and its camera/microphone/screen use (FR-X10). It never changes the page (NFR-01).
 */
import { contextBridge, ipcRenderer } from 'electron';

export interface PageNotification {
  id: string;
  title: string;
  body: string;
  /** The page has its own click handler (a plain `new Notification`). */
  handlesClick?: boolean;
  /** The conversation's address, from the notification's data (service-worker style notifications). */
  url?: string;
}

const clip = (v: unknown, max: number) => String(v ?? '').slice(0, max);

contextBridge.exposeInMainWorld('__extrovert', {
  notify: (n: PageNotification) => ipcRenderer.send('svc:notify', {
    id: clip(n?.id, 64), title: clip(n?.title, 200), body: clip(n?.body, 1000), handlesClick: n?.handlesClick === true,
    ...(typeof n?.url === 'string' && /^https?:\/\//.test(n.url) ? { url: clip(n.url, 2000) } : {}),
  }),
  media: (kinds: unknown) => ipcRenderer.send('svc:media', Array.isArray(kinds) ? kinds.filter((k) => ['mic', 'camera', 'screen'].includes(k)) : []),
  onClick: (cb: (id: string) => void) => ipcRenderer.on('svc:click', (_e, id: string) => cb(id)),
  onStopScreen: (cb: () => void) => ipcRenderer.on('svc:stop-screen', () => cb()),
});

// Installed in the page's own JavaScript world before any page script runs.
contextBridge.executeInMainWorld({
  func: () => {
    type Bridge = {
      notify(n: { id: string; title: string; body: string; handlesClick?: boolean; url?: string }): void;
      media(kinds: string[]): void;
      onClick(cb: (id: string) => void): void;
      onStopScreen(cb: () => void): void;
    };
    const bridge = (window as unknown as { __extrovert: Bridge }).__extrovert;

    /** The first address-looking value in a notification's data (sites use different keys). */
    const linkIn = (data: unknown, depth = 0): string | undefined => {
      if (typeof data === 'string') {
        if (!/^(https?:\/\/|\/[^/])/.test(data)) return undefined; // a link or a path, not any word
        try {
          const u = new URL(data, location.href);
          return /^https?:$/.test(u.protocol) ? u.href : undefined;
        } catch {
          return undefined;
        }
      }
      if (!data || typeof data !== 'object' || depth > 2) return undefined;
      const o = data as Record<string, unknown>;
      for (const k of ['url', 'href', 'link', 'uri', 'click_action', 'clickAction', 'target_url', 'targetUrl', 'deeplink', 'path']) {
        const found = typeof o[k] === 'string' ? linkIn(o[k], depth + 1) : undefined;
        if (found) return found;
      }
      for (const v of Object.values(o)) {
        const found = v && typeof v === 'object' ? linkIn(v, depth + 1) : undefined;
        if (found) return found;
      }
      return undefined;
    };

    // --- Notifications: Extrovert shows them natively, and routes clicks back to the page so it opens the right chat.
    const live = new Map<string, EventTarget & { onclick: ((e: Event) => void) | null }>();
    let seq = 0;
    class ExtrovertNotification extends EventTarget {
      title: string; body: string; tag: string; data: unknown; icon: string;
      onclick: ((e: Event) => void) | null = null;
      onshow: ((e: Event) => void) | null = null;
      onclose: ((e: Event) => void) | null = null;
      onerror: ((e: Event) => void) | null = null;
      readonly id = `n${Date.now().toString(36)}${(seq++).toString(36)}`;
      constructor(title: string, options: NotificationOptions = {}, fromServiceWorker = false) {
        super();
        this.title = String(title);
        this.body = options.body ?? '';
        this.tag = options.tag ?? '';
        this.data = options.data;
        this.icon = options.icon ?? '';
        live.set(this.id, this);
        if (live.size > 200) live.delete(live.keys().next().value!);
        // A plain `new Notification` gets its click back (the page opens the chat itself). One shown
        // through the service worker expects the worker to handle the click, which never happens in
        // Extrovert, so the chat address it carries is used instead.
        const url = fromServiceWorker ? linkIn(options.data) : undefined;
        bridge.notify({ id: this.id, title: this.title, body: this.body, handlesClick: !fromServiceWorker, ...(url ? { url } : {}) });
        queueMicrotask(() => {
          const e = new Event('show');
          this.onshow?.(e);
          this.dispatchEvent(e);
        });
      }
      close() {
        live.delete(this.id);
        const e = new Event('close');
        this.onclose?.(e);
        this.dispatchEvent(e);
      }
      static get permission(): NotificationPermission { return 'granted'; }
      static requestPermission(cb?: (p: NotificationPermission) => void) { cb?.('granted'); return Promise.resolve('granted' as const); }
      static get maxActions() { return 0; }
    }
    bridge.onClick((id) => {
      const n = live.get(id);
      if (!n) return;
      const e = new Event('click', { cancelable: true });
      n.onclick?.call(n, e);
      n.dispatchEvent(e);
    });
    Object.defineProperty(window, 'Notification', { value: ExtrovertNotification, writable: true, configurable: true });
    if (typeof ServiceWorkerRegistration !== 'undefined') {
      ServiceWorkerRegistration.prototype.showNotification = function (title: string, options?: NotificationOptions) {
        new ExtrovertNotification(title, options, true);
        return Promise.resolve();
      };
    }

    // --- Camera / microphone / screen in use: report which kinds have live tracks.
    const media = navigator.mediaDevices;
    if (!media) return;
    const tracks = new Map<MediaStreamTrack, string>();
    const report = () => bridge.media([...new Set([...tracks].filter(([t]) => t.readyState === 'live').map(([, k]) => k))]);
    const watch = (stream: MediaStream, screen: boolean) => {
      for (const t of stream.getTracks()) {
        tracks.set(t, screen ? 'screen' : t.kind === 'audio' ? 'mic' : 'camera');
        t.addEventListener('ended', () => {
          tracks.delete(t);
          report();
        });
      }
      report();
      return stream;
    };
    const stop = MediaStreamTrack.prototype.stop;
    MediaStreamTrack.prototype.stop = function () {
      stop.call(this);
      if (tracks.delete(this)) report();
    };
    const getUserMedia = media.getUserMedia.bind(media);
    media.getUserMedia = (c) => getUserMedia(c).then((s) => watch(s, false));
    if (media.getDisplayMedia) {
      const getDisplayMedia = media.getDisplayMedia.bind(media);
      media.getDisplayMedia = (c) => getDisplayMedia(c).then((s) => watch(s, true));
    }
    // "Stop sharing" from Extrovert's banner ends the page's screen tracks, exactly like the browser's own button.
    bridge.onStopScreen(() => {
      for (const [t, k] of tracks) if (k === 'screen') {
        t.stop();
        t.dispatchEvent(new Event('ended'));
      }
    });
  },
});
