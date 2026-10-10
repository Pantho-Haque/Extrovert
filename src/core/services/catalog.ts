/** The only place platform specifics live. Pure data, no Electron imports. */
import type { ServiceKind, ServiceType } from '../../shared/types';

export interface ServiceDefinition {
  id: ServiceType;
  name: string;
  url: string;
  /** Hosts that belong to this service; links elsewhere open in the system browser. */
  domains: string[];
  kind: ServiceKind;
  /** Brand color: tints the service's outline icon. */
  color: string;
  group: 'social' | 'google' | 'custom';
  /** Overrides the default "(n) Title" unread rule. Capture group 1 is the count. */
  unreadPattern?: RegExp;
  /** Landing on one of these means the user is signed out (FR-X02). */
  loginPatterns: RegExp[];
  /**
   * The platform's own login cookie: present exactly while the user is signed in. The most reliable
   * signal (Facebook's logged-out page is just facebook.com). Any one of `names` counts.
   */
  sessionCookie?: { url: string; names: string[] };
}

const GOOGLE_DOMAINS = ['google.com', 'gstatic.com', 'googleusercontent.com', 'youtube.com'];
const GOOGLE_SESSION = { url: 'https://www.google.com', names: ['SID', '__Secure-1PSID'] };
const META_SESSION = { url: 'https://www.facebook.com', names: ['c_user'] };
const GOOGLE_LOGIN = [/^https:\/\/accounts\.google\.com\//, /^https:\/\/workspace\.google\.com\//, /\/intl\/[^/]+\/(gmail|calendar|drive|meet|chat)\/about/];

export const catalog: ServiceDefinition[] = [
  { id: 'facebook', name: 'Facebook', url: 'https://www.facebook.com/', domains: ['facebook.com', 'fbcdn.net', 'fb.com'], kind: 'feed', color: '#1877F2', group: 'social',
    loginPatterns: [/facebook\.com\/(login|checkpoint|recover)/], sessionCookie: META_SESSION },
  { id: 'messenger', name: 'Messenger', url: 'https://www.facebook.com/messages/', domains: ['facebook.com', 'messenger.com', 'fbcdn.net'], kind: 'chat', color: '#A033FF', group: 'social',
    loginPatterns: [/facebook\.com\/(login|checkpoint|recover)/], sessionCookie: META_SESSION },
  { id: 'whatsapp', name: 'WhatsApp', url: 'https://web.whatsapp.com/', domains: ['whatsapp.com', 'whatsapp.net'], kind: 'chat', color: '#25D366', group: 'social',
    loginPatterns: [] }, // QR login keeps the same URL; signed-out detection for WhatsApp comes from its title
  // Instagram offers "Log in with Facebook", so facebook.com must stay in-app.
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', domains: ['instagram.com', 'cdninstagram.com', 'facebook.com'], kind: 'feed', color: '#DD2A7B', group: 'social',
    loginPatterns: [/instagram\.com\/accounts\/(login|emailsignup)/], sessionCookie: { url: 'https://www.instagram.com', names: ['sessionid'] } },
  { id: 'linkedin', name: 'LinkedIn', url: 'https://www.linkedin.com/feed/', domains: ['linkedin.com', 'licdn.com'], kind: 'feed', color: '#0A66C2', group: 'social',
    loginPatterns: [/linkedin\.com\/(login|uas\/login|checkpoint|authwall|signup)/, /^https:\/\/www\.linkedin\.com\/?(\?|$)/], sessionCookie: { url: 'https://www.linkedin.com', names: ['li_at'] } },
  // Gmail puts the count mid-title: "Inbox (3) - you@gmail.com - Gmail".
  { id: 'gmail', name: 'Gmail', url: 'https://mail.google.com/mail/', domains: GOOGLE_DOMAINS, kind: 'mail', color: '#EA4335', group: 'google',
    unreadPattern: /\((\d[\d,]*)\+?\)/, loginPatterns: GOOGLE_LOGIN, sessionCookie: GOOGLE_SESSION },
  { id: 'calendar', name: 'Calendar', url: 'https://calendar.google.com/calendar/', domains: GOOGLE_DOMAINS, kind: 'tool', color: '#4285F4', group: 'google', loginPatterns: GOOGLE_LOGIN, sessionCookie: GOOGLE_SESSION },
  { id: 'drive', name: 'Drive', url: 'https://drive.google.com/drive/', domains: GOOGLE_DOMAINS, kind: 'tool', color: '#34A853', group: 'google', loginPatterns: GOOGLE_LOGIN, sessionCookie: GOOGLE_SESSION },
  { id: 'meet', name: 'Meet', url: 'https://meet.google.com/', domains: GOOGLE_DOMAINS, kind: 'call', color: '#00897B', group: 'google', loginPatterns: GOOGLE_LOGIN, sessionCookie: GOOGLE_SESSION },
  { id: 'chat', name: 'Chat', url: 'https://chat.google.com/', domains: GOOGLE_DOMAINS, kind: 'chat', color: '#34A853', group: 'google', loginPatterns: GOOGLE_LOGIN, sessionCookie: GOOGLE_SESSION },
  { id: 'custom', name: 'Website', url: '', domains: [], kind: 'custom', color: '#64748B', group: 'custom', loginPatterns: [] },
];

export const serviceDef = (type: ServiceType): ServiceDefinition => catalog.find((s) => s.id === type)!;

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

const matches = (host: string, domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`));

/** True when `url` belongs to the service (exact host or any subdomain). */
export function isServiceUrl(service: Pick<ServiceDefinition, 'domains'>, url: string): boolean {
  const host = hostOf(url);
  return !!host && matches(host, service.domains);
}

/** Domains a specific instance owns; custom services own their own host. */
export function domainsOf(type: ServiceType, url?: string): string[] {
  if (type !== 'custom') return serviceDef(type).domains;
  const host = url ? hostOf(url) : null;
  return host ? [host.replace(/^www\./, '')] : [];
}

export const isLoginPage = (type: ServiceType, url: string): boolean => serviceDef(type).loginPatterns.some((p) => p.test(url));

/** Name and URL for a pasted custom address: "web.telegram.org/k" → Telegram, https://web.telegram.org/k */
export function parseCustomUrl(input: string): { url: string; name: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const host = hostOf(withScheme);
  if (!host || !host.includes('.')) return null;
  const parts = host.split('.').filter((p) => !['www', 'web', 'app', 'm'].includes(p));
  const word = parts.length > 1 ? parts[parts.length - 2]! : parts[0]!;
  return { url: new URL(withScheme).href, name: word[0]!.toUpperCase() + word.slice(1) };
}
