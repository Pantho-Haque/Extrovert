/** Domain types shared by every layer. Types only: no runtime code. */

export type ServiceType =
  | 'facebook' | 'messenger' | 'whatsapp' | 'instagram' | 'linkedin'
  | 'gmail' | 'calendar' | 'drive' | 'meet' | 'chat' | 'custom';

export type ServiceKind = 'feed' | 'chat' | 'mail' | 'tool' | 'call' | 'custom';

/** One running copy of a service inside a workspace (e.g. a second WhatsApp account). */
export interface Instance {
  id: string;
  type: ServiceType;
  /**
   * Which login this service uses inside its workspace. Google apps share one ("google"), Facebook and
   * Messenger share one ("meta"); everything else, and a second account of the same app, has its own (its id).
   */
  session: string;
  /** Nickname, e.g. "WhatsApp · Business". */
  label?: string;
  /** Short tag shown on the icon when a workspace has several of the same service. */
  tag?: string;
  /** Custom services, or an override of the catalog URL. */
  url?: string;
  enabled: boolean;
  muted: boolean;
  /** Per-instance notification controls (FR-A09). */
  alerts: boolean;
  sound: boolean;
  badge: boolean;
  autoplay: boolean;
  zoom: number;
  /** Set once the service has been seen signed in, so a later logout can be flagged (FR-X02). */
  signedInOnce?: boolean;
  /** Last time a title count or notification arrived (FR-A08 badge health). */
  lastSignalAt?: number;
  /** Remembered answers to the page's permission requests (FR-S06, FR-X28). */
  permissions: Partial<Record<DevicePermission, boolean>>;
}

export type DevicePermission = 'camera' | 'microphone' | 'location';

export interface WorkHours {
  enabled: boolean;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  start: string; // "09:00"
  end: string; // "18:00"
}

/** One per Google account. Its services' sessions are isolated from every other workspace. */
export interface Workspace {
  id: string;
  googleSub: string;
  name: string;
  email: string;
  color: string;
  /** Google profile photo as a data: URL. */
  picture?: string;
  instances: Instance[];
  activeInstanceId?: string;
  suspended: boolean;
  workHours: WorkHours;
  proxy?: string;
}

export interface Pin {
  id: string;
  workspaceId: string;
  instanceId: string;
  title: string;
  url: string;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  dnd: boolean;
  digest: { enabled: boolean; intervalMin: number };
  previews: boolean;
  awayRecap: { enabled: boolean; afterMin: number };
  historyDays: number;
  vips: string[];
  replies: string[];
  /** Different names for the same person across platforms → canonical name (FR-X07). */
  personLinks: Record<string, string>;
  pins: Pin[];
  appLock: { enabled: boolean; pinHash?: string; afterIdleMin: number };
  blurOnIdle: boolean;
  shareShield: boolean;
  trackerBlocking: boolean;
  keepBackgroundRunning: boolean;
  smartHibernation: boolean;
  hibernateAfterMin: number;
  usageTracking: boolean;
  feedGuard: { enabled: boolean; budgets: Partial<Record<ServiceType, number>>; nudgeAfterMin: number };
  sidebarLabels: boolean;
  language: string;
  updates: { channel: 'stable' | 'beta'; autoCheck: boolean };
  launchAtLogin: boolean;
}

export interface NotificationEntry {
  id: string;
  workspaceId: string;
  instanceId: string;
  sender: string;
  body: string;
  at: number;
  /** The page's own notification id, used to reopen the exact chat (FR-X03). */
  pageId?: string;
}

export type InstanceState = 'loading' | 'live' | 'signedout' | 'sleeping' | 'offline' | 'crashed';
export type MediaKind = 'mic' | 'camera' | 'screen';

/** Runtime status of an instance (not persisted). */
export interface InstanceStatus {
  state: InstanceState;
  /** From the platform's login cookie; undefined for services without one (WhatsApp, custom sites). */
  signedIn?: boolean;
  unread: number;
  /** Something new but no number (e.g. Calendar). */
  dot: boolean;
  title: string;
  url: string;
  icon?: string;
  media: MediaKind[];
  error?: string;
  memoryMB?: number;
  cpu?: number;
}

export interface DownloadEntry {
  id: string;
  name: string;
  path: string;
  bytes: number;
  received: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
  workspaceId: string;
  instanceId: string;
  at: number;
}
