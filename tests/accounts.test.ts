import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import { newRoom, type Room } from '../lib/game';
import {
  account,
  deleteAccount,
  player,
  signIn,
  signOut,
} from '../worker/accounts';
import { hashToken } from '../worker/identity';

// A throwaway local D1 with every migration applied, as production has.
const dir = mkdtempSync(join(tmpdir(), 'chuhan-accounts-'));
const proxy = await getPlatformProxy<{ DB: D1Database }>({
  configPath: 'wrangler.jsonc',
  persist: { path: dir },
});
const db = proxy.env.DB;
for (const file of readdirSync('drizzle')
  .filter((f) => f.endsWith('.sql'))
  .sort())
  for (const statement of readFileSync(join('drizzle', file), 'utf8').split(
    '--> statement-breakpoint',
  ))
    if (statement.trim()) await db.prepare(statement).run();

let checks = 0;
async function test(name: string, run: () => Promise<void>) {
  await run();
  checks++;
  console.log('✓ ' + name);
}
const DAY = 86400000;
const now = Date.now();
const request = (token?: string) =>
  new Request('https://chess.example/api/game', {
    headers: token ? { cookie: `chuhan_session=${token}` } : {},
  });
const google = (subject: string, name = '棋友') => ({
  subject,
  email: subject + '@example.com',
  name,
});
async function addRoom(
  id: string,
  red: string,
  black: string | null,
  updatedAt = now,
) {
  const room = newRoom(id, { id: red, name: '红' }, 0, updatedAt);
  if (black) room.players.black = { id: black, name: '黑' };
  await db
    .prepare(
      'INSERT INTO rooms (id, state, version, updated_at) VALUES (?, ?, 0, ?)',
    )
    .bind(id, JSON.stringify(room), updatedAt)
    .run();
}
async function readRoom(id: string) {
  const row = await db
    .prepare('SELECT state, version FROM rooms WHERE id = ?')
    .bind(id)
    .first<{ state: string; version: number }>();
  const room = JSON.parse(row!.state) as Room;
  return {
    red: room.players.red.id,
    black: room.players.black?.id,
    version: row!.version,
  };
}

const tokenA = 'a'.repeat(64),
  tokenB = 'b'.repeat(64),
  other = 'c'.repeat(64);
const anonA = await hashToken(tokenA);
let sessionA = '',
  userA = '';

await test('没有会话时按匿名身份处理，新访客拿到新 Cookie', async () => {
  const fresh = await player(request(), db);
  assert(fresh.cookie.startsWith('chuhan_session=') && !fresh.signedIn);
  const known = await player(request(tokenA), db);
  assert.deepEqual(known, {
    id: anonA,
    cookie: '',
    device: anonA,
    signedIn: false,
  });
  assert.equal(await account(db, anonA), null);
});
await test('首次登录建号并开会话，匿名时的座位转到账号名下', async () => {
  await addRoom('r1', anonA, other);
  await addRoom('r2', other, anonA);
  await addRoom('old', anonA, other, now - 40 * DAY);
  sessionA = await signIn(
    db,
    google('g-1', '小楚'),
    await player(request(tokenA), db),
    now,
  );
  assert.match(sessionA, /^[a-f0-9]{64}$/);
  assert.notEqual(sessionA, tokenA, '登录后换一个新令牌');
  const me = await player(request(sessionA), db);
  assert(me.signedIn && /^[a-f0-9]{32}$/.test(me.id));
  userA = me.id;
  assert.deepEqual(await account(db, me.device), {
    name: '小楚',
    email: 'g-1@example.com',
  });
  assert.deepEqual(await readRoom('r1'), {
    red: userA,
    black: other,
    version: 1,
  });
  assert.deepEqual(await readRoom('r2'), {
    red: other,
    black: userA,
    version: 1,
  });
  assert.deepEqual(
    await readRoom('old'),
    { red: anonA, black: other, version: 0 },
    '早已结束的旧房间不动',
  );
  const stale = await player(request(tokenA), db);
  assert(!stale.signedIn && stale.id === anonA, '旧令牌不会变成账号');
});
await test('另一台设备用同一个 Google 账号登录，是同一个账号', async () => {
  const anonB = await hashToken(tokenB);
  // The account already sits red here; the anonymous black seat must not merge into it.
  await addRoom('self', userA, anonB);
  const token = await signIn(
    db,
    google('g-1'),
    await player(request(tokenB), db),
    now,
  );
  const second = await player(request(token), db);
  assert.equal(second.id, userA);
  assert(
    await player(request(sessionA), db).then((p) => p.signedIn),
    '第一台设备仍然登录',
  );
  assert.deepEqual(
    await readRoom('self'),
    { red: userA, black: anonB, version: 0 },
    '不把两个座位并成一人',
  );
  assert.equal(
    (await account(db, second.device))?.name,
    '小楚',
    '再次登录不改名字',
  );
});
await test('已登录时换另一个 Google 账号：旧会话作废，座位不跟过去', async () => {
  const before = await player(request(sessionA), db);
  const token = await signIn(db, google('g-2'), before, now);
  const switched = await player(request(token), db);
  assert(switched.signedIn && switched.id !== userA);
  assert.equal((await player(request(sessionA), db)).signedIn, false);
  assert.deepEqual(await readRoom('r1'), {
    red: userA,
    black: other,
    version: 1,
  });
});
await test('过期会话按匿名处理，登录时顺手清掉', async () => {
  const token = await signIn(
    db,
    google('g-3'),
    await player(request(other), db),
    now - 200 * DAY,
  );
  const expired = await player(request(token), db);
  assert(!expired.signedIn && expired.id === (await hashToken(token)));
  await signIn(
    db,
    google('g-3'),
    await player(request('d'.repeat(64)), db),
    now,
  );
  const left = await db
    .prepare('SELECT COUNT(*) AS n FROM sessions WHERE id = ?')
    .bind(await hashToken(token))
    .first<{ n: number }>();
  assert.equal(left?.n, 0);
});
await test('退出登录删除会话', async () => {
  const token = await signIn(
    db,
    google('g-4'),
    await player(request('e'.repeat(64)), db),
    now,
  );
  const me = await player(request(token), db);
  await signOut(db, me.device);
  assert.equal((await player(request(token), db)).signedIn, false);
});
await test('删除账号后登录方式和所有会话一并删除，同一 Google 账号再登录是新账号', async () => {
  const first = await signIn(
    db,
    google('g-5'),
    await player(request('f'.repeat(64)), db),
    now,
  );
  const second = await signIn(
    db,
    google('g-5'),
    await player(request('0'.repeat(64)), db),
    now,
  );
  const me = await player(request(first), db);
  await deleteAccount(db, me.id);
  assert.equal((await player(request(first), db)).signedIn, false);
  assert.equal(
    (await player(request(second), db)).signedIn,
    false,
    '其他设备也一并退出',
  );
  for (const table of ['users', 'identities', 'sessions']) {
    const row = await db
      .prepare(
        `SELECT COUNT(*) AS n FROM ${table} WHERE ${table === 'users' ? 'id' : 'user_id'} = ?`,
      )
      .bind(me.id)
      .first<{ n: number }>();
    assert.equal(row?.n, 0, table);
  }
  const again = await signIn(
    db,
    google('g-5'),
    await player(request('f'.repeat(64)), db),
    now,
  );
  assert.notEqual((await player(request(again), db)).id, me.id);
});
await test('账号表不可用时照常按匿名下棋', async () => {
  const broken = {
    prepare() {
      throw new Error('no such table: sessions');
    },
  } as unknown as D1Database;
  const original = console.error;
  console.error = () => {};
  try {
    const anonymous = await player(request(tokenA), broken);
    assert(!anonymous.signedIn && anonymous.id === anonA);
  } finally {
    console.error = original;
  }
});

await proxy.dispose();
rmSync(dir, { recursive: true, force: true });
console.log(`\n${checks} account checks passed`);
