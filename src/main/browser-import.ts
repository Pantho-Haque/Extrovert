/**
 * "Sign in with your browser": copies a service's login cookies from a browser the user already
 * uses (Arc, Chrome, Brave, …) into that service's own Extrovert session. Runs only when the user
 * clicks Import; macOS asks them to allow reading the browser's cookie key. Nothing leaves the Mac.
 */
import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { promisify } from 'node:util';
import { app, session } from 'electron';
import { decryptMacCookie, deriveMacKey, toCookieToSet, type ChromiumCookieRow } from '../core/browser-import/chromium-cookies';
import { domainsOf, isServiceUrl } from '../core/services/catalog';
import { instanceName, partitionFor, startUrl } from '../core/workspaces/model';
import type { BrowserInfo, ImportResult } from '../shared/ipc';
import type { LoginSource, Workspace } from '../shared/types';
import type { Extrovert } from './app';

const run = promisify(execFile);

interface BrowserDef {
  id: string;
  name: string;
  /** Folder under ~/Library/Application Support. */
  dataDir: string;
  /** macOS keychain item holding the cookie encryption password. */
  keychainService: string;
  /** Opera keeps its single profile in the data folder itself. */
  profileInRoot?: boolean;
}

// ponytail: Chromium-family browsers on macOS only. Windows/Linux keys (DPAPI/libsecret), Firefox and Safari come later; manual login always works.
const BROWSERS: BrowserDef[] = [
  { id: 'arc', name: 'Arc', dataDir: 'Arc/User Data', keychainService: 'Arc Safe Storage' },
  { id: 'chrome', name: 'Google Chrome', dataDir: 'Google/Chrome', keychainService: 'Chrome Safe Storage' },
  { id: 'brave', name: 'Brave', dataDir: 'BraveSoftware/Brave-Browser', keychainService: 'Brave Safe Storage' },
  { id: 'edge', name: 'Microsoft Edge', dataDir: 'Microsoft Edge', keychainService: 'Microsoft Edge Safe Storage' },
  { id: 'vivaldi', name: 'Vivaldi', dataDir: 'Vivaldi', keychainService: 'Vivaldi Safe Storage' },
  { id: 'opera', name: 'Opera', dataDir: 'com.operasoftware.Opera', keychainService: 'Opera Safe Storage', profileInRoot: true },
  { id: 'chromium', name: 'Chromium', dataDir: 'Chromium', keychainService: 'Chromium Safe Storage' },
];

/** WhatsApp's login is device keys, not cookies: it always needs a QR scan. */
export const QR_ONLY = new Set(['whatsapp']);

const supportDir = () => join(homedir(), 'Library', 'Application Support');
const cookieFile = (profileDir: string) => [join(profileDir, 'Network', 'Cookies'), join(profileDir, 'Cookies')].find(existsSync);

/** Installed browsers with at least one profile that has saved cookies. */
export function listBrowsers(): BrowserInfo[] {
  if (process.platform !== 'darwin') return [];
  const defaultName = app.getApplicationNameForProtocol('https://').replace(/\.app$/, '').toLowerCase();
  return BROWSERS.flatMap((b) => {
    const profiles = profilesOf(b).filter((p) => cookieFile(join(supportDir(), b.dataDir, p.dir)));
    if (!profiles.length) return [];
    const isDefault = !!defaultName && (b.name.toLowerCase() === defaultName || defaultName.includes(b.id));
    return [{ id: b.id, name: b.name, profiles, isDefault }];
  });
}

function profilesOf(b: BrowserDef): BrowserInfo['profiles'] {
  if (b.profileInRoot) return [{ dir: '', name: 'Default' }];
  try {
    const state = JSON.parse(readFileSync(join(supportDir(), b.dataDir, 'Local State'), 'utf8'));
    const cache: Record<string, { name?: string }> = state?.profile?.info_cache ?? {};
    const found = Object.entries(cache).map(([dir, info]) => ({ dir, name: info.name || dir }));
    return found.length ? found : [{ dir: 'Default', name: 'Default' }];
  } catch {
    return [{ dir: 'Default', name: 'Default' }];
  }
}

/**
 * Copies the logins into Extrovert. `fresh` (used when an imported login expired) first drops the
 * session's old cookies, so nothing stale is left next to the new ones.
 */
export async function importSignIns(xt: Extrovert, req: { workspaceId: string; browserId: string; profileDir: string; instanceIds: string[]; fresh?: boolean }): Promise<ImportResult[]> {
  // Validate everything from the UI against what we detected ourselves: never trust a path from the renderer.
  const browser = BROWSERS.find((b) => b.id === req.browserId);
  const listed = listBrowsers().find((b) => b.id === req.browserId);
  const ws = xt.store.workspace(req.workspaceId);
  if (!browser || !ws || !listed?.profiles.some((p) => p.dir === req.profileDir)) throw new Error('Unknown browser or profile');
  const targets = ws.instances.filter((i) => req.instanceIds.includes(i.id) && !QR_ONLY.has(i.type));

  const source = cookieFile(join(supportDir(), browser.dataDir, req.profileDir))!;
  const key = deriveMacKey(await readKeychainPassword(browser));
  const tmp = mkdtempSync(join(tmpdir(), 'extrovert-import-')); // 0700: only this user can read the copy
  try {
    // The browser keeps its database open, so read a private copy (with its write-ahead log, if any).
    const db = join(tmp, 'Cookies');
    copyFileSync(source, db);
    if (existsSync(`${source}-wal`)) copyFileSync(`${source}-wal`, `${db}-wal`);
    const { rows, schema } = readCookies(db);
    const now = Math.floor(Date.now() / 1000);
    const copyInto = async (ses: Electron.Session, domains: string[]) => {
      let imported = 0;
      let failed = 0;
      const matching = rows.filter((row) => isServiceUrl({ domains }, `https://${row.host_key.replace(/^\./, '')}/`));
      if (req.fresh && matching.length) await ses.clearStorageData({ storages: ['cookies'] });
      for (const row of matching) {
        try {
          const value = row.encrypted_value.length ? decryptMacCookie(row.encrypted_value, key, schema) : row.value;
          const cookie = toCookieToSet(row, value, now);
          if (!cookie) continue;
          await ses.cookies.set(cookie);
          imported++;
        } catch {
          failed++;
        }
      }
      return { imported, failed };
    };

    // Services sharing a login (all Google apps) share its cookies: import into each login once.
    const done = new Map<string, Promise<{ imported: number; failed: number }>>();
    return await Promise.all(targets.map(async (inst): Promise<ImportResult> => {
      const ses = session.fromPartition(partitionFor(ws.id, inst.session));
      const domains = ws.instances.filter((i) => i.session === inst.session).flatMap((i) => domainsOf(i.type, i.url));
      if (!done.has(inst.session)) done.set(inst.session, copyInto(ses, domains));
      const { imported, failed } = await done.get(inst.session)!;
      if (imported) {
        // Remember the browser, so this login can be copied again by itself when it expires.
        ws.loginSources = { ...ws.loginSources, [inst.session]: { browserId: browser.id, browserName: browser.name, profileDir: req.profileDir } };
        // Start from the service's home page with the new cookies, as if freshly signed in.
        inst.signedInOnce = true;
        xt.store.patchStatus(inst.id, { state: 'loading' });
        // Google apps open as this workspace's own account, not the browser's first one.
        if (xt.views.has(inst.id)) void xt.views.webContents(inst.id)?.loadURL(startUrl(ws, inst));
        else xt.wake(ws, inst);
      }
      return {
        instanceId: inst.id,
        imported,
        ...(imported ? {} : { error: failed ? "Couldn't read this browser's saved logins" : `Not logged in to ${instanceName(inst)} in ${browser.name}` }),
      };
    }));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    xt.store.save('profile');
  }
}

/** Copies an expired login again from the browser it first came from. True if anything was copied. */
export async function resyncSignIn(xt: Extrovert, ws: Workspace, source: LoginSource, instanceIds: string[]): Promise<boolean> {
  const results = await importSignIns(xt, { workspaceId: ws.id, browserId: source.browserId, profileDir: source.profileDir, instanceIds, fresh: true });
  return results.some((r) => r.imported > 0);
}

function readCookies(path: string): { rows: ChromiumCookieRow[]; schema: number } {
  const db = new DatabaseSync(path);
  try {
    const meta = db.prepare("SELECT value FROM meta WHERE key = 'version'").get() as { value: string } | undefined;
    const query = db.prepare('SELECT * FROM cookies');
    query.setReadBigInts(true);
    return { rows: query.all() as unknown as ChromiumCookieRow[], schema: Number(meta?.value ?? 0) };
  } finally {
    db.close();
  }
}

// Kept in memory only, so a re-sync doesn't ask macOS again while the app runs. Never written to disk.
const passwords = new Map<string, string>();

/** macOS shows its own "allow access" prompt here; the user can deny, and we never store the password. */
async function readKeychainPassword(browser: BrowserDef): Promise<string> {
  const cached = passwords.get(browser.id);
  if (cached) return cached;
  try {
    const { stdout } = await run('security', ['find-generic-password', '-w', '-s', browser.keychainService], { timeout: 120_000 });
    passwords.set(browser.id, stdout.trim());
    return stdout.trim();
  } catch {
    throw new Error(`macOS didn't allow access to ${browser.name}'s saved logins. Click "Allow" when asked.`);
  }
}
