import { validateRequestOrigin } from './identity';
import { player } from './accounts';
import { database } from './db';
import { HOLD_MS, present, touchPresence, waitForChange } from './room-poll';
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
  if (side) await touchPresence(db, room.id + ':' + id, now);
  const [red, black = false] = await present(
    db,
    [room.players.red, room.players.black].flatMap((seat) =>
      seat ? [room.id + ':' + seat.id] : [],
    ),
    now,
  );
  return {
    ...room,
    players: {
      red: { name: room.players.red.name, online: red },
      black: room.players.black
        ? { name: room.players.black.name, online: black }
        : null,
    },
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
    if (!id) return reply({ ready: true }, cookie);
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
      if (![0, 10, 20, 30].includes(clock)) throw new GameError('bad-clock');
      const id = Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) =>
        n.toString(16).padStart(2, '0'),
      ).join('');
      const room = newRoom(
        id,
        { id: me.id, name: cleanName(a.name) },
        clock,
        now,
      );
      await database()
        .prepare(
          'INSERT INTO rooms (id,state,version,updated_at) VALUES (?,?,0,?)',
        )
        .bind(id, JSON.stringify(room), now)
        .run();
      return reply(await publicState(room, 0, me.id), cookie);
    }
    const id = typeof a.room === 'string' ? a.room : '';
    const { db, room, version } = await readRoom(id);
    if (a.version !== version) throw new GameError('room-changed', 409);
    if (expireClock(room, now)) {
      const saved = await db
        .prepare(
          'UPDATE rooms SET state=?,version=version+1,updated_at=? WHERE id=? AND version=?',
        )
        .bind(JSON.stringify(room), now, id, version)
        .run();
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
