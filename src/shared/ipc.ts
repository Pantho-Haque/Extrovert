/**
 * Typed contract between the main process and every UI surface (shell, toasts, find bar, peek, tray).
 * Main owns all state and pushes one snapshot; the UI asks for changes through named actions.
 */
import type { DownloadEntry, Instance, InstanceStatus, NotificationEntry, ServiceType, Settings, Workspace, WorkHours } from './types';
import type { SnoozeChoice } from '../core/notifications/rules';
import type { Severity } from '../core/feedback/issue';

export const CH = {
  state: 'state',
  getState: 'get-state',
  action: 'action',
  /** Main → UI one-off commands (open palette, open settings…). */
  command: 'command',
} as const;

export interface Toast {
  id: string;
  text: string;
  tone?: 'info' | 'warn';
  actions?: { label: string; action: ActionName; payload?: unknown }[];
  persistent?: boolean;
}

export interface PermissionPrompt {
  id: string;
  workspaceId: string;
  instanceId: string;
  /** What the page asked for, in plain words: "camera", "microphone", "camera and microphone". */
  what: string;
}

export interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface Runtime {
  zen: boolean;
  locked: boolean;
  overlay: boolean;
  online: boolean;
  signingIn: boolean;
  touchId: boolean;
  sharing: { workspaceId: string; instanceId: string } | null;
  call: { workspaceId: string; instanceId: string; startedAt: number; inBubble: boolean } | null;
  outsideHours: Record<string, boolean>;
  recap: { since: number; until: number } | null;
  feedGuard: { workspaceId: string; instanceId: string; todayMin: number; budgetMin?: number } | null;
  permissionPrompt: PermissionPrompt | null;
  screenPicker: { instanceId: string; sources: ScreenSource[] } | null;
  update: { version: string; ready: boolean; notes?: string } | null;
  find: { matches: number; active: number } | null;
  toasts: Toast[];
  peek: { workspaceId: string; instanceId: string; image: string } | null;
  /** Blurred snapshot shown behind the lock screen. */
  lockImage: string | null;
  /** Set after an update was installed: show What's new once. */
  whatsNew: string | null;
}

export interface AppSnapshot {
  platform: NodeJS.Platform;
  version: string;
  googleConfigured: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  settings: Settings;
  statuses: Record<string, InstanceStatus>;
  notifications: NotificationEntry[];
  snoozed: { entry: NotificationEntry; until: number }[];
  digest: NotificationEntry[];
  downloads: DownloadEntry[];
  usage: { today: Record<string, number>; week: { day: string; seconds: number }[] };
  runtime: Runtime;
}

export interface BrowserInfo {
  id: string;
  name: string;
  /** `dir` is the profile folder name, e.g. "Default" or "Profile 1". */
  profiles: { dir: string; name: string }[];
  /** The system's default browser, preselected (the user can pick any other). */
  isDefault: boolean;
}

export interface ImportResult {
  instanceId: string;
  imported: number;
  error?: string;
}

export interface InstanceMetrics {
  instanceId: string;
  memoryMB: number;
  cpu: number;
}

type Ref = { workspaceId: string; instanceId: string };

/** Every action the UI can request: name → [payload, result]. Main validates each payload. */
export interface Actions {
  selectWorkspace: [{ workspaceId: string }, void];
  selectInstance: [Ref, void];
  signIn: [void, { ok: boolean; error?: string }];
  cancelSignIn: [void, void];
  signOut: [{ workspaceId: string }, void];
  signOutAll: [void, void];
  updateWorkspace: [{ workspaceId: string; patch: Partial<Pick<Workspace, 'name' | 'color' | 'suspended' | 'proxy'>> & { workHours?: WorkHours } }, void];
  addInstances: [{ workspaceId: string; items: { type: ServiceType; url?: string; label?: string; icon?: string; color?: string }[] }, string[]];
  updateInstance: [Ref & { patch: Partial<Pick<Instance, 'label' | 'tag' | 'url' | 'enabled' | 'muted' | 'alerts' | 'sound' | 'badge' | 'autoplay' | 'permissions' | 'icon' | 'color'>> }, void];
  removeInstance: [Ref, void];
  instanceMenu: [Ref, void];
  reload: [Partial<Ref>, void];
  sleep: [Ref, void];
  wake: [Ref, void];
  signInAgain: [Ref, void];
  zoom: [Ref & { delta: number }, void];
  updateSettings: [{ patch: Partial<Settings> }, void];
  setOverlay: [{ open: boolean }, void];
  nextUnread: [void, void];
  openNotification: [{ id: string }, void];
  snooze: [{ id: string; choice: SnoozeChoice }, void];
  toggleVip: [{ name: string }, void];
  linkNames: [{ name: string; to: string }, void];
  deliverDigest: [void, void];
  clearHistory: [void, void];
  dismissRecap: [void, void];
  openLink: [Ref & { url: string }, void];
  openExternal: [{ url: string }, void];
  pinPage: [Ref, void];
  openPin: [{ id: string }, void];
  removePin: [{ id: string }, void];
  insertReply: [{ text: string }, void];
  find: [{ text: string; forward?: boolean; next?: boolean }, void];
  stopFind: [void, void];
  peek: [Ref & { x: number; y: number }, void];
  hidePeek: [void, void];
  toggleZen: [void, void];
  lock: [void, void];
  unlock: [{ pin?: string; touchId?: boolean }, { ok: boolean }];
  setPin: [{ pin: string | null }, void];
  returnToCall: [void, void];
  stopSharing: [void, void];
  pickScreen: [{ sourceId: string | null }, void];
  answerPermission: [{ id: string; allow: boolean }, void];
  feedGuard: [{ choice: 'continue' | 'break' }, void];
  metrics: [void, InstanceMetrics[]];
  listBrowsers: [void, BrowserInfo[]];
  importSignIns: [{ workspaceId: string; browserId: string; profileDir: string; instanceIds: string[] }, ImportResult[]];
  importFerdium: [{ workspaceId: string }, { added: number; skipped: string[] } | null];
  exportConfig: [void, boolean];
  importConfig: [void, boolean];
  openDownload: [{ id: string; reveal: boolean }, void];
  clearDownloads: [void, void];
  checkUpdates: [void, void];
  installUpdate: [void, void];
  systemInfo: [void, string];
  reportProblem: [{ title: string; details: string; severity: Severity; where: string }, void];
  dismissToast: [{ id: string }, void];
  toast: [{ text: string }, void];
  showMainWindow: [void, void];
  setOnline: [{ online: boolean }, void];
  copyText: [{ text: string }, void];
  dismissWhatsNew: [void, void];
  openBrowserImport: [void, void];
  /** Floating panels (toasts, find bar, peek) report their content size so main can size their view. */
  resizeFloating: [{ name: FloatingName; width: number; height: number }, void];
}

export type FloatingName = 'toasts' | 'find' | 'peek';

export type ActionName = keyof Actions;
export type ActionPayload<K extends ActionName> = Actions[K][0];
export type ActionResult<K extends ActionName> = Actions[K][1];

/** Commands main sends to the shell (from menu shortcuts). */
export type ShellCommand = 'palette' | 'replies' | 'settings' | 'notifications' | 'accountMenu' | 'addService' | 'insights' | 'taskManager' | 'find' | 'browserImport' | 'guide' | 'tour' | 'feedback';

export interface ExtrovertApi {
  platform: NodeJS.Platform;
  getState(): Promise<AppSnapshot>;
  onState(listener: (state: AppSnapshot) => void): () => void;
  onCommand(listener: (command: ShellCommand) => void): () => void;
  do<K extends ActionName>(action: K, ...payload: ActionPayload<K> extends void ? [] : [ActionPayload<K>]): Promise<ActionResult<K>>;
}
