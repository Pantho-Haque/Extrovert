/** Unread totals per workspace/app and the "next unread" order (FR-A04, FR-A06, FR-X01). */
import type { InstanceStatus, Workspace } from '../../shared/types';
import { orderedInstances } from '../workspaces/model';

type Statuses = Record<string, InstanceStatus | undefined>;

/** Unread items in a workspace, skipping muted instances and those with badges turned off. */
export function workspaceUnread(ws: Workspace, statuses: Statuses): number {
  return ws.instances.reduce((n, i) => (i.enabled && !i.muted && i.badge ? n + (statuses[i.id]?.unread ?? 0) : n), 0);
}

export const totalUnread = (workspaces: Workspace[], statuses: Statuses): number =>
  workspaces.reduce((n, w) => n + workspaceUnread(w, statuses), 0);

/**
 * Next instance with something unread after `current`, walking every active workspace in
 * sidebar order and wrapping around.
 */
export function nextUnread(
  workspaces: Workspace[],
  statuses: Statuses,
  current: { workspaceId: string; instanceId?: string },
): { workspaceId: string; instanceId: string } | null {
  const order = workspaces
    .filter((w) => !w.suspended)
    .flatMap((w) => orderedInstances(w.instances).map((i) => ({ workspaceId: w.id, instanceId: i.id })));
  const pending = (x: { instanceId: string }) => {
    const s = statuses[x.instanceId];
    return !!s && s.state === 'live' && (s.unread > 0 || s.dot);
  };
  const at = order.findIndex((x) => x.workspaceId === current.workspaceId && x.instanceId === current.instanceId);
  for (let k = 1; k <= order.length; k++) {
    const candidate = order[(at + k + order.length) % order.length]!;
    if (pending(candidate) && candidate.instanceId !== current.instanceId) return candidate;
  }
  return null;
}
