declare const __CHUHAN_API_ORIGIN__: string;
const remoteOrigin = typeof __CHUHAN_API_ORIGIN__ === 'undefined' ? '' : __CHUHAN_API_ORIGIN__;
const storageKey = 'chuhan-pages-seat-v1';

function seatToken(): string {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored && /^[a-f0-9]{64}$/.test(stored)) return stored;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(storageKey, token);
    if (localStorage.getItem(storageKey) !== token) throw new Error();
    return token;
  } catch {
    throw new Error('请允许网站存储，以保存你的棋桌座位，然后点击重新连接。');
  }
}

export function gameFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.startsWith('/api/game')) throw new Error('无效棋室请求');
  const headers = new Headers(init.headers);
  if (remoteOrigin) headers.set('X-Chuhan-Session', seatToken());
  return fetch(remoteOrigin + path, {
    ...init,
    headers,
    credentials: remoteOrigin ? 'omit' : 'same-origin',
    mode: remoteOrigin ? 'cors' : 'same-origin',
  });
}

export function invitationUrl(origin: string, pathname: string, roomId: string): string {
  const url = new URL(pathname, origin);
  url.searchParams.set('room', roomId);
  return url.href;
}
