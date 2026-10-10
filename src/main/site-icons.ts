/**
 * Websites you add keep their own icon (their favicon), saved on the service so it shows right away,
 * offline, and while the service sleeps. Read from the site when you paste its address, and refreshed
 * whenever the open page changes it (see ViewHost.refreshIcon).
 */
import { nativeImage, net } from 'electron';
import { chromeUserAgent } from '../core/browser/user-agent';
import { iconsFromHtml, pickIcon } from '../core/services/site-icon';

const MAX_ICON_BYTES = 512 * 1024;
const SIZE = 64;

/** A small data URL: bitmaps shrunk to 64 px PNG; SVG/ICO (which Electron can't decode) kept as is if small. */
export function iconDataUrl(type: string, bytes: Buffer): string | undefined {
  if (!type.startsWith('image/') || !bytes.length || bytes.length > MAX_ICON_BYTES) return undefined;
  const img = nativeImage.createFromBuffer(bytes);
  if (!img.isEmpty()) return (img.getSize().width > SIZE ? img.resize({ width: SIZE, height: SIZE, quality: 'best' }) : img).toDataURL();
  return bytes.length <= 48 * 1024 ? `data:${type};base64,${bytes.toString('base64')}` : undefined;
}

const cache = new Map<string, Promise<string | undefined>>();

/** The icon a website declares, without opening it in a service. Cached per site for this run. */
export function siteIconFor(pageUrl: string): Promise<string | undefined> {
  const key = URL.parse(pageUrl)?.origin;
  if (!key) return Promise.resolve(undefined);
  if (!cache.has(key)) cache.set(key, load(pageUrl).catch(() => undefined));
  return cache.get(key)!;
}

async function load(pageUrl: string): Promise<string | undefined> {
  const headers = { 'user-agent': chromeUserAgent(process.platform, process.versions.chrome) };
  const page = await net.fetch(pageUrl, { headers, signal: AbortSignal.timeout(8000) });
  const html = page.ok && (page.headers.get('content-type') ?? '').includes('html') ? (await page.text()).slice(0, 300_000) : '';
  const base = page.url || pageUrl;
  const res = await net.fetch(pickIcon(iconsFromHtml(html, base), base), { headers, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return undefined;
  return iconDataUrl((res.headers.get('content-type') ?? '').split(';')[0]!.trim(), Buffer.from(await res.arrayBuffer()));
}
