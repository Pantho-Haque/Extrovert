/**
 * Every keyboard shortcut and every feature, in one place. The app menu, the "Shortcuts & features"
 * panel, the feature tour, What's new, the README and the landing page are all built from this file,
 * and a test fails when the README or landing page is out of date (`pnpm sync-docs` updates them).
 * Change a feature → change it here.
 */

export type ShortcutGroup = 'Navigate' | 'Services' | 'Privacy' | 'Window';

export interface Shortcut {
  id: string;
  /** Electron accelerator syntax. `1-9` and `Hover` are display-only (not menu accelerators). */
  keys: string;
  label: string;
  group: ShortcutGroup;
}

export const SHORTCUTS = [
  { id: 'palette', keys: 'CmdOrCtrl+K', label: 'Command palette: jump anywhere, or paste a link', group: 'Navigate' },
  { id: 'nextUnread', keys: 'CmdOrCtrl+J', label: 'Next unread, across all accounts', group: 'Navigate' },
  { id: 'service', keys: 'CmdOrCtrl+1-9', label: 'Switch service', group: 'Navigate' },
  { id: 'workspace', keys: 'CmdOrCtrl+Shift+1-9', label: 'Switch account', group: 'Navigate' },
  { id: 'peek', keys: 'Alt+Hover', label: 'Peek at a service without switching', group: 'Navigate' },
  { id: 'notifications', keys: 'CmdOrCtrl+Shift+N', label: 'Notifications', group: 'Navigate' },
  { id: 'back', keys: 'CmdOrCtrl+[', label: 'Back', group: 'Services' },
  { id: 'forward', keys: 'CmdOrCtrl+]', label: 'Forward', group: 'Services' },
  { id: 'reload', keys: 'CmdOrCtrl+R', label: 'Reload service', group: 'Services' },
  { id: 'find', keys: 'CmdOrCtrl+F', label: 'Find in page', group: 'Services' },
  // Not ⇧V: that is "paste as plain text" in browsers, and Electron's Paste and Match Style on Windows/Linux.
  { id: 'replies', keys: 'CmdOrCtrl+Shift+R', label: 'Saved replies', group: 'Services' },
  { id: 'zoomIn', keys: 'CmdOrCtrl+=', label: 'Zoom in', group: 'Services' },
  { id: 'zoomOut', keys: 'CmdOrCtrl+-', label: 'Zoom out', group: 'Services' },
  { id: 'zoomReset', keys: 'CmdOrCtrl+0', label: 'Actual size', group: 'Services' },
  { id: 'addService', keys: 'CmdOrCtrl+N', label: 'Add services', group: 'Services' },
  { id: 'lock', keys: 'CmdOrCtrl+Shift+L', label: 'Lock & blur instantly', group: 'Privacy' },
  { id: 'zen', keys: 'CmdOrCtrl+\\', label: 'Zen mode (hide the sidebar)', group: 'Window' },
  { id: 'guide', keys: 'CmdOrCtrl+/', label: 'Shortcuts & features', group: 'Window' },
  { id: 'settings', keys: 'CmdOrCtrl+,', label: 'Settings', group: 'Window' },
] as const satisfies readonly Shortcut[];

export type ShortcutId = (typeof SHORTCUTS)[number]['id'];

/** A shortcut's keys in accelerator syntax, for the app menu. */
export const accel = (id: ShortcutId): string => SHORTCUTS.find((s) => s.id === id)!.keys;

const MAC_KEYS: Record<string, string> = { CmdOrCtrl: '⌘', Shift: '⇧', Alt: '⌥' };
const PC_KEYS: Record<string, string> = { CmdOrCtrl: 'Ctrl', Shift: 'Shift', Alt: 'Alt' };

/** Keys as people read them: `⌘⇧L` on macOS, `Ctrl+Shift+L` elsewhere. */
export function formatKeys(keys: string, mac: boolean): string {
  const parts = keys.split(/\+(?!$)/).map((k) => (k === '1-9' ? '1–9' : k === 'Hover' ? 'hover' : ((mac ? MAC_KEYS : PC_KEYS)[k] ?? k)));
  if (keys.endsWith('Hover')) return parts.join(' + ');
  return parts.join(mac ? '' : '+');
}

export const keyOf = (id: ShortcutId, mac: boolean): string => formatKeys(accel(id), mac);

export interface Feature {
  title: string;
  /** Two or three words, for the tour's chips. */
  short: string;
  text: string;
  shortcut?: ShortcutId;
  /** Where to find it in the app, when it isn't obvious. */
  where?: string;
  /** macOS only, for now. */
  macOnly?: boolean;
  /** Version that introduced it: What's new lists the features added in the version just installed. */
  added?: string;
  /** UI icon for this feature on the website, when its group's icon doesn't say it. */
  icon?: string;
  /** A few more sentences, for the website's highlight cards. */
  details?: string;
  /**
   * Not offered by Ferdium, Rambox, Wavebox or Shift (competitor research, Oct 2026; see
   * COMPETITIVE_ANALYSIS.md). Shown as a highlight on the website. Re-check before adding one.
   */
  unique?: boolean;
}

export interface FeatureGroup {
  id: string;
  title: string;
  /** One line for the tour and the landing page. */
  tagline: string;
  /** UI icon name (src/renderer/src/icons.tsx). */
  icon: string;
  features: Feature[];
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'workspaces',
    title: 'Workspaces',
    tagline: 'One per Google account. Work and personal never mix.',
    icon: 'users',
    features: [
      { title: 'A workspace per Google account', short: 'Per Google account', text: 'Sign in with Google once per account. Work and personal never mix.' },
      { unique: true, icon: 'users', title: 'Switch accounts in one click', short: 'One-click switch', text: 'The Gmail-style account menu shows every account with its unread count.', shortcut: 'workspace', where: 'Your photo, top of the sidebar', details: 'Each Google account is its own workspace with its own logins. The avatar at the top of the sidebar shows how much is waiting in your other accounts, so you know Work has 12 new things without switching.' },
      { title: 'Several accounts of the same app', short: 'Many accounts per app', text: 'Two WhatsApps or three Gmails sit side by side, grouped and tagged so you never mix them up.' },
      { title: 'Logins stay in their workspace', short: 'Private logins', text: 'Signing out of a workspace deletes its logins and data from this computer.' },
      { title: 'Pause a workspace', short: 'Pause', text: "Paused workspaces don't run in the background, to save memory.", where: 'Settings → Accounts & workspaces' },
      { title: 'Work hours', short: 'Work hours', text: "Outside a workspace's hours, its notifications stay quiet.", where: 'Settings → Accounts & workspaces' },
    ],
  },
  {
    id: 'services',
    title: 'Your apps, untouched',
    tagline: 'The real websites, plus any site you add.',
    icon: 'globe',
    features: [
      { title: 'Facebook, Messenger, WhatsApp, Instagram, LinkedIn and Google apps', short: '10 apps built in', text: 'Gmail, Calendar, Drive, Meet and Chat included. Each runs its real web app.' },
      { title: 'Any website', short: 'Any website', text: 'Paste an address to add any site, as many as you like. It keeps the site\'s own icon, or pick one from the built-in icon pack in any color.', where: 'Add services, or Settings → Services (click its icon)' },
      { title: 'Add several at once', short: 'Add many at once', text: 'Pick every service you want and add them in one go.', shortcut: 'addService' },
      { title: 'One Google sign-in for every Google app', short: 'One Google sign-in', text: 'Sign in once and Gmail, Calendar, Drive, Meet and Chat are all signed in, as that workspace\'s own account.' },
      { title: 'Sign in with your browser', short: 'Sign in with your browser', text: 'Already logged in to these sites in Arc, Chrome, Brave, Edge, Vivaldi, Opera or Chromium? Copy those logins instead of typing passwords. If a copied login expires, Extrovert copies it again by itself.', macOnly: true },
      { title: 'Per-service settings', short: 'Per-app settings', text: 'Mute, badge, sound, zoom and video autoplay for each service. Right-click a service for more.', where: 'Settings → Services' },
    ],
  },
  {
    id: 'attention',
    title: 'Never miss what matters',
    tagline: 'Live badges and real notifications, minus the noise.',
    icon: 'bell',
    features: [
      { title: 'Live unread badges', short: 'Live badges', text: 'On every service, every account, and the dock or tray.' },
      { title: 'Notifications with previews', short: 'Rich notifications', text: "Each service's own notifications, as a banner inside Extrovert while you use it and from your system otherwise, once per message, with a full history.", shortcut: 'notifications' },
      { unique: true, icon: 'zap', title: 'Next unread', short: 'Next unread', text: 'Jump to the next service with something new, across all accounts, until you reach inbox zero.', shortcut: 'nextUnread', details: 'Extrovert keeps one list of everything unread, across every app and every account. Each press takes you to the next one; when nothing is left, it tells you you\'re at inbox zero.' },
      { unique: true, icon: 'msg', title: 'People view', short: 'People view', text: 'See who is waiting on you, grouped by person across platforms.', where: 'Notifications → People', details: 'Notifications are grouped by who sent them, not by app, so Rahim\'s two WhatsApp messages and his LinkedIn message sit together. If someone uses different names on different platforms, link them once.' },
      { unique: true, icon: 'star', title: 'VIPs', short: 'VIPs', text: 'Messages from your VIPs break through Do Not Disturb and digests.', where: 'Settings → Notifications', details: 'Mark someone as a VIP from one of their notifications or in Settings. Their messages still reach you when Do Not Disturb is on or notifications are bundled into a digest, on every app.' },
      { title: 'Do Not Disturb and digest', short: 'DND & digest', text: 'Silence everything, or get one summary every hour instead of constant pings.', where: 'Settings → Notifications' },
      { unique: true, icon: 'clock', title: 'Snooze to the exact chat', short: 'Snooze to the chat', text: 'A snoozed notification reopens that exact conversation when it comes back.', details: 'Snooze a notification for 15 minutes, an hour, until tonight or until tomorrow. When it comes back, clicking it opens that exact conversation, not just the app\'s home page.' },
      { unique: true, icon: 'moon', title: 'While-you-were-away recap', short: 'Away recap', text: 'Back from a break? One card shows who wrote to you, and where.', details: 'Come back to your computer after a while (15 minutes by default) and one card lists who wrote to you, on which app. Click any line to go straight there.' },
      { unique: true, icon: 'alert', title: 'Login watchdog', short: 'Login watchdog', text: "If a service signs you out, you're told right away instead of silently missing messages.", details: 'Some apps sign you out quietly, and other hubs then show zero forever. Extrovert notices when a service loses its login, marks it and tells you once. Logins copied from your browser are copied again by themselves.' },
    ],
  },
  {
    id: 'flow',
    title: 'Stay in flow',
    tagline: 'Get anywhere in a keystroke.',
    icon: 'zap',
    features: [
      { title: 'Command palette', short: 'Command palette', text: 'Jump to any service, pin or action. Paste a link and it opens in the right app.', shortcut: 'palette' },
      { title: 'Smart links', short: 'Smart links', text: 'An Instagram link sent on WhatsApp opens in your Instagram, not a browser.' },
      { unique: true, icon: 'expand', title: 'Peek', short: 'Peek', text: 'See a live snapshot of another service without switching.', shortcut: 'peek', details: 'Hold Option (Alt on Windows and Linux) and move over any app in the sidebar to see a live snapshot of it. Let go and you\'re right where you were.' },
      { title: 'Pins', short: 'Pins', text: 'Save any page inside a service, a group, a profile, a chat, and get back in one click.', where: 'Right-click a service' },
      { title: 'Saved replies', short: 'Saved replies', text: 'Paste text you type often into any chat.', shortcut: 'replies' },
      { title: 'Find, back and forward', short: 'Find & navigate', text: 'Browser basics that work in every service.', shortcut: 'find' },
      { title: 'Zen mode', short: 'Zen mode', text: 'Hide the sidebar so the service fills the window.', shortcut: 'zen' },
      { title: 'Downloads', short: 'Downloads', text: 'Everything you downloaded from any service, in one list.', where: 'Download icon, bottom of the sidebar' },
      { title: 'Menu bar mini view', short: 'Menu bar view', text: 'Unread counts and the latest notifications, without opening the window.', where: 'Extrovert icon in the menu bar or tray' },
    ],
  },
  {
    id: 'privacy',
    title: 'Calls & privacy',
    tagline: 'Your screen, your rules.',
    icon: 'shield',
    features: [
      { unique: true, icon: 'mic', title: 'Camera, mic and screen indicators', short: 'Mic & camera dots', text: 'A live dot shows which service is using your camera, microphone or screen.', details: 'A red dot on an app\'s icon shows the moment it uses your camera, microphone or screen, even in an account you\'re not looking at.' },
      { unique: true, icon: 'phone', title: 'Call bubble', short: 'Call bubble', text: 'Switch away during a call and it keeps going in a small floating window.', details: 'Start a call in WhatsApp, Messenger or Meet, then switch to another app: the call moves into a small window that stays on top. Click it to go back to the call.' },
      { unique: true, icon: 'screen', title: 'Screen-share shield', short: 'Share shield', text: 'While you share your screen, previews and other accounts are hidden automatically.', details: 'While you share your screen from any app, notification previews and your other accounts\' unread counts are hidden, so nothing private shows up in the meeting.' },
      { title: 'Lock & blur', short: 'Lock & blur', text: 'Blur and lock the whole app instantly, with a PIN or Touch ID. Optionally when you step away.', shortcut: 'lock', where: 'Settings → Privacy & security' },
      { title: 'Permissions dashboard', short: 'Permissions', text: 'See and revoke camera, microphone, screen, notification and location access per service.', where: 'Settings → Privacy & security' },
      { title: 'Per-workspace proxy', short: 'Workspace proxy', text: 'Route only one workspace through a proxy, such as your office network.', where: 'Settings → Accounts & workspaces' },
      { title: 'No tracking', short: 'No tracking', text: 'No analytics, no account with us, no server. Everything stays on your computer.' },
    ],
  },
  {
    id: 'wellbeing',
    title: 'Social media on your terms',
    tagline: 'See where your time goes. Set your own limits.',
    icon: 'coffee',
    features: [
      { unique: true, icon: 'chart', title: 'Time insights', short: 'Time insights', text: 'Private time per service and account, today and this week. Only counts while you actually use it.', where: 'Chart icon, bottom of the sidebar', details: 'See how long you spend in each app and account, today and this week. Time only counts while the app is on screen and you\'re actually using it or watching something. It never leaves your computer.' },
      { unique: true, icon: 'coffee', title: 'Feed guard', short: 'Feed guard', text: 'Daily budgets for feeds, with a gentle "still want to scroll?" Messaging is never limited.', where: 'Settings → Wellbeing', details: 'Set daily budgets for Facebook, Instagram and LinkedIn. After a stretch of scrolling, a gentle card asks whether to keep going or take a break. Chats are never limited, and it\'s off until you turn it on.' },
      { title: 'No autoplay in feeds', short: 'No autoplay', text: 'Videos in Facebook, Instagram and LinkedIn feeds wait for you to press play.', where: 'Settings → Services' },
    ],
  },
  {
    id: 'performance',
    title: 'Fast and dependable',
    tagline: 'Opens fast, recovers by itself.',
    icon: 'activity',
    features: [
      { title: 'Staggered startup', short: 'Fast startup', text: 'Your last service opens first; the rest load quietly, messaging apps first.' },
      { title: 'Auto-recover', short: 'Auto-recover', text: 'After sleep or a Wi-Fi change, stuck services reload by themselves.' },
      { title: 'Smart sleep', short: 'Smart sleep', text: 'When memory runs low, idle feeds sleep first. Messaging apps stay awake.' },
      { title: 'Task manager', short: 'Task manager', text: 'Memory and CPU per service, with reload and sleep buttons.', where: 'Command palette → Task manager' },
    ],
  },
  {
    id: 'switching',
    title: 'Easy to switch, easy to trust',
    tagline: 'Free, open source, yours to keep.',
    icon: 'upload',
    features: [
      { title: 'Import from Ferdium', short: 'Ferdium import', text: 'Bring your Ferdium services over in one step.', where: 'Settings → Import & export' },
      { title: 'Export and import your setup', short: 'Export & import', text: 'Move your workspaces and settings to another computer as a file.', where: 'Settings → Import & export' },
      { title: 'Updates from GitHub', short: 'Auto updates', text: 'New versions come from GitHub Releases: installed on restart on Windows and Linux, a one-click download on macOS. Beta channel available.', where: 'Settings → Updates' },
      { title: 'Report a problem', short: 'Report a problem', text: 'Fills in a GitHub bug report for you, with app and system details but no personal data. You submit it on GitHub with a free account.', where: 'Shortcuts & features (⌘ button in the sidebar), Help menu, or ⌘K' },
    ],
  },
];

/** Features added in a given version, for What's new. */
export const addedIn = (version: string): Feature[] => FEATURE_GROUPS.flatMap((g) => g.features.filter((f) => f.added === version));
