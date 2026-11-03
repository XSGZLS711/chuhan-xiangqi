import { GameError } from '../lib/game';

const cookiePattern = /(?:^|;\s*)chuhan_session=([a-f0-9]{64})(?:;|$)/;
const YEAR = 31536000;

/** Only pages served from this same origin may use the API. */
export function validateRequestOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin)
    throw new GameError('请求来源不匹配。', 403);
  if (req.headers.get('sec-fetch-site') === 'cross-site')
    throw new GameError('请在棋室页面操作。', 403);
}

export const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
export const randomHex = (bytes: number) =>
  hex(crypto.getRandomValues(new Uint8Array(bytes)));
export async function hashToken(token: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return hex(new Uint8Array(hash));
}
const secure = (req: Request) =>
  new URL(req.url).protocol === 'https:' ? '; Secure' : '';
/** The browser's token: anonymous at first, replaced by a session token on sign-in. */
export const sessionCookie = (req: Request, token: string, maxAge = YEAR) =>
  `chuhan_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req)}`;
export const expiredSessionCookie = (req: Request) =>
  `chuhan_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(req)}`;

/** An anonymous player: a random token in an HttpOnly cookie, stored only as its hash. */
export async function identity(req: Request) {
  let token = req.headers.get('cookie')?.match(cookiePattern)?.[1];
  let cookie = '';
  if (!token) {
    token = randomHex(32);
    cookie = sessionCookie(req, token);
  }
  return { id: await hashToken(token), cookie };
}
