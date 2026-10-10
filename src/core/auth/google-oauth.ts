/**
 * Google sign-in for a desktop app (FR-W01): OAuth 2.0 authorization-code flow with PKCE and a
 * loopback redirect, run in the user's own browser. Pure helpers; the HTTP and browser parts live in main.
 */
import { createHash, randomBytes } from 'node:crypto';

export const SCOPES = ['openid', 'email', 'profile'];
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

const base64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export const newVerifier = (): string => base64url(randomBytes(32));
export const newState = (): string => base64url(randomBytes(16));
export const challengeFor = (verifier: string): string => base64url(createHash('sha256').update(verifier).digest());

export function authUrl(p: { clientId: string; redirectUri: string; verifier: string; state: string; loginHint?: string }): string {
  const q = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    code_challenge: challengeFor(p.verifier),
    code_challenge_method: 'S256',
    state: p.state,
    // Always show the account chooser, so adding a second Google account is easy.
    prompt: 'select_account',
    ...(p.loginHint ? { login_hint: p.loginHint } : {}),
  });
  return `${AUTH_ENDPOINT}?${q}`;
}

export type CallbackResult = { code: string } | { error: string };

/** Validates the redirect Google sends back to our loopback server. */
export function parseCallback(requestUrl: string, expectedState: string): CallbackResult {
  const u = new URL(requestUrl, 'http://127.0.0.1');
  const error = u.searchParams.get('error');
  if (error) return { error: error === 'access_denied' ? 'Sign-in was cancelled.' : `Google returned an error: ${error}` };
  if (u.searchParams.get('state') !== expectedState) return { error: 'Sign-in response did not match this request. Please try again.' };
  const code = u.searchParams.get('code');
  return code ? { code } : { error: 'Google did not return a sign-in code.' };
}

export function tokenRequestBody(p: { clientId: string; clientSecret: string; code: string; verifier: string; redirectUri: string }): URLSearchParams {
  return new URLSearchParams({
    client_id: p.clientId,
    client_secret: p.clientSecret,
    code: p.code,
    code_verifier: p.verifier,
    redirect_uri: p.redirectUri,
    grant_type: 'authorization_code',
  });
}
