/** Google sign-in by the authorization-code flow with PKCE, done entirely in this
 * Worker. We keep no Google tokens: the ID token is read once for who signed in. */
import { NAME } from '../lib/tokens';

export const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
export const CALLBACK_PATH = '/api/auth/google/callback';

export type GoogleClient = { id: string; secret: string };
export type GoogleAccount = { subject: string; email: string; name: string };
/** What the browser carries between leaving for Google and coming back. */
export type PendingSignIn = {
  state: string;
  verifier: string;
  nonce: string;
  back: string;
};

export const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const ACCOUNT_NAME = 32;
/** The Google name as the account menu shows it. Longer than a room name, since only
 * the account holder sees it; a cut drops an unclosed bracket rather than leave half
 * a nickname such as "Lushan Zhang (Lu". */
export function accountName(value: unknown): string {
  const name = (typeof value === 'string' ? value : '')
    .replace(/\p{Cc}/gu, '')
    .trim();
  const chars = Array.from(name);
  if (chars.length <= ACCOUNT_NAME) return name || NAME.player;
  let cut = chars.slice(0, ACCOUNT_NAME).join('');
  const open = Math.max(cut.lastIndexOf('('), cut.lastIndexOf('（'));
  if (open > 0 && !/[)）]/.test(cut.slice(open))) cut = cut.slice(0, open);
  return cut.trim() || NAME.player;
}
const fromBase64url = (value: string) =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
    c.charCodeAt(0),
  );
export const randomString = (bytes = 32) =>
  base64url(crypto.getRandomValues(new Uint8Array(bytes)));
export async function pkceChallenge(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(hash));
}

export function authorizationUrl(
  client: Pick<GoogleClient, 'id'>,
  redirectUri: string,
  pending: PendingSignIn,
  challenge: string,
): string {
  const url = new URL(GOOGLE_AUTHORIZE);
  url.search = new URLSearchParams({
    client_id: client.id,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  return url.href;
}

const LOCAL = 'https://local.invalid';
/** A path on this site to return to; anything else falls back to the lobby, so the
 * sign-in cannot be used to send people to another site. */
export function returnPath(value: string | null | undefined): string {
  if (!value || value.length > 512 || !value.startsWith('/')) return '/';
  try {
    const url = new URL(value, LOCAL);
    return url.origin === LOCAL ? url.pathname + url.search : '/';
  } catch {
    return '/';
  }
}
export function withLoginNotice(back: string, notice: string): string {
  const url = new URL(back, LOCAL);
  url.searchParams.set('login', notice);
  return url.pathname + url.search;
}

const pendingPattern = /(?:^|;\s*)chuhan_oauth=([^;]+)/;
const PENDING_PATH = '/api/auth/google';
export function pendingCookie(pending: PendingSignIn, secure: boolean) {
  const value = [
    pending.state,
    pending.verifier,
    pending.nonce,
    encodeURIComponent(pending.back),
  ].join('.');
  return `chuhan_oauth=${value}; Path=${PENDING_PATH}; HttpOnly; SameSite=Lax; Max-Age=600${secure ? '; Secure' : ''}`;
}
export const expiredPendingCookie = (secure: boolean) =>
  `chuhan_oauth=; Path=${PENDING_PATH}; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
export function readPending(cookie: string | null): PendingSignIn | null {
  const value = cookie?.match(pendingPattern)?.[1];
  if (!value) return null;
  const [state, verifier, nonce, ...back] = value.split('.');
  const token = /^[\w-]{32,128}$/;
  if (![state, verifier, nonce].every((part) => token.test(part ?? '')))
    return null;
  try {
    return {
      state,
      verifier,
      nonce,
      back: returnPath(decodeURIComponent(back.join('.'))),
    };
  } catch {
    return null;
  }
}

/** Trades the one-time code for the ID token. */
export async function exchangeCode(
  client: GoogleClient,
  redirectUri: string,
  code: string,
  verifier: string,
): Promise<string> {
  const response = await fetch(GOOGLE_TOKEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client.id,
      client_secret: client.secret,
      code,
      code_verifier: verifier,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    id_token?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok || typeof data?.id_token !== 'string')
    throw new Error(
      `token exchange ${response.status} ${typeof data?.error === 'string' ? data.error : ''}`,
    );
  return data.id_token;
}

/** Who signed in. The token came straight from Google's token endpoint over TLS, so
 * its claims are checked but its signature need not be (OpenID Connect Core 3.1.3.7). */
export function googleAccount(
  idToken: string,
  expected: { clientId: string; nonce: string; now: number },
): GoogleAccount {
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(
      new TextDecoder().decode(fromBase64url(idToken.split('.')[1] ?? '')),
    );
  } catch {
    throw new Error('malformed ID token');
  }
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!ISSUERS.includes(String(claims.iss))) throw new Error('wrong issuer');
  if (!audience.includes(expected.clientId)) throw new Error('wrong audience');
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= expected.now)
    throw new Error('expired ID token');
  if (claims.nonce !== expected.nonce) throw new Error('wrong nonce');
  const subject = claims.sub;
  if (typeof subject !== 'string' || !/^[\w-]{1,255}$/.test(subject))
    throw new Error('missing subject');
  return {
    subject,
    // Shown only to the account holder, and only when Google vouches for it.
    email:
      claims.email_verified === true && typeof claims.email === 'string'
        ? claims.email.slice(0, 254)
        : '',
    name: accountName(claims.name ?? claims.given_name),
  };
}
