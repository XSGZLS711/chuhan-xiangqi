import { GameError } from './game';

export const pagesOrigin = 'https://xsgzls711.github.io';
const tokenPattern = /^[a-f0-9]{64}$/;
const headerName = 'x-chuhan-session';

export function validateRequestOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  const sameOrigin = origin === new URL(req.url).origin;
  if (origin && !sameOrigin && origin !== pagesOrigin) {
    throw new GameError('请求来源不匹配。', 403);
  }
  if (req.headers.get('sec-fetch-site') === 'cross-site' && origin !== pagesOrigin) {
    throw new GameError('请在棋室页面操作。', 403);
  }
  // Cross-site clients use an explicit seat secret, never ambient cookies.
  if (origin === pagesOrigin && !tokenPattern.test(req.headers.get(headerName) ?? '')) {
    throw new GameError('未能保存座位身份，请允许网站存储后重试。', 401);
  }
}

export async function identity(req: Request) {
  const explicitToken = req.headers.get(headerName);
  if (explicitToken !== null && !tokenPattern.test(explicitToken)) {
    throw new GameError('座位身份无效，请重新打开棋室。', 401);
  }
  let token = explicitToken ?? req.headers.get('cookie')?.match(/(?:^|;\s*)chuhan_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  let cookie = '';
  if (!token) {
    token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
    cookie = `chuhan_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
  }
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return { id: Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join(''), cookie };
}

export function corsResponse(req: Request, response: Response): Response {
  if (req.headers.get('origin') !== pagesOrigin) return response;
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', pagesOrigin);
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, headers });
}

export function preflight(req: Request): Response {
  const method = req.headers.get('access-control-request-method');
  const requested = (req.headers.get('access-control-request-headers') ?? '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
  if (req.headers.get('origin') !== pagesOrigin || !['GET', 'POST'].includes(method ?? '') || requested.some(h => !['content-type', headerName].includes(h))) {
    return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  }
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': pagesOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Chuhan-Session',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers',
  } });
}
