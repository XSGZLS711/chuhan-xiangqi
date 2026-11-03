import { randomHex, validateRequestOrigin } from './identity';
import { player } from './accounts';
import { database } from './db';
import { HOLD_MS, present, touchPresence, waitForChange } from './room-poll';
import { LIVE_ROOM, PLAYER_HEADER, liveRoom } from './room-object';
import { isLocal, usage } from './usage';
import { errorBody } from '../lib/errors';
import {
  Room,
  PublicRoom,
  newRoom,
  playerSide,
  clockDeadline,
  expireClock,
  applyAction,
  GameError,
  cleanName,
} from '../lib/game';
const headers = {
  'Cache-Control': 'no-store, private',
  'X-Content-Type-Options': 'nosniff',
};
function reply(data: unknown, cookie = '', status = 200) {
  return Response.json(data, {
    status,
    headers: { ...headers, ...(cookie ? { 'Set-Cookie': cookie } : {}) },
  });
}
function validRoom(id: string) {
  if (!/^[a-f0-9]{20}$/.test(id)) throw new GameError('bad-room-link', 404);
}
async function readRoom(id: string) {
  validRoom(id);
  const db = database().withSession('first-primary');
  const row = await db
    .prepare('SELECT state, version FROM rooms WHERE id = ?')
    .bind(id)
    .first<{ state: string; version: number }>();
  if (!row) throw new GameError('room-not-found', 404);
  return { db, room: JSON.parse(row.state) as Room, version: row.version };
}
async function publicState(
  room: Room,
  version: number,
  id: string,
): Promise<PublicRoom> {
  const db = database(),
    side = playerSide(room, id),
    now = Date.now();
  if (side)
    usage.d1RowsWritten += await touchPresence(db, room.id + ':' + id, now);
  // Either seat may still be open: the one who made the room can sit on either side.
  const seats = [room.players.red, room.players.black];
  const online = await present(
    db,
    seats.flatMap((seat) => (seat ? [room.id + ':' + seat.id] : [])),
    now,
  );
  const [red, black] = seats.map(
    (seat) => seat && { name: seat.name, online: online.shift() ?? false },
  );
  return {
    ...room,
    players: { red, black },
    you: side,
    version,
    serverNow: now,
  };
}
async function handleGet(req: Request) {
  let cookie = '';
  try {
    const identityValue = await player(req, database());
    cookie = identityValue.cookie;
    const params = new URL(req.url).searchParams;
    const id = params.get('room');
    if (params.has('usage') && isLocal(req)) return reply(usage, cookie);
    if (!id) return reply({ ready: true }, cookie);
    if (LIVE_ROOM.test(id)) {
      const since = params.get('since');
      const out = await liveRoom(id).view(
        identityValue.id,
        since === null ? null : Number(since),
        params.has('wire'),
      );
      return reply(out.body, cookie, out.status);
    }
    const { db, ...current } = await readRoom(id);
    let { room, version } = current;
    // The page already has this version: wait here for the next change rather than
    // answering now and being asked again a moment later.
    if (params.get('since') === String(version)) {
      await waitForChange(
        db,
        id,
        version,
        Math.min(Date.now() + HOLD_MS, clockDeadline(room)),
      );
      ({ room, version } = await readRoom(id));
    }
    if (expireClock(room, Date.now())) {
      const saved = await db
        .prepare(
          'UPDATE rooms SET state=?, version=version+1, updated_at=? WHERE id=? AND version=?',
        )
        .bind(JSON.stringify(room), Date.now(), id, version)
        .run();
      usage.d1RowsWritten += saved.meta.rows_written ?? 0;
      if (saved.meta.changes) version++;
      else {
        const fresh = await readRoom(id);
        room = fresh.room;
        version = fresh.version;
      }
    }
    return reply(await publicState(room, version, identityValue.id), cookie);
  } catch (error) {
    return failure(error, cookie);
  }
}
async function handlePost(req: Request) {
  let cookie = '';
  try {
    const raw = await req.text();
    if (raw.length > 4096) throw new GameError('request-too-large', 413);
    let a: Record<string, unknown>;
    try {
      a = JSON.parse(raw);
    } catch {
      throw new GameError('bad-request');
    }
    if (!a || typeof a !== 'object' || Array.isArray(a))
      throw new GameError('bad-request');
    const me = await player(req, database());
    cookie = me.cookie;
    const now = Date.now();
    if (a.action === 'create') {
      const clock = Number(a.clockMinutes ?? 0);
      // The local server also takes clocks under a minute, so a test can see one run out.
      const testClock = isLocal(req) && clock > 0 && clock <= 1;
      if (![0, 10, 20, 30].includes(clock) && !testClock)
        throw new GameError('bad-clock');
      // The one who makes the room picks a side; pages from before the choice send none.
      const side = a.side ?? 'red';
      if (side !== 'red' && side !== 'black')
        throw new GameError('bad-request');
      const seat = { id: me.id, name: cleanName(a.name) };
      // New rooms live in a Durable Object. A local test can still make a D1 room.
      if (!(a.store === 'd1' && isLocal(req))) {
        const id = randomHex(12);
        const out = await liveRoom(id).create(id, seat, clock, side);
        return reply(out.body, cookie, out.status);
      }
      const id = randomHex(10);
      const room = newRoom(id, seat, clock, now, side);
      const saved = await database()
        .prepare(
          'INSERT INTO rooms (id,state,version,updated_at) VALUES (?,?,0,?)',
        )
        .bind(id, JSON.stringify(room), now)
        .run();
      usage.d1RowsWritten += saved.meta.rows_written ?? 0;
      return reply(await publicState(room, 0, me.id), cookie);
    }
    const id = typeof a.room === 'string' ? a.room : '';
    if (LIVE_ROOM.test(id)) {
      const out = await liveRoom(id).act(me.id, a, a.wire === true);
      return reply(out.body, cookie, out.status);
    }
    const { db, room, version } = await readRoom(id);
    if (a.version !== version) throw new GameError('room-changed', 409);
    if (expireClock(room, now)) {
      const saved = await db
        .prepare(
          'UPDATE rooms SET state=?,version=version+1,updated_at=? WHERE id=? AND version=?',
        )
        .bind(JSON.stringify(room), now, id, version)
        .run();
      usage.d1RowsWritten += saved.meta.rows_written ?? 0;
      if (!saved.meta.changes) throw new GameError('room-changed-retry', 409);
      return reply(await publicState(room, version + 1, me.id), cookie);
    }
    applyAction(room, me.id, a, now);
    const saved = await db
      .prepare(
        'UPDATE rooms SET state=?,version=version+1,updated_at=? WHERE id=? AND version=?',
      )
      .bind(JSON.stringify(room), now, id, version)
      .run();
    usage.d1RowsWritten += saved.meta.rows_written ?? 0;
    if (!saved.meta.changes) throw new GameError('opponent-acted', 409);
    return reply(await publicState(room, version + 1, me.id), cookie);
  } catch (error) {
    return failure(error, cookie);
  }
}
function failure(error: unknown, cookie: string) {
  if (error instanceof GameError)
    return reply(errorBody(error.code), cookie, error.status);
  console.error(
    'Game request failed',
    error instanceof Error ? error.message : 'Unknown error',
  );
  return reply(errorBody('unavailable'), cookie, 503);
}

async function withOrigin(
  req: Request,
  handler: (req: Request) => Promise<Response>,
) {
  usage.worker++;
  try {
    validateRequestOrigin(req);
    return await handler(req);
  } catch (error) {
    return failure(error, '');
  }
}
export async function GET(req: Request) {
  return withOrigin(req, handleGet);
}
export async function POST(req: Request) {
  return withOrigin(req, handlePost);
}
/** A page's socket to a Durable Object room. Browsers always send `Origin` on a socket, and
 * no CORS stands between another site and this one, so the origin must be present and ours. */
export async function SOCKET(req: Request) {
  return withOrigin(req, async () => {
    if (!req.headers.get('origin')) throw new GameError('cross-site', 403);
    const url = new URL(req.url),
      id = url.searchParams.get('room') ?? '';
    if (req.headers.get('upgrade')?.toLowerCase() !== 'websocket')
      throw new GameError('bad-request', 426);
    if (!LIVE_ROOM.test(id)) throw new GameError('bad-room-link', 404);
    const me = await player(req, database());
    const headers = new Headers(req.headers);
    headers.set(PLAYER_HEADER, me.id);
    return liveRoom(id).fetch(new Request(url, { headers }));
  });
}
