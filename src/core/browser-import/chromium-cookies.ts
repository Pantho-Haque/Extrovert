/**
 * Turning a Chromium-family browser's saved cookies (Arc, Chrome, Brave, Edge, Vivaldi, Opera)
 * into cookies Electron can set. Pure computation: no file, keychain or Electron access here.
 */
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';

/** One row of the browser's `cookies` table (integers read as bigint: Chromium timestamps exceed 2^53). */
export interface ChromiumCookieRow {
  host_key: string;
  name: string;
  value: string;
  encrypted_value: Uint8Array;
  path: string;
  expires_utc: bigint;
  is_secure: bigint;
  is_httponly: bigint;
  samesite: bigint;
  top_frame_site_key?: string;
}

/** Shape accepted by Electron's `session.cookies.set`. */
export interface CookieToSet {
  url: string;
  name: string;
  value: string;
  domain?: string;
  path: string;
  secure: boolean;
  httpOnly: boolean;
  expirationDate?: number;
  sameSite: 'unspecified' | 'no_restriction' | 'lax' | 'strict';
}

/** macOS: the key is PBKDF2 of the "<Browser> Safe Storage" keychain password. */
export function deriveMacKey(keychainPassword: string): Buffer {
  return pbkdf2Sync(keychainPassword, 'saltysalt', 1003, 16, 'sha1');
}

/** Database schema 24+ prefixes every decrypted value with a 32-byte hash of the cookie's domain. */
const DOMAIN_HASH_SCHEMA = 24;

export function decryptMacCookie(encrypted: Uint8Array, key: Buffer, schemaVersion: number): string {
  const data = Buffer.from(encrypted);
  if (data.subarray(0, 3).toString() !== 'v10') throw new Error('Unsupported cookie encryption');
  const decipher = createDecipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '));
  const plain = Buffer.concat([decipher.update(data.subarray(3)), decipher.final()]);
  return (schemaVersion >= DOMAIN_HASH_SCHEMA ? plain.subarray(32) : plain).toString('utf8');
}

/** Chromium stores time as microseconds since 1601-01-01; Electron wants seconds since 1970. */
export function chromiumTimeToUnix(microseconds: bigint): number {
  return Number(microseconds / 1_000_000n) - 11_644_473_600;
}

const SAME_SITE: Record<string, CookieToSet['sameSite']> = { '0': 'no_restriction', '1': 'lax', '2': 'strict' };

/** Null when the cookie should not be copied (expired, or partitioned, which Electron can't set). */
export function toCookieToSet(row: ChromiumCookieRow, value: string, nowSeconds: number): CookieToSet | null {
  if (row.top_frame_site_key) return null;
  const expirationDate = row.expires_utc > 0n ? chromiumTimeToUnix(row.expires_utc) : undefined;
  if (expirationDate !== undefined && expirationDate <= nowSeconds) return null;

  const secure = row.is_secure === 1n;
  const host = row.host_key.replace(/^\./, '');
  // A leading dot means "this domain and its subdomains"; without it the cookie is host-only,
  // which Electron expresses by leaving `domain` out. __Host- cookies must always be host-only.
  const domainCookie = row.host_key.startsWith('.') && !row.name.startsWith('__Host-');
  return {
    url: `${secure ? 'https' : 'http'}://${host}${row.path || '/'}`,
    name: row.name,
    value,
    ...(domainCookie ? { domain: row.host_key } : {}),
    path: row.path || '/',
    secure,
    httpOnly: row.is_httponly === 1n,
    ...(expirationDate !== undefined ? { expirationDate } : {}),
    sameSite: SAME_SITE[String(row.samesite)] ?? 'unspecified',
  };
}
