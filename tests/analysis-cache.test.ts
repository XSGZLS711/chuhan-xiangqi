import assert from 'node:assert/strict';
import {
  createAnalysisCache,
  restoreAnalysisCache,
  type CachedAnalysis,
} from '../lib/analysis-cache';
import { archiveGame } from '../lib/archive';
import { createAiMatch, playAiMove, resignAiMatch } from '../lib/ai-game';
import {
  createGameAnalysis,
  completeMoveAnalysis,
  type PositionEvaluation,
} from '../lib/game-analysis';

const game = archiveGame(
  resignAiMatch(playAiMove(createAiMatch('red', 'medium'), 54, 45)).room,
  {
    id: 'cache:test',
    date: '2026-11-02T00:00:00Z',
    mode: { kind: 'ai', level: 'medium' },
    viewerSide: 'red',
  },
);
const evaluation = (cp: number, pv: string[]): PositionEvaluation => ({
  depth: 12,
  score: { kind: 'cp', value: cp },
  pv,
});
const empty = createGameAnalysis(game.id, game.moves);
const done = completeMoveAnalysis(
  empty,
  1,
  evaluation(400, ['h3e3']),
  evaluation(700, ['a7a6']),
  evaluation(-1000, ['a4a5']),
);
let stored: CachedAnalysis | undefined;
let reads = 0,
  writes = 0;
const cache = createAnalysisCache({
  async read(id) {
    reads++;
    assert.equal(id, game.id);
    return stored;
  },
  async write(entry) {
    writes++;
    stored = structuredClone(entry);
  },
});
assert.equal(await cache.load(game), null);
await cache.save(game, done);
assert.equal(writes, 1);
assert.deepEqual(await cache.load(game), done);
assert.equal(reads, 2);
assert.equal(await cache.load({ ...game, moves: ['c4c5'] }), null);
assert.equal(
  await cache.load({ ...game, result: { winner: 'red', reason: '黑方认输' } }),
  null,
);
assert.equal(await cache.load({ ...game, finalFen: 'changed' }), null);
assert.equal(
  await cache.load({ ...game, id: 'another' }).catch(() => null),
  null,
);
assert.equal(
  restoreAnalysisCache({ ...stored, profile: 'old-engine' }, game),
  null,
);
assert.equal(restoreAnalysisCache({ ...stored, version: 9 }, game), null);
assert.equal(
  restoreAnalysisCache({ ...stored, analysis: { ...done, moves: [] } }, game),
  null,
);
assert.equal(
  restoreAnalysisCache(
    {
      ...stored,
      analysis: {
        ...done,
        model: {
          ...done.model,
          config: { ...done.model.config, cpScale: 999 },
        },
      },
    },
    game,
  ),
  null,
);
assert(stored);
const corrupt = structuredClone(stored);
if (corrupt.analysis.moves[0].status === 'complete')
  corrupt.analysis.moves[0].analysis.rating = 'inaccuracy';
const restored = restoreAnalysisCache(corrupt, game)!;
assert.equal(restored.moves[0].status, 'complete');
if (restored.moves[0].status === 'complete')
  assert.equal(
    restored.moves[0].analysis.rating,
    'blunder',
    '缓存评级按评分重算',
  );
const malformed = structuredClone(stored);
if (malformed.analysis.moves[0].status === 'complete')
  malformed.analysis.moves[0].analysis.played!.score = {
    kind: 'cp',
    value: NaN,
  };
assert.equal(restoreAnalysisCache(malformed, game), null);
await cache.save(game, empty);
assert.deepEqual(await cache.load(game), empty, '允许取消前的未完成结果');
const failed = structuredClone(empty);
failed.moves[0] = {
  ...failed.moves[0],
  status: 'failed',
  message: 'missing score',
};
await cache.save(game, failed);
assert.deepEqual(await cache.load(game), failed);
const unavailable = createAnalysisCache({
  async read() {
    throw new Error('blocked');
  },
  async write() {
    throw new Error('quota');
  },
});
await assert.rejects(unavailable.load(game), /blocked/);
await assert.rejects(unavailable.save(game, done), /quota/);
await assert.rejects(cache.save({ ...game, moves: [] }, done), /不匹配/);
console.log(
  '✓ 分析缓存：对局/引擎/参数失效、评分重建、部分结果、坏数据与存储失败',
);
