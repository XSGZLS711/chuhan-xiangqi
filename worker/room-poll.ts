// What a room poll costs in D1. Writes and Worker requests both stop at 100k a day on
// the free plan, so a seat refreshes its presence at most every few seconds and a poll
// that has nothing new waits on the server instead of being asked again.

/** A seat counts as present for this long after its last refresh. */
export const ONLINE_MS = 18000;
// Well inside ONLINE_MS even when a held poll answers late.
const REFRESH_MS = 4000;
/** The longest a poll waits for a change; the page aborts its request at 12 s. */
export const HOLD_MS = 8000;
// One version read per check; a move reaches the other side within about this long.
const CHECK_MS = 600;
// A database or a read session on one: either can prepare a statement.
type Db = Pick<D1Database, 'prepare'>;

export async function touchPresence(db: Db, key: string, now: number) {
  await db
    .prepare(
      `INSERT INTO presence (id, seen_at) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET seen_at = excluded.seen_at
       WHERE presence.seen_at <= ?`,
    )
    .bind(key, now, now - REFRESH_MS)
    .run();
}

export async function present(
  db: Db,
  keys: string[],
  now: number,
): Promise<boolean[]> {
  const { results } = await db
    .prepare(
      `SELECT id, seen_at FROM presence WHERE id IN (${keys.map(() => '?').join(', ')})`,
    )
    .bind(...keys)
    .all<{ id: string; seen_at: number }>();
  const seen = new Map(results.map((row) => [row.id, row.seen_at]));
  return keys.map((key) => now - (seen.get(key) ?? -Infinity) < ONLINE_MS);
}

/** Returns once the room's version is no longer `since`, or at `until`. */
export async function waitForChange(
  db: Db,
  id: string,
  since: number,
  until: number,
) {
  while (Date.now() < until) {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(CHECK_MS, until - Date.now())),
    );
    const row = await db
      .prepare('SELECT version FROM rooms WHERE id = ?')
      .bind(id)
      .first<{ version: number }>();
    if (row?.version !== since) return;
  }
}
