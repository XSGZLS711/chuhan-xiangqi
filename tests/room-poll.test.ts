import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getPlatformProxy } from 'wrangler';
import {
  HOLD_MS,
  ONLINE_MS,
  present,
  touchPresence,
  waitForChange,
} from '../worker/room-poll';

// A throwaway local D1 with every migration applied, as production has.
const dir = mkdtempSync(join(tmpdir(), 'chuhan-rooms-'));
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
// Counts statements and the rows D1 reports writing, as the bill would.
const usage = { queries: 0, written: 0 };
const counted = {
  prepare(sql: string) {
    usage.queries++;
    const statement = db.prepare(sql);
    return {
      bind: (...values: unknown[]) => {
        const bound = statement.bind(...values);
        return {
          run: async () => {
            const result = await bound.run();
            usage.written += result.meta.rows_written ?? 0;
            return result;
          },
          all: <T>() => bound.all<T>(),
          first: <T>() => bound.first<T>(),
        };
      },
    };
  },
} as unknown as D1Database;
const seenAt = async (key: string) =>
  (
    await db
      .prepare('SELECT seen_at FROM presence WHERE id = ?')
      .bind(key)
      .first<{ seen_at: number }>()
  )?.seen_at;
const t = 1_800_000_000_000;

await test('在线状态 4 秒内不重写，过了 4 秒才刷新', async () => {
  usage.written = 0;
  await touchPresence(counted, 'r1:red', t);
  assert.equal(await seenAt('r1:red'), t);
  const first = usage.written;
  assert(first > 0, '第一次写入');
  await touchPresence(counted, 'r1:red', t + 3999);
  assert.equal(usage.written, first, '4 秒内一行都不写');
  assert.equal(await seenAt('r1:red'), t);
  await touchPresence(counted, 'r1:red', t + 4000);
  assert.equal(await seenAt('r1:red'), t + 4000);
  assert.equal(usage.written, first + 1);
});
await test('最近 18 秒刷新过才算在线，没来过的座位不在线', async () => {
  assert.deepEqual(
    await present(db, ['r1:red', 'r1:black'], t + 4000 + ONLINE_MS - 1),
    [true, false],
  );
  assert.deepEqual(await present(db, ['r1:red'], t + 4000 + ONLINE_MS), [
    false,
  ]);
});
await test('按旧节奏每 1.4 秒轮询 10 分钟：写入降到约三分之一，在线状态不闪', async () => {
  usage.written = 0;
  const polls = Math.floor(600000 / 1400);
  for (let i = 0; i < polls; i++) {
    const now = t + 100000 + i * 1400;
    await touchPresence(counted, 'r2:red', now);
    await touchPresence(counted, 'r2:black', now + 700);
    assert.deepEqual(await present(db, ['r2:red', 'r2:black'], now + 700), [
      true,
      true,
    ]);
  }
  // Before: one write per poll. Now at most one per 4 s per seat.
  assert(usage.written <= 2 * (600000 / 4000 + 2), String(usage.written));
  assert(usage.written < (2 * polls) / 2.5, String(usage.written));
  console.log(
    `  ${2 * polls} 次轮询写了 ${usage.written} 行（改动前每次一行）`,
  );
});

const room = async (version: number) => {
  await db
    .prepare(
      `INSERT INTO rooms (id, state, version, updated_at) VALUES ('held', '{}', ?, 0)
       ON CONFLICT(id) DO UPDATE SET version = excluded.version`,
    )
    .bind(version)
    .run();
};
const timed = async (run: () => Promise<void>) => {
  const start = Date.now();
  await run();
  return Date.now() - start;
};
await test('没有变化时一直等到截止时间，只读不写', async () => {
  await room(5);
  usage.queries = 0;
  usage.written = 0;
  const waited = await timed(() =>
    waitForChange(counted, 'held', 5, Date.now() + 1500),
  );
  assert(waited >= 1500 && waited < 1900, String(waited));
  assert(usage.queries <= 4, String(usage.queries));
  assert.equal(usage.written, 0);
});
await test('对方一落子（版本变了），挂起的请求不到 0.7 秒就返回', async () => {
  await room(6);
  const change = setTimeout(() => void room(7), 300);
  const waited = await timed(() =>
    waitForChange(db, 'held', 6, Date.now() + HOLD_MS),
  );
  clearTimeout(change);
  assert(waited >= 300 && waited < 1000, String(waited));
});
await test('手里的版本已经旧了就马上返回；截止时间已过就不等', async () => {
  const stale = await timed(() =>
    waitForChange(db, 'held', 6, Date.now() + HOLD_MS),
  );
  assert(stale < 700, String(stale));
  usage.queries = 0;
  const past = await timed(() =>
    waitForChange(counted, 'held', 7, Date.now() - 1),
  );
  assert(past < 50 && usage.queries === 0);
});

await proxy.dispose();
rmSync(dir, { recursive: true, force: true });
console.log(`\n${checks} room poll checks passed`);
