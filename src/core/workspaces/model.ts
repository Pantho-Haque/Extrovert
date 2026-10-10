/** Workspaces (one per Google account) and the service instances inside them. Pure functions. */
import type { Instance, ServiceType, WorkHours, Workspace } from '../../shared/types';
import { serviceDef } from '../services/catalog';

export const WORKSPACE_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#EF4444'];

/** FR-W05: login storage is isolated per workspace; inside one, services that share a login share it. */
export const partitionFor = (workspaceId: string, session: string) => `persist:${workspaceId}:${session}`;

/**
 * The login a new service uses. One Google sign-in covers Gmail, Calendar, Drive, Meet and Chat, and
 * Facebook and Messenger share one Meta login. A second account of an app the workspace already has
 * gets its own, so the two accounts stay apart.
 */
export function defaultSession(type: ServiceType, siblings: Pick<Instance, 'type'>[], id: string): string {
  if (siblings.some((i) => i.type === type)) return id;
  if (serviceDef(type).group === 'google') return 'google';
  if (type === 'facebook' || type === 'messenger') return 'meta';
  return id;
}

/** Folder (inside the app's Partitions folder) that holds a login's storage on disk. */
export const partitionFolder = (workspaceId: string, session: string) => encodeURIComponent(`${workspaceId}:${session}`);

/**
 * Moving to shared logins: workspaces created before every service stored its `session` used one
 * login per service (named after the service's id). Assign sessions the new way and say which old
 * folder to move into each shared login, so nobody is signed out by the change: the first Gmail's
 * login becomes the workspace's Google login, the first Facebook's becomes its Meta login.
 */
export function migrateSessions(ws: Workspace): { from: string; to: string }[] {
  const moves: { from: string; to: string }[] = [];
  const seen: Instance[] = [];
  for (const inst of ws.instances) {
    if (!inst.session) {
      inst.session = defaultSession(inst.type, seen, inst.id);
      const target = partitionFolder(ws.id, inst.session);
      if (inst.session !== inst.id && !moves.some((m) => m.to === target)) moves.push({ from: partitionFolder(ws.id, inst.id), to: target });
    }
    seen.push(inst);
  }
  return moves;
}

/**
 * Login storage folders (in the app's Partitions folder) that no longer belong to any workspace's
 * service, so they can be deleted: logins live and die with their workspace. Only "<workspace>:<instance>"
 * folders are ever considered; anything else in that folder is left alone.
 */
export function orphanPartitionFolders(folders: string[], workspaces: Pick<Workspace, 'id' | 'instances'>[]): string[] {
  const keep = new Set(workspaces.flatMap((w) => w.instances.map((i) => partitionFolder(w.id, i.session).toLowerCase())));
  return folders.filter((name) => /%3a/i.test(name) && !keep.has(name.toLowerCase()));
}

export const instanceName = (i: Pick<Instance, 'type' | 'label'>): string => i.label || serviceDef(i.type).name;
export const instanceUrl = (i: Pick<Instance, 'type' | 'url'>): string => i.url || serviceDef(i.type).url;

/**
 * Where a service opens. A browser holds every signed-in Google account in one shared set of cookies,
 * so Google apps are told which account to open: the workspace's own Google account. Only the first
 * instance of each Google app gets this; a second Gmail added on purpose is left to its own choice.
 */
export function startUrl(ws: Pick<Workspace, 'email'>, inst: Pick<Instance, 'type' | 'url' | 'session'>): string {
  const base = instanceUrl(inst);
  // Only the workspace's shared Google login opens as the workspace's account; a second Gmail picks its own.
  if (inst.session !== 'google' || inst.url || !ws.email) return base;
  const u = new URL(base);
  u.searchParams.set('authuser', ws.email);
  return u.href;
}

export const defaultWorkHours = (): WorkHours => ({ enabled: false, days: [1, 2, 3, 4, 5], start: '09:00', end: '18:00' });

export function newWorkspace(
  profile: { sub: string; name: string; email: string; picture?: string },
  existing: Workspace[],
  id: string,
): Workspace {
  const used = new Set(existing.map((w) => w.color));
  const color = WORKSPACE_COLORS.find((c) => !used.has(c)) ?? WORKSPACE_COLORS[existing.length % WORKSPACE_COLORS.length]!;
  return {
    id,
    googleSub: profile.sub,
    name: profile.name.split(' ')[0] || profile.email,
    email: profile.email,
    color,
    ...(profile.picture ? { picture: profile.picture } : {}),
    instances: [],
    suspended: false,
    workHours: defaultWorkHours(),
  };
}

/**
 * A new instance. When the workspace already has this service, the copy gets a numbered
 * label and tag ("WhatsApp 2" / "2") so the two accounts stay distinguishable (FR-S03).
 */
export function newInstance(
  type: ServiceType,
  siblings: Instance[],
  id: string,
  opts: { label?: string; url?: string; icon?: string; color?: string } = {},
): Instance {
  const same = siblings.filter((i) => i.type === type).length;
  const label = opts.label ?? (type !== 'custom' && same > 0 ? `${serviceDef(type).name} ${same + 1}` : undefined);
  return {
    id,
    type,
    session: defaultSession(type, siblings, id),
    ...(label ? { label } : {}),
    ...(opts.url ? { url: opts.url } : {}),
    ...(opts.icon ? { icon: opts.icon } : {}),
    ...(opts.color ? { color: opts.color } : {}),
    enabled: true,
    muted: false,
    alerts: true,
    sound: true,
    badge: true,
    autoplay: serviceDef(type).kind !== 'feed',
    zoom: 100,
    permissions: {},
  };
}

/** Same-type instances sit together in the sidebar, in order of first appearance. */
export function groupInstances(instances: Instance[]): Instance[][] {
  const groups = new Map<string, Instance[]>();
  for (const i of instances) {
    if (!groups.has(i.type)) groups.set(i.type, []);
    groups.get(i.type)!.push(i);
  }
  return [...groups.values()];
}

/** Sidebar order, which is also the ⌘1–9 order. */
export const orderedInstances = (instances: Instance[]): Instance[] => groupInstances(instances.filter((i) => i.enabled)).flat();

/** Tag shown on an icon inside a group of 2+: the nickname's initial if set, otherwise its position. */
export function instanceTag(instance: Instance, group: Instance[]): string {
  if (group.length < 2) return '';
  if (instance.tag) return instance.tag;
  const label = instance.label?.split('·').pop()?.trim();
  return label && !/\d$/.test(label) && label !== serviceDef(instance.type).name ? label[0]!.toUpperCase() : String(group.indexOf(instance) + 1);
}

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** True when work hours are on and `now` falls outside them (the workspace is muted). */
export function outsideWorkHours(wh: WorkHours, now: Date): boolean {
  if (!wh.enabled) return false;
  const t = now.getHours() * 60 + now.getMinutes();
  const start = minutes(wh.start);
  const end = minutes(wh.end);
  const inTime = start <= end ? t >= start && t < end : t >= start || t < end; // overnight shifts
  return !(wh.days.includes(now.getDay()) && inTime);
}
