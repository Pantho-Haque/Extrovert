import { useEffect, useState } from 'react';
import type { AppSnapshot, ExtrovertApi } from '../../shared/ipc';
import type { Instance, Workspace } from '../../shared/types';

export const api: ExtrovertApi = window.extrovert;

/** Ask main to do something. Typed by the shared action contract. */
export const act: ExtrovertApi['do'] = (...args) => api.do(...args);

/** The latest app state, pushed by main. */
export function useSnapshot(): AppSnapshot | null {
  const [snap, setSnap] = useState<AppSnapshot | null>(null);
  useEffect(() => {
    let alive = true;
    void api.getState().then((s) => alive && s && setSnap(s));
    const off = api.onState(setSnap);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return snap;
}

/** Follows the user's theme choice, including "System". */
export function useTheme(theme: 'light' | 'dark' | 'system' | undefined): void {
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme = theme === 'system' || !theme ? (media.matches ? 'dark' : 'light') : theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

export const findInstance = (snap: AppSnapshot, instanceId: string): { ws: Workspace; inst: Instance } | undefined => {
  for (const ws of snap.workspaces) {
    const inst = ws.instances.find((i) => i.id === instanceId);
    if (inst) return { ws, inst };
  }
  return undefined;
};

export function fmtMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export function timeAgo(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const isMac = api.platform === 'darwin';
export const mod = isMac ? '⌘' : 'Ctrl+';
