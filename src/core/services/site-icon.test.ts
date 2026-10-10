import { describe, expect, it } from 'vitest';
import { pickIcon } from './site-icon';

const PAGE = 'https://www.facebook.com/';

describe('pickIcon', () => {
  it('prefers the largest declared size', () => {
    expect(pickIcon([
      { href: 'https://x.com/16.png', size: 16, touch: false },
      { href: 'https://x.com/192.png', size: 192, touch: false },
      { href: 'https://x.com/32.png', size: 32, touch: false },
    ], PAGE)).toBe('https://x.com/192.png');
  });

  it('prefers SVG over any bitmap', () => {
    expect(pickIcon([
      { href: 'https://x.com/512.png', size: 512, touch: false },
      { href: 'https://x.com/logo.svg?v=2', size: 0, touch: false },
    ], PAGE)).toBe('https://x.com/logo.svg?v=2');
  });

  it('treats an unsized apple-touch-icon as 180 px, above a plain favicon', () => {
    expect(pickIcon([
      { href: 'https://x.com/favicon.ico', size: 0, touch: false },
      { href: 'https://x.com/apple.png', size: 0, touch: true },
    ], PAGE)).toBe('https://x.com/apple.png');
  });

  it('ignores data: and other non-http icons', () => {
    expect(pickIcon([{ href: 'data:image/png;base64,AAAA', size: 512, touch: false }], PAGE)).toBe('https://www.facebook.com/favicon.ico');
  });

  it('falls back to /favicon.ico when the page declares nothing', () => {
    expect(pickIcon([], 'https://web.whatsapp.com/some/path')).toBe('https://web.whatsapp.com/favicon.ico');
  });
});
