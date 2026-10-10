import { createCipheriv, createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { chromiumTimeToUnix, decryptMacCookie, deriveMacKey, toCookieToSet, type ChromiumCookieRow } from './chromium-cookies';

// Encrypt the way a Chromium browser does on macOS, so decryption is tested against real-format data.
function encrypt(value: string, key: Buffer, withDomainHash: boolean): Buffer {
  const plain = withDomainHash ? Buffer.concat([createHash('sha256').update('.facebook.com').digest(), Buffer.from(value)]) : Buffer.from(value);
  const cipher = createCipheriv('aes-128-cbc', key, Buffer.alloc(16, ' '));
  return Buffer.concat([Buffer.from('v10'), cipher.update(plain), cipher.final()]);
}

const key = deriveMacKey('test-keychain-password');
const NOW = 1_800_000_000;
const inOneYear = BigInt(NOW + 365 * 86400 + 11_644_473_600) * 1_000_000n;

const row = (over: Partial<ChromiumCookieRow> = {}): ChromiumCookieRow => ({
  host_key: '.facebook.com', name: 'c_user', value: '', encrypted_value: new Uint8Array(), path: '/',
  expires_utc: inOneYear, is_secure: 1n, is_httponly: 0n, samesite: 0n, top_frame_site_key: '', ...over,
});

describe('decryptMacCookie', () => {
  it('round-trips a value from an older database (no domain hash)', () => {
    expect(decryptMacCookie(encrypt('100012345', key, false), key, 20)).toBe('100012345');
  });

  it('strips the 32-byte domain hash on schema 24+', () => {
    expect(decryptMacCookie(encrypt('xs-token-value', key, true), key, 24)).toBe('xs-token-value');
  });

  it('rejects unknown encryption versions', () => {
    expect(() => decryptMacCookie(Buffer.from('v20whatever'), key, 24)).toThrow('Unsupported');
  });

  it('fails with the wrong key instead of returning garbage', () => {
    expect(() => decryptMacCookie(encrypt('secret', key, false), deriveMacKey('wrong'), 20)).toThrow();
  });
});

describe('chromiumTimeToUnix', () => {
  it('converts from the 1601 epoch in microseconds', () => {
    expect(chromiumTimeToUnix(13_000_000_000_000_000n)).toBe(1_355_526_400);
  });
});

describe('toCookieToSet', () => {
  it('maps a domain cookie', () => {
    expect(toCookieToSet(row(), 'v', NOW)).toEqual({
      url: 'https://facebook.com/', name: 'c_user', value: 'v', domain: '.facebook.com', path: '/',
      secure: true, httpOnly: false, expirationDate: NOW + 365 * 86400, sameSite: 'no_restriction',
    });
  });

  it('keeps host-only and __Host- cookies host-only', () => {
    expect(toCookieToSet(row({ host_key: 'www.linkedin.com' }), 'v', NOW)).not.toHaveProperty('domain');
    expect(toCookieToSet(row({ name: '__Host-GAPS' }), 'v', NOW)).not.toHaveProperty('domain');
  });

  it('maps samesite and http-only flags', () => {
    expect(toCookieToSet(row({ samesite: 1n, is_httponly: 1n }), 'v', NOW)).toMatchObject({ sameSite: 'lax', httpOnly: true });
    expect(toCookieToSet(row({ samesite: 2n }), 'v', NOW)?.sameSite).toBe('strict');
    expect(toCookieToSet(row({ samesite: -1n }), 'v', NOW)?.sameSite).toBe('unspecified');
  });

  it('treats a zero expiry as a session cookie', () => {
    expect(toCookieToSet(row({ expires_utc: 0n }), 'v', NOW)).not.toHaveProperty('expirationDate');
  });

  it('skips expired and partitioned cookies', () => {
    expect(toCookieToSet(row({ expires_utc: 13_000_000_000_000_000n }), 'v', NOW)).toBeNull();
    expect(toCookieToSet(row({ top_frame_site_key: 'https://example.com' }), 'v', NOW)).toBeNull();
  });
});
