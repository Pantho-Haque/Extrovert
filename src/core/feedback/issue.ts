/**
 * Bug reports without a server: a link to the repo's issue form (.github/ISSUE_TEMPLATE/bug_report.yml)
 * with every field filled in. The reporter submits it on GitHub with their own account.
 */

export const REPO = 'Pantho-Haque/Extrovert';

export type Severity = 'minor' | 'annoying' | 'blocking' | 'critical';

export const SEVERITIES: { id: Severity; label: string; text: string }[] = [
  { id: 'minor', label: 'Minor', text: 'Looks wrong, or is easy to work around' },
  { id: 'annoying', label: 'Annoying', text: 'It slows me down' },
  { id: 'blocking', label: 'Blocking', text: "I can't do what I need to" },
  { id: 'critical', label: 'Critical', text: 'I lost data, or the app crashes' },
];

/** Long links get cut off by browsers and GitHub, so details are capped. */
export const MAX_TITLE = 200;
export const MAX_DETAILS = 3000;

export interface Report {
  title: string;
  details: string;
  severity: Severity;
  /** A service name ("WhatsApp"), or "Extrovert itself". */
  where: string;
}

/**
 * Facts about the app and computer. Deliberately no names, emails, addresses or page titles:
 * issues are public.
 */
export interface SystemFacts {
  version: string;
  os: string;
  arch: string;
  electron: string;
  chrome: string;
  workspaces: number;
  services: { name: string; state: string; signedIn?: boolean | undefined }[];
  settings: Record<string, boolean>;
}

export function systemInfo(f: SystemFacts): string {
  const services = f.services.map((s) => `${s.name} (${s.state}${s.signedIn === undefined ? '' : s.signedIn ? ', signed in' : ', signed out'})`);
  const on = Object.entries(f.settings).filter(([, v]) => v).map(([k]) => k);
  return [
    `Extrovert ${f.version}`,
    `${f.os} · ${f.arch}`,
    `Electron ${f.electron} · Chromium ${f.chrome}`,
    `${f.workspaces} workspace${f.workspaces === 1 ? '' : 's'} · services: ${services.join(', ') || 'none'}`,
    `Settings on: ${on.join(', ') || 'none'}`,
  ].join('\n');
}

export function issueUrl(r: Report, system: string): string {
  const url = new URL(`https://github.com/${REPO}/issues/new`);
  url.searchParams.set('template', 'bug_report.yml');
  url.searchParams.set('title', r.title.trim().slice(0, MAX_TITLE));
  url.searchParams.set('severity', SEVERITIES.find((s) => s.id === r.severity)?.label ?? r.severity);
  url.searchParams.set('service', r.where);
  url.searchParams.set('details', r.details.trim().slice(0, MAX_DETAILS));
  url.searchParams.set('system', system);
  return url.href;
}

/** The same report as plain text, for "Copy report". */
export function reportText(r: Report, system: string): string {
  const severity = SEVERITIES.find((s) => s.id === r.severity)?.label ?? r.severity;
  return `${r.title.trim()}\n\nHow bad: ${severity}\nWhere: ${r.where}\n\n${r.details.trim()}\n\n---\n${system}`;
}
