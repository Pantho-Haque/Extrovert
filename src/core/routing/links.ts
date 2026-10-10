/** Smart link opening (FR-X21): which service instances can open a URL, current workspace first. */
import type { Workspace } from '../../shared/types';
import { domainsOf, isServiceUrl } from '../services/catalog';

export interface LinkTarget {
  workspaceId: string;
  instanceId: string;
}

export function linkTargets(url: string, workspaces: Workspace[], currentWorkspaceId: string): LinkTarget[] {
  if (!/^https?:\/\//i.test(url.trim())) return [];
  const ordered = [...workspaces].sort((a, b) => Number(b.id === currentWorkspaceId) - Number(a.id === currentWorkspaceId));
  const targets: LinkTarget[] = [];
  for (const w of ordered) {
    for (const i of w.instances) {
      if (i.enabled && isServiceUrl({ domains: domainsOf(i.type, i.url) }, url)) targets.push({ workspaceId: w.id, instanceId: i.id });
    }
  }
  return targets;
}

/** Accepts "instagram.com/x" as well as full URLs. */
export function normalizeLink(input: string): string | null {
  const t = input.trim();
  if (!t || /\s/.test(t)) return null;
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(url);
    return u.hostname.includes('.') ? u.href : null;
  } catch {
    return null;
  }
}
