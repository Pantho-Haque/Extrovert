import { describe, expect, it } from 'vitest';
import { chromeUserAgent } from './user-agent';

describe('chromeUserAgent', () => {
  it.each([
    ['darwin', 'Macintosh; Intel Mac OS X 10_15_7'],
    ['win32', 'Windows NT 10.0; Win64; x64'],
    ['linux', 'X11; Linux x86_64'],
  ] as const)('%s', (platform, os) => {
    const ua = chromeUserAgent(platform, '146.0.7680.65');
    expect(ua).toBe(`Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36`);
    expect(ua).not.toMatch(/Electron|Extrovert/);
  });
});
