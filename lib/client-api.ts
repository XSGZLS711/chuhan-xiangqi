/** All game requests stay on this origin; the player is identified by an HttpOnly cookie. */
export function gameFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  if (!path.startsWith('/api/game')) throw new Error('无效棋室请求');
  return fetch(path, { ...init, credentials: 'same-origin' });
}

export function invitationUrl(
  origin: string,
  pathname: string,
  roomId: string,
): string {
  const url = new URL(pathname, origin);
  url.searchParams.set('room', roomId);
  return url.href;
}

export type Account = { name: string; email: string };
/** `google` is false until sign-in is configured on the server. */
export type AccountStatus = { google: boolean; user: Account | null };
export async function fetchAccount(): Promise<AccountStatus> {
  const response = await fetch('/api/me', { credentials: 'same-origin' });
  if (!response.ok) throw new Error('账号状态读取失败');
  return response.json();
}
export async function signOutAccount(): Promise<void> {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('退出登录失败');
}
export async function deleteAccount(): Promise<void> {
  const response = await fetch('/api/me', {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error('删除账号失败');
}
/** Sign-in leaves for Google and comes back to `back`, a path on this site. */
export const signInPath = (back: string) =>
  '/api/auth/google?return=' + encodeURIComponent(back);
