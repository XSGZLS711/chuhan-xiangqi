import { GameError } from '../lib/game';

const cookiePattern = /(?:^|;\s*)chuhan_session=([a-f0-9]{64})(?:;|$)/;

/** Only pages served from this same origin may use the API. */
export function validateRequestOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  if (origin && origin !== new URL(req.url).origin)
    throw new GameError('请求来源不匹配。', 403);
  if (req.headers.get('sec-fetch-site') === 'cross-site')
    throw new GameError('请在棋室页面操作。', 403);
}

const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');

/** An anonymous player: a random token in an HttpOnly cookie, stored only as its hash. */
export async function identity(req: Request) {
  let token = req.headers.get('cookie')?.match(cookiePattern)?.[1];
  let cookie = '';
  if (!token) {
    token = hex(crypto.getRandomValues(new Uint8Array(32)));
    cookie = `chuhan_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
  }
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return { id: hex(new Uint8Array(hash)), cookie };
}
