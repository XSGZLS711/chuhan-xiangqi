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
