import {
  ARCHIVE_LIMIT,
  ARCHIVE_MAX_LENGTH,
  parseArchive,
  serializeArchive,
} from '../lib/archive';
import { player } from './accounts';
import { sameOrigin } from './identity';

// 最近对局 kept on the account, so another device signed in to it sees the same list.
const PAGE = 50;
const noStore = { 'Cache-Control': 'no-store, private' };
const fail = (error: string, status: number) =>
  Response.json({ error }, { status, headers: noStore });
const done = () => new Response(null, { status: 204, headers: noStore });

/** The account behind a same-origin request, or the response refusing it. */
async function owner(req: Request, db: D1Database) {
  const refused = sameOrigin(req);
  if (refused) return refused;
  const me = await player(req, db);
  return me.signedIn ? me.id : fail('请先登录。', 401);
}

// A page ends at `${played_at}:${id}` of its last game; the next page starts after it.
function position(cursor: string): [number, string] | null {
  const split = cursor.indexOf(':');
  const at = Number(cursor.slice(0, split));
  return split > 0 && Number.isSafeInteger(at)
    ? [at, cursor.slice(split + 1)]
    : null;
}

/** Newest first, a page at a time; `?id=` reads one game instead. */
export async function listGames(req: Request, db: D1Database) {
  const user = await owner(req, db);
  if (user instanceof Response) return user;
  const params = new URL(req.url).searchParams;
  const id = params.get('id');
  if (id !== null) {
    const row = await db
      .prepare('SELECT data FROM archived_games WHERE user_id = ? AND id = ?')
      .bind(user, id)
      .first<{ data: string }>();
    return row
      ? Response.json({ game: JSON.parse(row.data) }, { headers: noStore })
      : fail('找不到这盘对局。', 404);
  }
  const before = params.get('before');
  const after = before === null ? null : position(before);
  if (before !== null && !after) return fail('分页参数无效。', 400);
  // No game is dated near the largest safe integer, so the first page has no bound.
  const [at, last] = after ?? [Number.MAX_SAFE_INTEGER, ''];
  const { results } = await db
    .prepare(
      `SELECT id, played_at, data FROM archived_games
       WHERE user_id = ? AND (played_at, id) < (?, ?)
       ORDER BY played_at DESC, id DESC LIMIT ?`,
    )
    .bind(user, at, last, PAGE + 1)
    .all<{ id: string; played_at: number; data: string }>();
  const page = results.slice(0, PAGE);
  const end = page.at(-1);
  return Response.json(
    {
      games: page.map((row) => JSON.parse(row.data) as unknown),
      next: results.length > PAGE && end ? `${end.played_at}:${end.id}` : null,
    },
    { headers: noStore },
  );
}

/** Stores a finished game once; sending it again changes nothing. Past 200, the
 * oldest go, as in the browser. */
export async function saveGame(req: Request, db: D1Database, now = Date.now()) {
  const user = await owner(req, db);
  if (user instanceof Response) return user;
  const raw = await req.text();
  if (raw.length > ARCHIVE_MAX_LENGTH) return fail('请求内容过长。', 413);
  let game = null;
  try {
    game = parseArchive(JSON.parse(raw));
  } catch {}
  if (!game) return fail('对局数据无效。', 400);
  await db.batch([
    db
      .prepare(
        `INSERT INTO archived_games (user_id, id, played_at, data, created_at)
         VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
      )
      .bind(user, game.id, Date.parse(game.date), serializeArchive(game), now),
    db
      .prepare(
        `DELETE FROM archived_games WHERE user_id = ?1 AND id IN (
           SELECT id FROM archived_games WHERE user_id = ?1
           ORDER BY played_at DESC, id DESC LIMIT -1 OFFSET ?2)`,
      )
      .bind(user, ARCHIVE_LIMIT),
  ]);
  return done();
}

export async function deleteGame(req: Request, db: D1Database) {
  const user = await owner(req, db);
  if (user instanceof Response) return user;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail('缺少对局编号。', 400);
  await db
    .prepare('DELETE FROM archived_games WHERE user_id = ? AND id = ?')
    .bind(user, id)
    .run();
  return done();
}
