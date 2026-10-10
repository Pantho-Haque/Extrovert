/**
 * Google sign-in in the user's own browser (FR-W01): a one-shot loopback server on 127.0.0.1
 * receives the redirect, then the code is exchanged (PKCE) for the user's name, email and photo.
 */
import { createServer, type Server } from 'node:http';
import { net, shell } from 'electron';
import { authUrl, newState, newVerifier, parseCallback, tokenRequestBody } from '../core/auth/google-oauth';

export interface GoogleProfile {
  sub: string;
  name: string;
  email: string;
  picture?: string;
}

const TIMEOUT_MS = 5 * 60_000;

const page = (title: string, text: string) => `<!doctype html><meta charset="utf-8"><title>${title}</title>
<body style="font:16px -apple-system,Segoe UI,sans-serif;display:grid;place-items:center;height:100vh;margin:0;background:#F8FAFC;color:#0F172A">
<div style="text-align:center"><div style="font-size:40px">${title.includes('signed') ? '✓' : '!'}</div><h2>${title}</h2><p style="color:#64748B">${text}</p></div>`;

let current: { server: Server; reject: (e: Error) => void } | null = null;

export function cancelSignIn(): void {
  current?.reject(new Error('Sign-in was cancelled.'));
}

export async function signInWithGoogle(loginHint?: string): Promise<GoogleProfile> {
  const clientId = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_ID;
  const clientSecret = import.meta.env.MAIN_VITE_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google sign-in is not configured. Add the client ID and secret to the .env file.');
  cancelSignIn();

  const verifier = newVerifier();
  const state = newState();

  const code = await new Promise<{ code: string; redirectUri: string }>((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url?.startsWith('/callback')) return void res.writeHead(404).end();
      const result = parseCallback(req.url, state);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      if ('code' in result) {
        res.end(page('You’re signed in', 'You can close this tab and go back to Extrovert.'));
        finish(() => resolve({ code: result.code, redirectUri }));
      } else {
        res.end(page('Sign-in didn’t finish', result.error));
        finish(() => reject(new Error(result.error)));
      }
    });
    let redirectUri = '';
    const timer = setTimeout(() => finish(() => reject(new Error('Sign-in timed out. Please try again.'))), TIMEOUT_MS);
    const finish = (then: () => void) => {
      clearTimeout(timer);
      server.close();
      current = null;
      then();
    };
    current = { server, reject: (e) => finish(() => reject(e)) };
    // Port 0: the OS picks a free port. Google accepts any loopback port for Desktop clients.
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      redirectUri = `http://127.0.0.1:${port}/callback`;
      void shell.openExternal(authUrl({ clientId, redirectUri, verifier, state, ...(loginHint ? { loginHint } : {}) }));
    });
    server.on('error', (e) => finish(() => reject(e)));
  });

  const tokenRes = await net.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenRequestBody({ clientId, clientSecret, code: code.code, verifier, redirectUri: code.redirectUri }).toString(),
  });
  // Only identity is needed, so no token is kept after this (nothing to store or leak). Drive sync (FR-W08) will add one, sealed with safeStorage.
  const tokens = (await tokenRes.json()) as { access_token?: string; error_description?: string };
  if (!tokenRes.ok || !tokens.access_token) throw new Error(`Google sign-in failed: ${tokens.error_description ?? tokenRes.statusText}`);

  const infoRes = await net.fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const info = (await infoRes.json()) as { sub?: string; name?: string; email?: string; picture?: string };
  if (!info.sub || !info.email) throw new Error('Google did not share your account details.');

  return {
    sub: info.sub,
    name: info.name ?? info.email,
    email: info.email,
    ...(info.picture ? { picture: await toDataUrl(info.picture) } : {}),
  };
}

/** Stores the profile photo inside the app, so it shows offline and leaks nothing on startup. */
async function toDataUrl(url: string): Promise<string | undefined> {
  try {
    const res = await net.fetch(url.replace(/=s\d+-c$/, '=s128-c'));
    const type = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return undefined;
  }
}
