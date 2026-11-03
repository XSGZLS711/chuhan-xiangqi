import assert from 'node:assert/strict';
import { applyAction, expireClock, newRoom, type Room } from '../lib/game';
import {
  archiveGame,
  deserializeArchive,
  serializeArchive,
  replayArchive,
  mergeGame,
  newestGames,
  syncArchives,
  archiveLabel,
  type ArchivedGame,
  type ArchiveMode,
} from '../lib/archive';
import {
  createArchiveStore,
  localArchiveBackend,
  type ArchiveBackend,
} from '../lib/archive-storage';
import { boardFen } from '../lib/ai-game';
import { initialBoard, legalMove, moveBoard, opposite } from '../lib/xiangqi';

const now = Date.parse('2026-11-02T04:00:00Z');
function fresh() {
  const room = newRoom('archive-test', { id: 'red', name: '红棋友' }, 0, now);
  applyAction(room, 'black', { action: 'join', name: '黑棋友' }, now);
  return room;
}
function record(
  room: Room,
  id = 'friend:one',
  mode: ArchiveMode = { kind: 'friend' },
): ArchivedGame {
  return archiveGame(room, {
    id,
    mode,
    viewerSide: 'red',
    date: new Date(now).toISOString(),
  });
}
function roundTrip(room: Room, mode: ArchiveMode) {
  const saved = record(room, 'test', mode);
  const loaded = deserializeArchive(serializeArchive(saved));
  assert(loaded);
  assert.deepEqual(loaded, saved);
  let board = initialBoard(),
    side = 'red' as const as 'red' | 'black';
  for (const move of room.history) {
    assert(legalMove(board, move.from, move.to, side));
    board = moveBoard(board, move.from, move.to);
    side = opposite(side);
  }
  assert.equal(boardFen(board, side), saved.finalFen);
  const replay = replayArchive(loaded);
  assert.deepEqual(replay.board, room.board);
  assert.deepEqual(replay.result, room.result);
  assert.equal(replay.turn, room.turn);
  assert.deepEqual(
    replay.history.map((m) => m.text),
    room.history.map((m) => m.text),
  );
  assert.equal(loaded.players.black, '黑棋友');
  assert(!serializeArchive(saved).includes('clocks'));
}
assert.throws(() => record(fresh()));
for (const ending of [
  'resign-red',
  'resign-black',
  'draw',
  'timeout',
  'repetition',
]) {
  const room = fresh();
  if (ending === 'repetition') {
    for (let i = 0; i < 2; i++)
      for (const [from, to] of [
        [82, 63],
        [1, 18],
        [63, 82],
        [18, 1],
      ])
        applyAction(room, room.turn, { action: 'move', from, to }, now);
  } else {
    applyAction(room, 'red', { action: 'move', from: 64, to: 1 }, now);
    applyAction(room, 'black', { action: 'move', from: 0, to: 1 }, now);
    if (ending.startsWith('resign'))
      applyAction(
        room,
        ending.endsWith('red') ? 'red' : 'black',
        { action: 'resign' },
        now,
      );
    else if (ending === 'draw') {
      applyAction(room, 'red', { action: 'offer-draw' }, now);
      applyAction(room, 'black', { action: 'respond', accept: true }, now);
    } else {
      room.clockMinutes = 1;
      room.clocks.red = 0;
      expireClock(room, now);
    }
  }
  for (const mode of [
    { kind: 'friend' },
    { kind: 'ai', level: 'hard' },
  ] as ArchiveMode[])
    roundTrip(room, mode);
}
const zero = fresh();
applyAction(zero, 'red', { action: 'resign' }, now);
roundTrip(zero, { kind: 'ai', level: 'easy' });
const game = record(zero);
assert.equal(archiveLabel(game).result, '负');
assert.equal(archiveLabel({ ...game, viewerSide: 'black' }).result, '胜');
assert.equal(
  archiveLabel({ ...game, viewerSide: null }).opponent,
  '红棋友 / 黑棋友',
);
assert.equal(deserializeArchive('{bad json'), null);
assert.equal(deserializeArchive(JSON.stringify({ ...game, version: 2 })), null);
assert.equal(
  deserializeArchive(JSON.stringify({ ...game, moves: ['a0a1'] })),
  null,
);
assert.throws(() => replayArchive({ ...game, moves: ['a4a9'] }));
assert.throws(() => replayArchive({ ...game, finalFen: 'wrong' }));
assert.throws(() =>
  replayArchive({ ...game, result: { winner: 'red', reason: '红方认输' } }),
);
const many = Array.from({ length: 205 }, (_, i) => ({
  ...game,
  id: `game-${i}`,
  date: new Date(now + i * 1000).toISOString(),
}));
assert.equal(newestGames(many).length, 200);
assert.equal(newestGames(many)[0].id, 'game-204');
assert.equal(newestGames(many).at(-1)!.id, 'game-5');
assert.equal(
  mergeGame([game], { ...game, date: new Date(now + 9999).toISOString() })
    .length,
  1,
);
assert.equal(
  mergeGame([game], { ...game, date: new Date(now + 9999).toISOString() })[0]
    .date,
  game.date,
);
const minutes = (n: number) => new Date(now + n * 60000).toISOString();
const ids = (games: ArchivedGame[]) => games.map((entry) => entry.id);
const local = [
  { ...game, id: 'both', date: minutes(5) },
  { ...game, id: 'local-only', date: minutes(3) },
];
const server = [
  { ...game, id: 'both', date: minutes(5) },
  { ...game, id: 'server-only', date: minutes(4) },
];
const synced = syncArchives(local, server);
assert.deepEqual(ids(synced.games), ['both', 'server-only', 'local-only']);
assert.deepEqual(ids(synced.upload), ['local-only']);
assert.deepEqual(ids(syncArchives(local, []).upload), ['both', 'local-only']);
assert.deepEqual(syncArchives([], server).upload, []);
// The account already holds 200 newer games: an older local one would be dropped again.
const full = newestGames(many);
const ancient = { ...game, id: 'ancient', date: minutes(-10) };
assert.deepEqual(syncArchives([ancient], full).upload, []);
assert.deepEqual(syncArchives([ancient], full).games, full);
const latest = { ...game, id: 'latest', date: minutes(9999) };
assert.deepEqual(ids(syncArchives([latest], full).upload), ['latest']);
assert.equal(syncArchives([latest], full).games.length, 200);
assert.equal(syncArchives([latest], full).games[0].id, 'latest');
const huge = {
  ...game,
  id: 'huge',
  players: { red: '长'.repeat(40000), black: '黑棋友' },
};
assert.deepEqual(syncArchives([huge], []).upload, [], '太大的不上传');
assert.deepEqual(ids(syncArchives([huge], []).games), ['huge'], '本机照常显示');
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value);
  },
};
const fallback = localArchiveBackend(storage);
const failed: ArchiveBackend = {
  async list() {
    throw new Error('IDB blocked');
  },
  async save() {
    throw new Error('IDB blocked');
  },
};
const store = createArchiveStore(failed, fallback);
await store.save(game);
await store.save(game);
assert.equal((await store.list()).length, 1);
for (const entry of many) await store.save(entry);
assert.equal((await store.list()).length, 200);
const inMemory: ArchivedGame[] = [
  { ...game, id: 'primary', date: new Date(now + 300000).toISOString() },
];
const primary: ArchiveBackend = {
  async list() {
    return inMemory;
  },
  async save(entry) {
    inMemory.splice(0, inMemory.length, ...mergeGame(inMemory, entry));
  },
};
assert.equal(
  (await createArchiveStore(primary, fallback).list())[0].id,
  'primary',
);
await createArchiveStore(primary, failed).save(game);
assert.equal(inMemory.length, 2);
await assert.rejects(() => createArchiveStore(failed, failed).save(game));
await assert.rejects(() => createArchiveStore(failed, failed).list());
values.set('chuhan-archive', 'bad data');
assert.deepEqual(await fallback.list(), []);
console.log(
  '✓ 存档往返、吃子重放、认输/超时/提和/规则终局、非法数据拒绝、去重、200 局上限、账号同步合并与存储降级',
);
