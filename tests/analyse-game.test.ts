import assert from 'node:assert/strict';
import { analyseGame, analysisEvaluation } from '../lib/analyse-game';
import {
  createAiMatch,
  playAiMove,
  resignAiMatch,
  squareToEngine,
} from '../lib/ai-game';
import type { SearchOptions } from '../lib/ai-engine';
import type { GameAnalysis } from '../lib/game-analysis';
import { legalTargets, type Side } from '../lib/xiangqi';
import { applyAction } from '../lib/game';

const room = resignAiMatch(
  playAiMove(playAiMove(createAiMatch('red', 'medium'), 54, 45), 27, 36),
).room;
const calls: SearchOptions[] = [];
const engine = {
  async search(options: SearchOptions) {
    calls.push(options);
    const index = options.position.split(' moves ')[1]?.split(' ').length ?? 0;
    const token = options.searchMoves?.[0] ?? ['h3e3', 'a7a6', 'c4c5'][index];
    const cp = index === 0 ? (options.searchMoves ? -1000 : 400) : 700;
    options.onInfo?.({ depth: 12, cp, pv: [token] });
    return token;
  },
};
let partial: GameAnalysis | undefined;
const done = await analyseGame(room, {
  gameId: 'test',
  engine,
  signal: new AbortController().signal,
  onProgress(result) {
    partial ??= result;
  },
});
assert.equal(
  done.moves.filter((entry) => entry.status === 'complete').length,
  2,
);
assert.equal(calls.length, 5, '相邻步复用走后最佳搜索');
assert.deepEqual(
  calls.map((call) => call.searchMoves),
  [undefined, ['a4a5'], undefined, ['a7a6'], undefined],
);
assert.deepEqual(
  calls.map((call) => call.turn),
  ['red', 'red', 'black', 'black', 'red'],
);
const first = done.moves[0];
assert.equal(first.status, 'complete');
if (first.status === 'complete') {
  assert.equal(
    first.analysis.rating,
    'blunder',
    '实际着评级使用 searchmoves 分数',
  );
  assert.deepEqual(first.analysis.played?.score, { kind: 'cp', value: -1000 });
  assert.deepEqual(
    first.analysis.after.score,
    { kind: 'cp', value: 700 },
    '走后反驳仍保留独立搜索结果',
  );
}
assert.equal(partial?.moves[1].status, 'pending', '进度快照不能被后续任务修改');
calls.length = 0;
await analyseGame(room, {
  gameId: 'test',
  engine,
  initial: partial,
  signal: new AbortController().signal,
  onProgress() {},
});
assert.equal(calls.length, 2, '续算跳过完整步，只补算缺失步');
const controller = new AbortController();
calls.length = 0;
await assert.rejects(
  analyseGame(room, {
    gameId: 'test',
    engine,
    signal: controller.signal,
    onProgress() {
      controller.abort();
    },
  }),
  { name: 'AbortError' },
);
assert.equal(calls.length, 3, '取消后不启动下一步搜索');
let failed: GameAnalysis | undefined;
await assert.rejects(
  analyseGame(room, {
    gameId: 'test',
    engine: {
      async search() {
        return 'a4a5';
      },
    },
    signal: new AbortController().signal,
    onProgress(result) {
      failed = result;
    },
  }),
  /完整评分/,
);
assert.equal(failed?.moves[0].status, 'failed');
assert.equal(failed?.moves[1].status, 'pending');
for (const turn of ['red', 'black'] as Side[]) {
  assert.deepEqual(
    analysisEvaluation({ depth: 4, mate: 2, pv: ['a4a5'] }, turn).score,
    { kind: 'mate', winner: 'red', plies: turn === 'red' ? 3 : 4 },
  );
  assert.deepEqual(
    analysisEvaluation({ depth: 4, mate: -2, pv: ['a4a5'] }, turn).score,
    { kind: 'mate', winner: 'black', plies: turn === 'black' ? 3 : 4 },
  );
}
assert.throws(() => analysisEvaluation({ depth: 0, cp: 0, pv: [] }, 'red'));
assert.throws(() => analysisEvaluation({ depth: 4, mate: 0, pv: [] }, 'black'));
// Natural draw is determined by our rules, not the recorded resignation metadata.
const repeated = createAiMatch('red', 'medium').room;
for (let i = 0; i < 2; i++)
  for (const [from, to] of [
    [82, 63],
    [1, 18],
    [63, 82],
    [18, 1],
  ])
    applyAction(repeated, repeated.turn, { action: 'move', from, to }, 0);
const repeatedCalls: SearchOptions[] = [];
const draws = await analyseGame(repeated, {
  gameId: 'draw',
  signal: new AbortController().signal,
  onProgress() {},
  engine: {
    async search(options) {
      repeatedCalls.push(options);
      const index =
        options.position.split(' moves ')[1]?.split(' ').length ?? 0;
      const board = repeated.history[index]?.before ?? repeated.board;
      let token = options.searchMoves?.[0];
      if (!token) {
        const from = board.findIndex(
          (piece, from) =>
            piece?.side === options.turn &&
            legalTargets(board, from).length > 0,
        );
        token =
          squareToEngine(from) + squareToEngine(legalTargets(board, from)[0]);
      }
      options.onInfo?.({ depth: 12, cp: 0, pv: [token] });
      return token;
    },
  },
});
const last = draws.moves.at(-1)!;
assert.equal(last.status, 'complete');
if (last.status === 'complete')
  assert.deepEqual(last.analysis.after.score, {
    kind: 'result',
    winner: 'draw',
  });
assert.equal(repeatedCalls.length, 16, '已结束局面不发送无走法搜索');
console.log('✓ 整局任务：限定评分、红黑视角、终局、进度、续算、缺分失败与取消');
