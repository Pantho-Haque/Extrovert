import { describe, expect, it } from 'vitest';
import { catalog, domainsOf, isLoginPage, isServiceUrl, parseCustomUrl, serviceDef } from './catalog';

describe('catalog', () => {
  it('has unique ids', () => {
    expect(new Set(catalog.map((s) => s.id)).size).toBe(catalog.length);
  });

  it('every start URL belongs to its own service', () => {
    for (const s of catalog.filter((x) => x.url)) expect(isServiceUrl(s, s.url), s.id).toBe(true);
  });

  it('no start URL is mistaken for a login page', () => {
    for (const s of catalog.filter((x) => x.url)) expect(isLoginPage(s.id, s.url), s.id).toBe(false);
  });
});

describe('isServiceUrl', () => {
  it('matches the host and its subdomains', () => {
    expect(isServiceUrl(serviceDef('facebook'), 'https://www.facebook.com/groups/x')).toBe(true);
    expect(isServiceUrl(serviceDef('facebook'), 'https://m.facebook.com/')).toBe(true);
    expect(isServiceUrl(serviceDef('gmail'), 'https://accounts.google.com/signin')).toBe(true);
  });

  it('rejects lookalike and foreign hosts', () => {
    expect(isServiceUrl(serviceDef('facebook'), 'https://notfacebook.com/')).toBe(false);
    expect(isServiceUrl(serviceDef('whatsapp'), 'https://example.com/?q=whatsapp.com')).toBe(false);
    expect(isServiceUrl(serviceDef('linkedin'), 'not a url')).toBe(false);
  });
});

describe('isLoginPage', () => {
  it.each([
    ['facebook', 'https://www.facebook.com/login/?next=x'],
    ['instagram', 'https://www.instagram.com/accounts/login/'],
    ['linkedin', 'https://www.linkedin.com/login'],
    ['linkedin', 'https://www.linkedin.com/authwall?trk=x'],
    ['gmail', 'https://accounts.google.com/v3/signin/identifier'],
    ['gmail', 'https://workspace.google.com/intl/en/gmail/'],
  ] as const)('%s %s', (type, url) => {
    expect(isLoginPage(type, url)).toBe(true);
  });

  it('does not flag normal pages', () => {
    expect(isLoginPage('facebook', 'https://www.facebook.com/groups/dhaka')).toBe(false);
    expect(isLoginPage('gmail', 'https://mail.google.com/mail/u/0/#inbox')).toBe(false);
  });
});

describe('domainsOf', () => {
  it('uses the catalog for known services and the host for custom ones', () => {
    expect(domainsOf('whatsapp')).toContain('whatsapp.com');
    expect(domainsOf('custom', 'https://www.web.telegram.org/k/')).toEqual(['web.telegram.org']);
    expect(domainsOf('custom')).toEqual([]);
  });
});

describe('parseCustomUrl', () => {
  it.each([
    ['web.telegram.org/k', 'Telegram', 'https://web.telegram.org/k'],
    ['https://discord.com/app', 'Discord', 'https://discord.com/app'],
    ['www.notion.so', 'Notion', 'https://www.notion.so/'],
  ])('%s', (input, name, url) => {
    expect(parseCustomUrl(input)).toEqual({ name, url });
  });

  it('rejects things that are not addresses', () => {
    expect(parseCustomUrl('')).toBeNull();
    expect(parseCustomUrl('hello')).toBeNull();
  });
});
