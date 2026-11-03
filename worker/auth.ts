import { env } from 'cloudflare:workers';
import { GameError } from '../lib/game';
import {
  account,
  deleteAccount,
  player,
  SESSION_DAYS,
  signIn,
  signOut,
} from './accounts';
import { database } from './db';
import {
  authorizationUrl,
  CALLBACK_PATH,
  exchangeCode,
  expiredPendingCookie,
  googleAccount,
  pendingCookie,
  pkceChallenge,
  randomString,
  readPending,
  returnPath,
  withLoginNotice,
  type GoogleClient,
} from './google';
import {
  expiredSessionCookie,
  identity,
  sessionCookie,
  validateRequestOrigin,
} from './identity';

/** Sign-in is offered only once both values are set (wrangler secret / .dev.vars). */
function googleClient(): GoogleClient | null {
  const id = env.GOOGLE_CLIENT_ID,
    secret = env.GOOGLE_CLIENT_SECRET;
  return id && secret ? { id, secret } : null;
}
const noStore = { 'Cache-Control': 'no-store, private' };
const isSecure = (req: Request) => new URL(req.url).protocol === 'https:';
const redirectUri = (req: Request) => new URL(CALLBACK_PATH, req.url).href;
function redirect(location: string, cookies: string[]) {
  const headers = new Headers({ ...noStore, Location: location });
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status: 302, headers });
}

function sameOrigin(req: Request) {
  try {
    validateRequestOrigin(req);
    return null;
  } catch (error) {
    const status = error instanceof GameError ? error.status : 403;
    return Response.json({ error: '请求来源不匹配。' }, { status });
  }
}

export async function me(req: Request) {
  const refused = sameOrigin(req);
  if (refused) return refused;
  const device = await identity(req);
  const user = device.cookie ? null : await account(database(), device.id);
  return Response.json(
    {
      google: !!googleClient(),
      user: user ? { name: user.name, email: user.email ?? '' } : null,
    },
    { headers: noStore },
  );
}

/** Leaves for Google's account chooser, remembering where to come back to. */
export async function startGoogle(req: Request) {
  const back = returnPath(new URL(req.url).searchParams.get('return'));
  const client = googleClient();
  if (!client) return redirect(withLoginNotice(back, 'failed'), []);
  const pending = {
    state: randomString(),
    verifier: randomString(48),
    nonce: randomString(),
    back,
  };
  return redirect(
    authorizationUrl(
      client,
      redirectUri(req),
      pending,
      await pkceChallenge(pending.verifier),
    ),
    [pendingCookie(pending, isSecure(req))],
  );
}

export async function googleCallback(req: Request) {
  const url = new URL(req.url),
    secure = isSecure(req),
    pending = readPending(req.headers.get('cookie')),
    back = pending?.back ?? '/',
    clear = expiredPendingCookie(secure);
  const fail = (reason: string) => {
    console.warn('Google sign-in failed', reason);
    return redirect(withLoginNotice(back, 'failed'), [clear]);
  };
  // The state ties this answer to the sign-in this browser started.
  if (!pending || url.searchParams.get('state') !== pending.state)
    return fail('state mismatch');
  // Closed the chooser or declined: back to where they were, nothing to report.
  if (url.searchParams.get('error')) return redirect(back, [clear]);
  const client = googleClient(),
    code = url.searchParams.get('code');
  if (!client || !code) return fail('missing code or client');
  try {
    const google = googleAccount(
      await exchangeCode(client, redirectUri(req), code, pending.verifier),
      { clientId: client.id, nonce: pending.nonce, now: Date.now() },
    );
    const db = database();
    const token = await signIn(db, google, await player(req, db), Date.now());
    return redirect(back, [
      clear,
      sessionCookie(req, token, SESSION_DAYS * 86400),
    ]);
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'unknown');
  }
}

// Either way the next request gets a fresh anonymous token.
const signedOut = (req: Request) =>
  new Response(null, {
    status: 204,
    headers: { ...noStore, 'Set-Cookie': expiredSessionCookie(req) },
  });

export async function logout(req: Request) {
  const refused = sameOrigin(req);
  if (refused) return refused;
  const device = await identity(req);
  if (!device.cookie) await signOut(database(), device.id);
  return signedOut(req);
}

export async function removeAccount(req: Request) {
  const refused = sameOrigin(req);
  if (refused) return refused;
  const db = database(),
    me = await player(req, db);
  if (!me.signedIn)
    return Response.json(
      { error: '请先登录。' },
      { status: 401, headers: noStore },
    );
  await deleteAccount(db, me.id);
  return signedOut(req);
}
