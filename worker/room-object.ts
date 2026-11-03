import { DurableObject, env } from 'cloudflare:workers';
import { errorBody, type ErrorCode } from '../lib/errors';
import {
  applyAction,
  clockDeadline,
  expireClock,
  GameError,
  newRoom,
  playerSide,
  type Player,
  type PublicRoom,
  type Room,
} from '../lib/game';
import { pack, unpack, type Wire } from '../lib/room-wire';
import { opposite } from '../lib/xiangqi';
import { HOLD_MS, ONLINE_MS } from './room-poll';
import { usage } from './usage';

/** Rooms made since the move to Durable Objects have a longer id; the 20-character ones are
 * rows in D1, read by `game-api.ts` as before. */
export const LIVE_ROOM = /^[a-f0-9]{24}$/;
/** Set by the Worker on what it forwards; a page cannot reach a room object directly. */
export const PLAYER_HEADER = 'X-Chuhan-Player';

// A socket that sent nothing for this long no longer counts as present; pages ping every 15 s.
const SOCKET_ONLINE_MS = 40000;
const MAX_SOCKETS = 64;
// Request ids remembered, so an action sent again after a reconnect is answered, not repeated.
const DONE_KEPT = 32;
// More messages than this in 10 s closes the socket.
const MESSAGE_BUDGET = 40;

/** A room as a page receives it over the socket. */
export type WireRoom = Wire<PublicRoom>;
/** What the Worker answers a request with. */
export type Outcome = {
  status: number;
  body: PublicRoom | WireRoom | ReturnType<typeof errorBody>;
};
type Seat = { player: string; seen: number };
type Result = { status: number; code?: ErrorCode };

const failed = (code: ErrorCode, status: number): Outcome => ({
  status,
  body: errorBody(code),
});
const seatOf = (ws: WebSocket) => ws.deserializeAttachment() as Seat | null;
function send(ws: WebSocket, message: unknown) {
  try {
    ws.send(typeof message === 'string' ? message : JSON.stringify(message));
  } catch {
    // Already closing; its close event tidies up.
  }
}

/** The latest moment a timeout can be noticed on time. It only moves later as the game goes
 * on (moves, undos and rematches never bring it closer), so one alarm outlives many moves. */
function nextCheck(room: Room, now: number): number | null {
  const deadline = clockDeadline(room);
  if (deadline === Infinity) return null;
  return Math.min(
    deadline,
    now + Math.max(1000, room.clocks[opposite(room.turn)]),
  );
}

/** One friend room: its state in SQLite, its players on hibernating sockets, its clock on an
 * alarm. Rules stay in `lib/game.ts`. */
export class GameRoom extends DurableObject {
  private room: Room | null = null;
  private version = 0;
  private done: string[] = [];
  /** The room as stored, until the next change; sockets get it with their own `you`. */
  private packed: Wire<Room> | null = null;
  /** `undefined` until read after waking. */
  private alarmAt: number | null | undefined;
  private waiters = new Set<() => void>();
  /** When each player polling over HTTP (the fallback, older tabs) last asked. */
  private polled = new Map<string, number>();
  private shown = '';
  private budgets = new WeakMap<WebSocket, { from: number; count: number }>();

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env);
    // Opening a room that was never made writes nothing, so a wrong link leaves no trace.
    const sql = ctx.storage.sql;
    if (
      !sql
        .exec(
          "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'room'",
        )
        .toArray().length
    )
      return;
    const row = sql
      .exec<{
        state: string;
        version: number;
        done: string;
      }>('SELECT state, version, done FROM room WHERE id = 1')
      .toArray()[0];
    if (!row) return;
    this.packed = JSON.parse(row.state) as Wire<Room>;
    this.room = unpack(this.packed);
    this.version = row.version;
    this.done = JSON.parse(row.done) as string[];
  }

  async create(
    id: string,
    seat: Player,
    clockMinutes: number,
  ): Promise<Outcome> {
    usage.durable++;
    if (this.room) return failed('room-changed-retry', 409);
    const now = Date.now();
    this.room = newRoom(id, seat, clockMinutes, now);
    this.packed = pack(this.room);
    const sql = this.ctx.storage.sql;
    for (const cursor of [
      sql.exec(
        'CREATE TABLE room (id INTEGER PRIMARY KEY, state TEXT NOT NULL, version INTEGER NOT NULL, done TEXT NOT NULL)',
      ),
      sql.exec(
        "INSERT INTO room (id, state, version, done) VALUES (1, ?, 0, '[]')",
        JSON.stringify(this.packed),
      ),
    ]) {
      cursor.toArray();
      usage.durableRowsWritten += cursor.rowsWritten;
    }
    this.index(seat.id, now);
    return { status: 200, body: this.full(seat.id, now) };
  }

  /** An HTTP poll. With `since` the current version, waits for the next one or `HOLD_MS`. */
  async view(
    player: string,
    since: number | null,
    wire: boolean,
  ): Promise<Outcome> {
    usage.durable++;
    if (!this.room) return failed('room-not-found', 404);
    let now = Date.now();
    this.poll(player, now);
    if (expireClock(this.room, now)) await this.commit(now);
    else if (since === this.version)
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          this.waiters.delete(done);
          resolve();
        };
        const timer = setTimeout(done, HOLD_MS);
        this.waiters.add(done);
      });
    now = Date.now();
    this.polled.set(player, now);
    return { status: 200, body: this.answer(player, now, wire) };
  }

  /** An action over HTTP: the polling fallback and older tabs. */
  async act(
    player: string,
    body: Record<string, unknown>,
    wire: boolean,
  ): Promise<Outcome> {
    usage.durable++;
    const now = Date.now();
    this.poll(player, now);
    const result = await this.apply(player, body, now);
    if (result.code) return failed(result.code, result.status);
    return { status: 200, body: this.answer(player, now, wire) };
  }

  /** Signing in brings this browser's seat along, as `moveSeats` does for D1 rooms. */
  async moveSeat(from: string, to: string) {
    usage.durable++;
    const room = this.room;
    if (!room) return false;
    const seats = [room.players.red, room.players.black];
    // Both seats would become one player, who could then only ever move red.
    if (seats.some((seat) => seat?.id === to)) return false;
    let moved = false;
    for (const seat of seats)
      if (seat?.id === from) {
        seat.id = to;
        moved = true;
      }
    if (!moved) return false;
    const now = Date.now();
    await this.commit(now);
    this.index(to, now);
    return true;
  }

  /** A page's socket, forwarded by the Worker once it has checked the origin and the player. */
  async fetch(req: Request) {
    usage.durable++;
    if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response(null, { status: 426 });
    if (!this.room)
      return Response.json(errorBody('room-not-found'), { status: 404 });
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS)
      return Response.json(errorBody('unavailable'), { status: 503 });
    const player = req.headers.get(PLAYER_HEADER) || 'unknown';
    const known = new URL(req.url).searchParams.get('v');
    const now = Date.now();
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server, [player]);
    server.serializeAttachment({ player, seen: now } satisfies Seat);
    // Back after a drop: only what changed meanwhile, which may be nothing.
    if (expireClock(this.room, now)) await this.commit(now);
    else if (known === String(this.version)) send(server, this.presence(now));
    else send(server, { t: 'room', room: this.wire(player, now) });
    this.tellPresence(now);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    usage.socketMessages++;
    const now = Date.now();
    if (typeof message !== 'string' || message.length > 4096)
      return ws.close(1009, 'Message too large');
    if (this.flooding(ws, now)) return ws.close(1008, 'Too many messages');
    const seat = seatOf(ws);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(message);
    } catch {
      return;
    }
    if (!seat || !data || typeof data !== 'object') return;
    seat.seen = now;
    ws.serializeAttachment(seat);
    if (!this.room) return;
    if (expireClock(this.room, now)) await this.commit(now);
    if (data.t === 'ping') {
      send(ws, '{"t":"pong"}');
      // Anyone gone quiet since the last message drops out of the presence shown.
      this.tellPresence(now);
      return;
    }
    if (data.t !== 'act') return;
    const result = await this.apply(seat.player, data, now);
    // The page acted on an old version: give it the current one before the refusal.
    if (result.status === 409)
      send(ws, { t: 'room', room: this.wire(seat.player, now) });
    send(ws, {
      t: 'ack',
      request: data.request,
      status: result.status,
      ...(result.code ? errorBody(result.code) : {}),
    });
  }

  async webSocketClose(ws: WebSocket) {
    usage.socketCloses++;
    try {
      ws.close(1000, 'Closed');
    } catch {
      // Closed already.
    }
    this.tellPresence(Date.now());
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    usage.durable++;
    usage.alarms++;
    this.alarmAt = null;
    if (!this.room) return;
    const now = Date.now();
    if (expireClock(this.room, now)) await this.commit(now);
    else await this.schedule(now);
  }

  private async apply(
    player: string,
    action: Record<string, unknown>,
    now: number,
  ): Promise<Result> {
    const room = this.room;
    if (!room) return { status: 404, code: 'room-not-found' };
    const request =
      typeof action.request === 'string' ? action.request.slice(0, 40) : '';
    if (request && this.done.includes(request)) return { status: 200 };
    // As in D1 rooms: a clock that ran out ends the game before anything else happens.
    if (expireClock(room, now)) {
      await this.commit(now);
      return { status: 200 };
    }
    if (action.version !== this.version)
      return { status: 409, code: 'room-changed' };
    if (action.action === 'join' && playerSide(room, player))
      return { status: 200 };
    const next = structuredClone(room);
    try {
      applyAction(next, player, action, now);
    } catch (error) {
      if (error instanceof GameError)
        return { status: error.status, code: error.code };
      throw error;
    }
    const seated = !playerSide(room, player) && !!playerSide(next, player);
    this.room = next;
    if (request) this.done = [...this.done, request].slice(-DONE_KEPT);
    await this.commit(now);
    if (seated) this.index(player, now);
    return { status: 200 };
  }

  /** Stores the next version and sends it to every socket. The answers wait until it is
   * written, so nothing a page has seen can be lost. */
  private async commit(now: number) {
    this.version++;
    this.packed = pack(this.room!);
    const cursor = this.ctx.storage.sql.exec(
      'UPDATE room SET state = ?, version = ?, done = ? WHERE id = 1',
      JSON.stringify(this.packed),
      this.version,
      JSON.stringify(this.done),
    );
    cursor.toArray();
    usage.durableRowsWritten += cursor.rowsWritten;
    for (const ws of this.ctx.getWebSockets())
      send(ws, { t: 'room', room: this.wire(seatOf(ws)?.player ?? '', now) });
    this.shown = this.presenceKey(now);
    // Each one leaves the set as it wakes, which a set allows mid-loop.
    for (const wake of this.waiters) wake();
    await this.schedule(now);
  }

  /** Keeps an alarm at or before the next possible timeout, writing it only when it must move. */
  private async schedule(now: number) {
    const want = nextCheck(this.room!, now);
    if (want === null) return;
    if (this.alarmAt === undefined)
      this.alarmAt = await this.ctx.storage.getAlarm();
    if (this.alarmAt !== null && this.alarmAt <= want) return;
    await this.ctx.storage.setAlarm(want);
    this.alarmAt = want;
    usage.durableRowsWritten++;
  }

  /** Remembers which rooms a player sits in, so signing in can bring the seat along. */
  private index(player: string, now: number) {
    const id = this.room!.id;
    this.ctx.waitUntil(
      env.SEATS.getByName(player)
        .add(id, now)
        .catch((error: unknown) =>
          console.error(
            'Seat index failed',
            error instanceof Error ? error.message : 'unknown',
          ),
        ),
    );
  }

  private poll(player: string, now: number) {
    const fresh = !(now - (this.polled.get(player) ?? -Infinity) < ONLINE_MS);
    this.polled.set(player, now);
    if (fresh) this.tellPresence(now);
  }

  private online(id: string, now: number) {
    if (now - (this.polled.get(id) ?? -Infinity) < ONLINE_MS) return true;
    return this.ctx
      .getWebSockets(id)
      .some(
        (ws) =>
          ws.readyState === WebSocket.OPEN &&
          now - (seatOf(ws)?.seen ?? 0) < SOCKET_ONLINE_MS,
      );
  }

  private players(now: number): PublicRoom['players'] {
    const { red, black } = this.room!.players;
    return {
      red: { name: red.name, online: this.online(red.id, now) },
      black: black
        ? { name: black.name, online: this.online(black.id, now) }
        : null,
    };
  }

  private presenceKey(now: number) {
    const { red, black } = this.players(now);
    return `${red.online}:${black?.online ?? ''}`;
  }

  private presence(now: number) {
    return {
      t: 'presence',
      version: this.version,
      players: this.players(now),
      serverNow: now,
    };
  }

  /** Tells every socket who is present, when that changed since it was last told. */
  private tellPresence(now: number) {
    if (!this.room) return;
    const key = this.presenceKey(now);
    if (key === this.shown) return;
    this.shown = key;
    const message = JSON.stringify(this.presence(now));
    for (const ws of this.ctx.getWebSockets()) send(ws, message);
  }

  private personal(player: string, now: number) {
    return {
      players: this.players(now),
      you: player ? playerSide(this.room!, player) : null,
      version: this.version,
      serverNow: now,
    };
  }

  /** The room as older tabs read it, every board included. */
  private full(player: string, now: number): PublicRoom {
    return { ...this.room!, ...this.personal(player, now) };
  }

  private wire(player: string, now: number): WireRoom {
    return { ...this.packed!, ...this.personal(player, now) } as WireRoom;
  }

  private answer(player: string, now: number, wire: boolean) {
    return wire ? this.wire(player, now) : this.full(player, now);
  }

  private flooding(ws: WebSocket, now: number) {
    const budget = this.budgets.get(ws);
    if (!budget || now - budget.from > 10000) {
      this.budgets.set(ws, { from: now, count: 1 });
      return false;
    }
    return ++budget.count > MESSAGE_BUDGET;
  }
}

/** The rooms each player sits in, one small object per player, so that signing in can move
 * their seats without a table in D1. */
export class PlayerSeats extends DurableObject {
  add(room: string, at: number) {
    usage.durable++;
    const sql = this.ctx.storage.sql;
    for (const cursor of [
      sql.exec(
        'CREATE TABLE IF NOT EXISTS seats (room TEXT PRIMARY KEY, at INTEGER NOT NULL)',
      ),
      sql.exec(
        'INSERT INTO seats (room, at) VALUES (?, ?) ON CONFLICT (room) DO UPDATE SET at = excluded.at',
        room,
        at,
      ),
    ]) {
      cursor.toArray();
      usage.durableRowsWritten += cursor.rowsWritten;
    }
  }

  /** The newest 20 rooms sat in since `since`. */
  recent(since: number): string[] {
    usage.durable++;
    const sql = this.ctx.storage.sql;
    if (
      !sql
        .exec(
          "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'seats'",
        )
        .toArray().length
    )
      return [];
    return sql
      .exec<{
        room: string;
      }>('SELECT room FROM seats WHERE at > ? ORDER BY at DESC LIMIT 20', since)
      .toArray()
      .map((row) => row.room);
  }

  async forget() {
    usage.durable++;
    await this.ctx.storage.deleteAll();
  }
}

/** A Durable Object room by its id. */
export const liveRoom = (id: string) => env.ROOMS.getByName(id);

/** Seats this browser took anonymously in Durable Object rooms now belong to the account. */
export async function moveLiveSeats(from: string, to: string, since: number) {
  try {
    const rooms = await env.SEATS.getByName(from).recent(since);
    for (const id of rooms) await liveRoom(id).moveSeat(from, to);
  } catch (error) {
    // Signing in still works; those seats stay anonymous, as a conflicting D1 room's do.
    console.error(
      'Moving live seats failed',
      error instanceof Error ? error.message : 'unknown',
    );
  }
}

/** A deleted account's list of rooms goes with it; the rooms keep only its random id. */
export async function forgetLiveSeats(player: string) {
  try {
    await env.SEATS.getByName(player).forget();
  } catch (error) {
    console.error(
      'Forgetting live seats failed',
      error instanceof Error ? error.message : 'unknown',
    );
  }
}
