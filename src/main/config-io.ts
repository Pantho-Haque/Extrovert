/** Import from Ferdium (FR-X27) and configuration backup (FR-P05). Logins are never exported. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dialog } from 'electron';
import { parseFerdiumExport } from '../core/import/ferdium';
import { loadSettings } from '../core/settings/defaults';
import type { Workspace } from '../shared/types';
import type { Extrovert } from './app';

export async function importFerdium(app: Extrovert, workspaceId: string): Promise<{ added: number; skipped: string[] } | null> {
  const res = await dialog.showOpenDialog(app.win, { title: 'Choose your Ferdium export', filters: [{ name: 'Ferdium export', extensions: ['json', 'ferdium-data'] }], properties: ['openFile'] });
  const file = res.filePaths[0];
  if (res.canceled || !file) return null;
  const parsed = parseFerdiumExport(readFileSync(file, 'utf8'));
  const ids = app.addInstances(workspaceId, parsed.services);
  return { added: ids.length, skipped: parsed.skipped };
}

export async function exportConfig(app: Extrovert): Promise<boolean> {
  const res = await dialog.showSaveDialog(app.win, { title: 'Export Extrovert configuration', defaultPath: 'extrovert-config.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
  if (res.canceled || !res.filePath) return false;
  // Workspaces and settings only. Logins live in each service's session and never leave this device.
  const data = { app: 'extrovert', version: 1, workspaces: app.store.workspaces.map(({ picture: _p, ...w }) => w), settings: { ...app.store.settings, appLock: { ...app.store.settings.appLock, pinHash: undefined } } };
  writeFileSync(res.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  app.toast('Configuration exported. It contains no passwords or logins.');
  return true;
}

export async function importConfig(app: Extrovert): Promise<boolean> {
  const res = await dialog.showOpenDialog(app.win, { title: 'Import Extrovert configuration', filters: [{ name: 'JSON', extensions: ['json'] }], properties: ['openFile'] });
  const file = res.filePaths[0];
  if (res.canceled || !file) return false;
  const data = JSON.parse(readFileSync(file, 'utf8')) as { app?: string; workspaces?: Workspace[]; settings?: unknown };
  if (data.app !== 'extrovert' || !Array.isArray(data.workspaces)) throw new Error("This file isn't an Extrovert configuration.");
  // Merge: workspaces for Google accounts already here keep their services; new ones are added (signed out).
  let added = 0;
  for (const ws of data.workspaces) {
    if (app.store.workspaces.some((w) => w.googleSub === ws.googleSub)) continue;
    app.store.workspaces.push({ ...ws, suspended: true });
    added++;
  }
  app.store.settings = loadSettings({ ...(data.settings as object), appLock: app.store.settings.appLock });
  app.store.save('profile', 'settings');
  app.toast(`Imported settings${added ? ` and ${added} workspace${added > 1 ? 's' : ''} (paused until you open them)` : ''}.`);
  return true;
}
