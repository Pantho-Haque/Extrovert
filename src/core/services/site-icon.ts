/**
 * Sidebar icons come from the service's own website (its <link rel="icon"> tags), never from
 * drawings of our own, so they always match the real platform and work for custom URLs too.
 */

export interface IconCandidate {
  href: string;
  /** Largest declared size in px (0 when the page didn't declare one). */
  size: number;
  /** rel="apple-touch-icon": a crisp, square app icon, usually 180 px. */
  touch: boolean;
}

/** Runs read-only inside the service page (isolated world) and lists the icons it declares. */
export const ICON_PROBE = `[...document.querySelectorAll('link[rel~="icon"], link[rel^="apple-touch-icon"]')].map((l) => ({
  href: l.href,
  size: Math.max(0, ...String(l.getAttribute('sizes') || '').split(/\\s+/).map((s) => parseInt(s, 10) || 0)),
  touch: l.rel.startsWith('apple-touch-icon'),
}))`;

const effectiveSize = (c: IconCandidate) => (c.href.endsWith('.svg') || /\.svg[?#]/.test(c.href) ? 1000 : c.size || (c.touch ? 180 : 16));

/** Sharpest icon the page offers; falls back to the conventional /favicon.ico. */
export function pickIcon(candidates: IconCandidate[], pageUrl: string): string {
  const usable = candidates.filter((c) => /^https?:/.test(c.href));
  const best = usable.sort((a, b) => effectiveSize(b) - effectiveSize(a))[0];
  return best?.href ?? new URL('/favicon.ico', pageUrl).href;
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find((v) => v !== undefined);
const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

/** The same icon list as ICON_PROBE, from a page's HTML, before any page is open (adding a website). */
export function iconsFromHtml(html: string, pageUrl: string): IconCandidate[] {
  const end = html.search(/<\/head>/i);
  const head = end > 0 ? html.slice(0, end) : html;
  return [...head.matchAll(/<link\b[^>]*>/gi)].flatMap(([tag]) => {
    const rel = (attr(tag, 'rel') ?? '').toLowerCase().split(/\s+/);
    const href = attr(tag, 'href');
    if (!href || !(rel.includes('icon') || rel.some((r) => r.startsWith('apple-touch-icon')))) return [];
    try {
      const size = Math.max(0, ...(attr(tag, 'sizes') ?? '').split(/\s+/).map((s) => parseInt(s, 10) || 0));
      return [{ href: new URL(decode(href), pageUrl).href, size, touch: rel.some((r) => r.startsWith('apple-touch-icon')) }];
    } catch {
      return [];
    }
  });
}
