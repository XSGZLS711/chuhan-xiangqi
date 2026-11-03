import { ApiError, apiError, gameFetch } from './client-api';
import type { ErrorCode } from './errors';
import type { PublicRoom } from './game';
import { unpack, type Wire } from './room-wire';

/** Rooms made since the move to Durable Objects have 24-character ids and a socket; the
 * older 20-character ones are rows in D1 and are only polled. */
export const isLiveRoom = (id: string) => /^[a-f0-9]{24}$/.test(id);

/** How the page reaches the server. Tests outside a browser pass their own, with a cookie. */
export type Transport = {
  fetch(path: string, init?: RequestInit): Promise<Response>;
  socket(path: string): WebSocket;
};
const browser: Transport = {
  fetch: gameFetch,
  socket(path) {
    const url = new URL(path, location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return new WebSocket(url);
  },
};

export type RoomSyncHandlers = {
  /** Every state of the room, oldest first. The same version again brings fresh presence. */
  onRoom(room: PublicRoom): void;
  /** The room stopped answering; `onRoom` follows once it answers again. */
  onLost(error: unknown): void;
};
export type RoomSync = {
  /** An action on the room. Resolves with the room after it, or throws an `ApiError`. */
  send(action: string, extra?: Record<string, unknown>): Promise<PublicRoom>;
  /** Asks the room again now (the reconnect button). */
  refresh(): Promise<PublicRoom>;
  stop(): void;
  readonly mode: 'socket' | 'poll';
};

// A socket that has not opened by then is given up on.
const OPEN_MS = 5000;
// The server counts a seat present while its socket spoke in the last 40 s.
const PING_MS = 15000;
const PONG_MS = 8000;
const ACK_MS = 12000;
// While polling, a socket is tried again after 30 s, then less and less often.
const SOCKET_RETRY_MS = 30000;
const SOCKET_RETRY_MAX_MS = 300000;

type Body = { error?: string; code?: string };
const read = (data: PublicRoom | Wire<PublicRoom>): PublicRoom =>
  'moves' in data ? unpack(data) : data;
const requestId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
const hidden = () => typeof document !== 'undefined' && document.hidden;
/** A failure as the page shows it: the server's refusal, or else `fallback` rather than the
 * browser's own words for a network error. */
const plain = (error: unknown, fallback: ErrorCode) =>
  error instanceof ApiError ? error : apiError(null, 0, fallback);

/** Gives this browser its identity cookie; the page does this before anything else. */
export async function openSession(transport = browser, timeout = 12000) {
  const res = await transport.fetch('/api/game', {
    cache: 'no-store',
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw apiError(null, res.status, 'unavailable');
}

async function post(transport: Transport, body: Record<string, unknown>) {
  const res = await transport.fetch('/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as (PublicRoom | Wire<PublicRoom>) & Body;
  if (!res.ok) throw apiError(data, res.status, 'action-failed');
  return read(data);
}

export function createRoom(
  name: string,
  clockMinutes: number,
  transport = browser,
): Promise<PublicRoom> {
  return post(transport, { action: 'create', name, clockMinutes });
}

/** Keeps the page's room current: a socket to the room's Durable Object, held polls when
 * the socket cannot get through (some offices and proxies) and for D1 rooms. */
export function startRoomSync(
  roomId: string,
  handlers: RoomSyncHandlers,
  transport = browser,
): RoomSync {
  type Pending = {
    body: Record<string, unknown>;
    message: string;
    resolve: (room: PublicRoom) => void;
    reject: (error: unknown) => void;
    timer: ReturnType<typeof setTimeout>;
  };
  const pending = new Map<string, Pending>();
  let latest: PublicRoom | null = null,
    stopped = false,
    mode: 'socket' | 'poll' = isLiveRoom(roomId) ? 'socket' : 'poll',
    socket: WebSocket | null = null,
    // Socket attempts in a row that never opened, and whether one ever did.
    failures = 0,
    worked = false,
    // Sockets tried while polling.
    retries = 0,
    openedAt = 0,
    sentAt = 0,
    heardAt = 0,
    pingAt = 0,
    polling = false;
  let socketTimer: ReturnType<typeof setTimeout> | undefined,
    pollTimer: ReturnType<typeof setTimeout> | undefined;

  function deliver(room: PublicRoom) {
    if (stopped) return;
    if (latest?.id === room.id && room.version < latest.version) return;
    latest = room;
    handlers.onRoom(room);
  }
  async function fetchRoom(since?: number) {
    const query = since === undefined ? '' : '&since=' + since;
    const res = await transport.fetch(
      '/api/game?room=' + encodeURIComponent(roomId) + query + '&wire=1',
      { cache: 'no-store', signal: AbortSignal.timeout(12000) },
    );
    const data = (await res.json()) as (PublicRoom | Wire<PublicRoom>) & Body;
    if (!res.ok) throw apiError(data, res.status, 'unavailable');
    return read(data);
  }
  const known = () => (latest?.id === roomId ? latest.version : undefined);

  function transmit(ws: WebSocket, message: string) {
    ws.send(message);
    sentAt = Date.now();
  }
  function receive(text: string) {
    let data: {
      t?: string;
      room?: Wire<PublicRoom>;
      request?: string;
      status?: number;
      version?: number;
      players?: PublicRoom['players'];
      serverNow?: number;
    } & Body;
    try {
      data = JSON.parse(text);
    } catch {
      return;
    }
    if (data.t === 'room' && data.room) deliver(unpack(data.room));
    else if (data.t === 'presence' && latest && data.version === latest.version)
      deliver({
        ...latest,
        players: data.players ?? latest.players,
        serverNow: data.serverNow ?? latest.serverNow,
      });
    else if (data.t === 'ack' && data.request) {
      const waiting = pending.get(data.request);
      if (!waiting) return;
      clearTimeout(waiting.timer);
      pending.delete(data.request);
      if (data.status === 200 && latest) waiting.resolve(latest);
      else waiting.reject(apiError(data, data.status ?? 503, 'action-failed'));
    }
  }

  function connect() {
    if (stopped) return;
    clearTimeout(socketTimer);
    const v = known();
    let ws: WebSocket;
    try {
      ws = transport.socket(
        '/api/game/ws?room=' +
          encodeURIComponent(roomId) +
          (v === undefined ? '' : '&v=' + v),
      );
    } catch {
      closed(false);
      return;
    }
    socket = ws;
    let opened = false;
    const openTimer = setTimeout(() => {
      if (!opened) drop(ws, false);
    }, OPEN_MS);
    ws.onopen = () => {
      opened = true;
      clearTimeout(openTimer);
      failures = retries = 0;
      worked = true;
      openedAt = heardAt = pingAt = sentAt = Date.now();
      mode = 'socket';
      stopPolling();
      // Anything sent while the socket was down goes again; the room answers a repeat
      // with the first answer instead of playing it twice.
      for (const waiting of pending.values()) transmit(ws, waiting.message);
    };
    ws.onmessage = (event) => {
      heardAt = Date.now();
      if (typeof event.data === 'string') receive(event.data);
    };
    ws.onclose = () => {
      clearTimeout(openTimer);
      if (socket === ws) closed(opened);
    };
    // A refused handshake may end here without a close event (Node's WebSocket does).
    ws.onerror = () => {
      clearTimeout(openTimer);
      drop(ws, opened);
    };
  }
  /** Gives up on a socket without waiting for the browser to notice it is gone. */
  function drop(ws: WebSocket, opened: boolean) {
    ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
    try {
      ws.close(4000, 'No answer');
    } catch {
      // Not open yet.
    }
    if (socket === ws) closed(opened);
  }
  function closed(opened: boolean) {
    socket = null;
    if (stopped) return;
    // A drop after a while, say every socket closing as the site is updated: straight back.
    // One that closes as soon as it opens counts as a failure, so it is not retried in a loop.
    if (opened && Date.now() - openedAt > OPEN_MS) {
      socketTimer = setTimeout(connect, 300);
      return;
    }
    failures++;
    // Never through, or not again after a few tries: poll, and try the socket now and then.
    if (polling || !worked || failures >= 3) {
      startPolling();
      socketTimer = setTimeout(
        connect,
        Math.min(SOCKET_RETRY_MAX_MS, SOCKET_RETRY_MS * 2 ** retries++),
      );
    } else {
      if (worked && failures === 1)
        handlers.onLost(apiError(null, 0, 'connection-lost'));
      socketTimer = setTimeout(connect, failures * 1500);
    }
  }

  function startPolling() {
    if (polling) return;
    polling = true;
    mode = 'poll';
    // Waiting actions go over HTTP now, under the same request id.
    for (const [id, waiting] of pending) {
      clearTimeout(waiting.timer);
      pending.delete(id);
      postAction(waiting.body).then(waiting.resolve, waiting.reject);
    }
    void poll();
  }
  function stopPolling() {
    polling = false;
    clearTimeout(pollTimer);
  }
  async function poll() {
    if (stopped || !polling) return;
    const started = Date.now();
    try {
      deliver(await fetchRoom(known()));
    } catch (error) {
      if (!stopped && polling) handlers.onLost(plain(error, 'connection-lost'));
    } finally {
      // Spaced from the start of the last request, so an answer that comes back at once
      // never makes the page ask faster than it did before polls were held.
      if (!stopped && polling)
        pollTimer = setTimeout(
          poll,
          Math.max(0, started + (hidden() ? 5000 : 1400) - Date.now()),
        );
    }
  }

  async function postAction(body: Record<string, unknown>) {
    try {
      const room = await post(transport, { ...body, room: roomId, wire: true });
      deliver(room);
      return room;
    } catch (error) {
      if (error instanceof ApiError && error.status === 409)
        try {
          deliver(await fetchRoom());
        } catch {
          // The refusal is what the player needs to read.
        }
      throw plain(error, 'network-unstable');
    }
  }
  function send(action: string, extra: Record<string, unknown> = {}) {
    const body = {
      action,
      version: latest?.version,
      request: requestId(),
      ...extra,
    };
    if (mode === 'poll') return postAction(body);
    return new Promise<PublicRoom>((resolve, reject) => {
      const message = JSON.stringify({ t: 'act', ...body });
      const timer = setTimeout(() => {
        pending.delete(body.request);
        reject(apiError(null, 0, 'network-unstable'));
      }, ACK_MS);
      pending.set(body.request, { body, message, resolve, reject, timer });
      if (socket?.readyState === WebSocket.OPEN) transmit(socket, message);
    });
  }

  // Quiet sockets ping, so the server keeps counting this seat present and a dead
  // connection is noticed long before the browser would.
  const heartbeat = setInterval(() => {
    const ws = socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (pingAt > heardAt && now - pingAt > PONG_MS) drop(ws, true);
    else if (now - sentAt >= PING_MS) {
      transmit(ws, '{"t":"ping"}');
      pingAt = now;
    }
  }, 5000);
  function wake() {
    if (stopped || !isLiveRoom(roomId) || hidden()) return;
    const ws = socket;
    if (!ws) {
      failures = 0;
      connect();
    } else if (ws.readyState === WebSocket.OPEN) {
      // Back from the background or a network change: check the socket still works.
      transmit(ws, '{"t":"ping"}');
      pingAt = Date.now();
    }
  }
  const browserEvents = typeof window !== 'undefined';
  if (browserEvents) {
    window.addEventListener('online', wake);
    document.addEventListener('visibilitychange', wake);
  }

  if (mode === 'socket') connect();
  else {
    polling = true;
    void poll();
  }

  return {
    send,
    async refresh() {
      if (mode === 'socket' && !socket) {
        failures = 0;
        connect();
      }
      const room = await fetchRoom();
      deliver(room);
      return room;
    },
    stop() {
      stopped = true;
      clearTimeout(socketTimer);
      clearTimeout(pollTimer);
      clearInterval(heartbeat);
      for (const waiting of pending.values()) clearTimeout(waiting.timer);
      if (browserEvents) {
        window.removeEventListener('online', wake);
        document.removeEventListener('visibilitychange', wake);
      }
      if (socket) {
        socket.onopen =
          socket.onmessage =
          socket.onclose =
          socket.onerror =
            null;
        try {
          socket.close(1000, 'Left the room');
        } catch {
          // Not open yet.
        }
      }
    },
    get mode() {
      return mode;
    },
  };
}
