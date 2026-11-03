import type { Room } from '../lib/game';
import type { GoogleAccount } from './google';
import { hashToken, identity, randomHex } from './identity';

const DAY = 86400000;
export const SESSION_DAYS = 180;
// Rooms older than this are over in practice; their seats are left as they were.
const SEAT_DAYS = 30;

/** The player behind a request: an account when the cookie holds a live session,
 * otherwise the anonymous token. `device` is the cookie's hash either way. */
export async function player(req: Request, db: D1Database) {
  const device = await identity(req);
  const anonymous = { ...device, device: device.id, signedIn: false };
  // A token issued on this request cannot have a session yet.
  if (device.cookie) return anonymous;
  try {
    const row = await db
      .prepare('SELECT user_id FROM sessions WHERE id = ? AND expires_at > ?')
      .bind(device.id, Date.now())
      .first<{ user_id: string }>();
    return row
      ? { id: row.user_id, cookie: '', device: device.id, signedIn: true }
      : anonymous;
  } catch (error) {
    // Games keep working as anonymous if accounts are unavailable (say, before the
    // migration has run), rather than every request failing.
    console.error(
      'Session lookup failed',
      error instanceof Error ? error.message : 'unknown',
    );
    return anonymous;
  }
}
export type Player = Awaited<ReturnType<typeof player>>;

export async function account(db: D1Database, device: string) {
  return db
    .prepare(
      `SELECT u.name, i.email FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN identities i ON i.user_id = u.id AND i.provider = 'google'
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(device, Date.now())
    .first<{ name: string; email: string | null }>();
}

/** Finds or creates the account, starts a session and returns its new cookie token.
 * The old token is dropped so a token known before sign-in is worthless after it. */
export async function signIn(
  db: D1Database,
  google: GoogleAccount,
  before: Player,
  now: number,
): Promise<string> {
  const known = await db
    .prepare(
      "SELECT user_id FROM identities WHERE provider = 'google' AND subject = ?",
    )
    .bind(google.subject)
    .first<{ user_id: string }>();
  const userId = known?.user_id ?? randomHex(16);
  const token = randomHex(32);
  await db.batch([
    ...(known
      ? [
          db
            .prepare(
              "UPDATE identities SET email = ? WHERE provider = 'google' AND subject = ?",
            )
            .bind(google.email, google.subject),
          // There is no renaming yet, so the name follows Google's.
          db
            .prepare('UPDATE users SET name = ? WHERE id = ?')
            .bind(google.name, userId),
        ]
      : [
          db
            .prepare(
              'INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)',
            )
            .bind(userId, google.name, now),
          db
            .prepare(
              "INSERT INTO identities (provider, subject, user_id, email, created_at) VALUES ('google', ?, ?, ?, ?)",
            )
            .bind(google.subject, userId, google.email, now),
        ]),
    db
      .prepare(
        'INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      )
      .bind(await hashToken(token), userId, now, now + SESSION_DAYS * DAY),
    db.prepare('DELETE FROM sessions WHERE id = ?').bind(before.device),
    db
      .prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?')
      .bind(userId, now),
  ]);
  // Seats taken anonymously come along; one account's seats never move to another.
  if (!before.signedIn) await moveSeats(db, before.id, userId, now);
  return token;
}

export async function signOut(db: D1Database, device: string) {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(device).run();
}

/** Removes the account, its sign-in methods and every session. Rooms keep only the
 * account's random id in their seats, which then belongs to no one. */
export async function deleteAccount(db: D1Database, userId: string) {
  await db.batch(
    ['sessions', 'identities', 'users'].map((table) =>
      db
        .prepare(
          `DELETE FROM ${table} WHERE ${table === 'users' ? 'id' : 'user_id'} = ?`,
        )
        .bind(userId),
    ),
  );
}

/** Rooms this browser sat in before signing in now belong to the account. */
export async function moveSeats(
  db: D1Database,
  from: string,
  to: string,
  now: number,
) {
  const { results } = await db
    .prepare(
      'SELECT id, state, version FROM rooms WHERE updated_at > ? AND instr(state, ?) > 0 LIMIT 20',
    )
    .bind(now - SEAT_DAYS * DAY, `"id":"${from}"`)
    .all<{ id: string; state: string; version: number }>();
  for (const row of results) {
    const room = JSON.parse(row.state) as Room;
    const seats = [room.players.red, room.players.black];
    // Both seats would become one player, who could then only ever move red.
    if (seats.some((seat) => seat?.id === to)) continue;
    for (const seat of seats) if (seat?.id === from) seat.id = to;
    // A move landing at the same instant wins; that room keeps its anonymous seat.
    await db
      .prepare(
        'UPDATE rooms SET state = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?',
      )
      .bind(JSON.stringify(room), now, row.id, row.version)
      .run();
  }
}
