/** App-lock PIN (FR-W11): stored only as a salted scrypt hash, compared in constant time. */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pin, salt, 32).toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
