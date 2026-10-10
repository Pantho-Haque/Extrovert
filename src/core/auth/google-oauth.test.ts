import { describe, expect, it } from 'vitest';
import { authUrl, challengeFor, newState, newVerifier, parseCallback, tokenRequestBody } from './google-oauth';

describe('PKCE', () => {
  it('derives the RFC 7636 example challenge', () => {
    expect(challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('makes URL-safe random values', () => {
    expect(newVerifier()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(newState()).not.toBe(newState());
  });
});

describe('authUrl', () => {
  it('asks for identity scopes only, with PKCE and the account chooser', () => {
    const u = new URL(authUrl({ clientId: 'cid', redirectUri: 'http://127.0.0.1:5555', verifier: 'v'.repeat(43), state: 's1' }));
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: 'cid', redirect_uri: 'http://127.0.0.1:5555', response_type: 'code', scope: 'openid email profile',
      code_challenge_method: 'S256', state: 's1', prompt: 'select_account',
    });
  });
});

describe('parseCallback', () => {
  it('returns the code when the state matches', () => {
    expect(parseCallback('/?state=s1&code=abc', 's1')).toEqual({ code: 'abc' });
  });

  it('rejects a mismatched state (possible forgery)', () => {
    expect(parseCallback('/?state=evil&code=abc', 's1')).toHaveProperty('error');
  });

  it('explains a cancelled sign-in', () => {
    expect(parseCallback('/?error=access_denied&state=s1', 's1')).toEqual({ error: 'Sign-in was cancelled.' });
  });
});

describe('tokenRequestBody', () => {
  it('sends the verifier for PKCE', () => {
    const body = tokenRequestBody({ clientId: 'c', clientSecret: 's', code: 'x', verifier: 'v', redirectUri: 'r' });
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code_verifier')).toBe('v');
  });
});
