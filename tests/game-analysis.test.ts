import assert from 'node:assert/strict';
import {
  DEFAULT_ANALYSIS_CONFIG,
  RATING_LABELS,
  scoreToWinProbability,
  rateWinProbabilityLoss,
  analyseMove,
  createGameAnalysis,
  completeMoveAnalysis,
  type AnalysisScore,
  type PositionEvaluation,
} from '../lib/game-analysis';
import type { Side } from '../lib/xiangqi';

let checks = 0;
function test(name: string, run: () => void) {
  run();
  checks++;
  console.log('✓ ' + name);
}
const near = (actual: number, expected: number) =>
  assert(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
const cp = (value: number): AnalysisScore => ({ kind: 'cp', value });
const mate = (winner: Side, plies = 3): AnalysisScore => ({
  kind: 'mate',
  winner,
  plies,
});
const evaluation = (
  score: AnalysisScore,
  pv = ['a4a5'],
): PositionEvaluation => ({ score, depth: 12, pv });
function compare(
  before: AnalysisScore,
  after: AnalysisScore,
  side: Side = 'red',
) {
  return analyseMove({
    ply: side === 'red' ? 1 : 2,
    side,
    move: side === 'red' ? 'a4a5' : 'a7a6',
    before: evaluation(before),
    after: evaluation(after, ['a7a6']),
  });
}
const probabilityScore = (probability: number) =>
  cp(
    DEFAULT_ANALYSIS_CONFIG.cpScale * Math.log(probability / (1 - probability)),
  );

test('数值检查：0 分为 0.5，尺度 100 下的 100 ln(3) 分为 0.75', () => {
  near(scoreToWinProbability(cp(0), 'red'), 0.5);
  near(scoreToWinProbability(cp(100 * Math.log(3)), 'red', 100), 0.75);
  near(scoreToWinProbability(cp(100 * Math.log(3)), 'black', 100), 0.25);
});
test('红方视角分数只转换一次，黑方改善与恶化方向相反', () => {
  assert.equal(compare(cp(0), cp(400), 'red').rating, null);
  assert.equal(compare(cp(0), cp(400), 'black').rating, 'blunder');
  near(
    compare(cp(0), cp(400), 'black').winProbabilityLoss,
    1 / (1 + Math.exp(-1)) - 0.5,
  );
  assert.equal(compare(cp(0), cp(-400), 'black').rating, null);
  assert.equal(compare(cp(0), cp(-400), 'red').rating, 'blunder');
});
test('换算单调、正负分对称，极端有限分数无溢出', () => {
  const values = [-1e308, -100000, -400, 0, 400, 100000, 1e308];
  let last = -1;
  for (const value of values) {
    const red = scoreToWinProbability(cp(value), 'red');
    assert(red >= 0 && red <= 1 && red >= last);
    near(red + scoreToWinProbability(cp(value), 'black'), 1);
    near(red, scoreToWinProbability(cp(-value), 'black'));
    last = red;
  }
});
test('评级边界：≤5 不标，(5,10] 中，(10,20] 差，>20 错', () => {
  for (const [loss, rating] of [
    [0, null],
    [0.05, null],
    [0.050000001, 'inaccuracy'],
    [0.1, 'inaccuracy'],
    [0.100000001, 'mistake'],
    [0.2, 'mistake'],
    [0.200000001, 'blunder'],
    [1, 'blunder'],
  ] as const)
    assert.equal(rateWinProbabilityLoss(loss), rating);
  assert.equal(RATING_LABELS.inaccuracy, '中');
  assert.equal(RATING_LABELS.mistake, '差');
  assert.equal(RATING_LABELS.blunder, '错');
});
test('损失按百分点计算，不按相对百分比，边界不受浮点减法影响', () => {
  const ten = compare(probabilityScore(0.8), probabilityScore(0.7));
  near(ten.winProbabilityLoss, 0.1);
  assert.equal(ten.rating, 'inaccuracy');
  assert.equal(
    compare(probabilityScore(0.8), probabilityScore(0.75)).rating,
    null,
  );
  assert.equal(
    compare(probabilityScore(0.7), probabilityScore(0.5)).rating,
    'mistake',
  );
  near(
    compare(probabilityScore(0.5), probabilityScore(0.75)).winProbabilityLoss,
    0,
  );
});
test('红黑双方的漏杀优先于普通分数评级，即使数值已饱和', () => {
  for (const side of ['red', 'black'] as const) {
    const score = cp(side === 'red' ? 1e308 : -1e308);
    const result = compare(mate(side), score, side);
    assert.equal(result.rating, 'missed-mate');
    assert(result.missedMate);
    near(result.winProbabilityLoss, 0);
  }
  assert.equal(RATING_LABELS['missed-mate'], '漏杀');
});
test('送杀在胜率损失很小时也标记；本来已被杀则不重复归咎', () => {
  assert.equal(compare(cp(-100000), mate('black')).rating, 'allowed-mate');
  assert.equal(
    compare(cp(100000), mate('red'), 'black').rating,
    'allowed-mate',
  );
  assert.equal(compare(mate('black', 5), mate('black', 1)).rating, null);
  assert.equal(compare(mate('red', 5), mate('red', 1), 'black').rating, null);
  assert.equal(RATING_LABELS['allowed-mate'], '送杀');
});
test('保留杀棋、摆脱被杀与同时漏杀送杀的优先级', () => {
  assert.equal(compare(mate('red', 3), mate('red', 7)).rating, null);
  assert.equal(compare(mate('black'), cp(-100)).rating, null);
  const lost = compare(mate('red'), mate('black'));
  assert(lost.missedMate && lost.allowedMate);
  assert.equal(lost.rating, 'allowed-mate');
});
test('mate 0 使用明确胜方，终局前后不会把 0 当成和棋或凭符号猜胜方', () => {
  near(scoreToWinProbability(mate('black', 0), 'black'), 1);
  near(scoreToWinProbability(mate('black', 0), 'red'), 0);
  assert.equal(compare(cp(0), mate('black', 0)).rating, 'allowed-mate');
  assert.equal(compare(cp(0), mate('red', 0)).rating, null);
  assert.throws(() => compare(mate('red', 0), cp(0)));
});
test('每步保留最佳着、前后评分与双方变化，快照不被调用者改写', () => {
  const before = { score: cp(200), depth: 18, pv: ['h3e3', 'b10c8'] };
  const after = { score: cp(-50), depth: 20, pv: ['a7a6'] };
  const result = analyseMove({
    ply: 1,
    side: 'red',
    move: 'a4a5',
    before,
    after,
  });
  assert.equal(result.recommendedMove, 'h3e3');
  assert.deepEqual(result.before.pv, ['h3e3', 'b10c8']);
  before.pv[0] = 'a4a5';
  after.pv.push('a5a6');
  assert.equal(result.recommendedMove, 'h3e3');
  assert.deepEqual(result.after.pv, ['a7a6']);
  assert.equal(compare(cp(0), cp(0)).before.depth, 12);
  assert.equal(
    analyseMove({
      ply: 1,
      side: 'red',
      move: 'a4a5',
      before: evaluation(cp(0), []),
      after: evaluation(cp(0), []),
    }).recommendedMove,
    null,
  );
});
test('整局结果允许未分析、失败与完成；补入一步不会改写其他步或原对象', () => {
  const config = {
    cpScale: 100,
    thresholds: { unmarked: 0.02, inaccuracy: 0.04, mistake: 0.08 },
  };
  const game = createGameAnalysis('archive:test', ['a4a5', 'a7a6'], config);
  config.cpScale = 999;
  config.thresholds.unmarked = 0.9;
  assert.equal(game.model.config.cpScale, 100);
  assert.equal(game.model.calibrated, false);
  assert.deepEqual(
    game.moves.map((move) => move.side),
    ['red', 'black'],
  );
  assert.deepEqual(
    game.moves.map((move) => move.status),
    ['pending', 'pending'],
  );
  game.moves[1] = {
    ...game.moves[1],
    status: 'failed',
    message: '评估尚未完成',
  };
  const done = completeMoveAnalysis(
    game,
    2,
    evaluation(cp(0)),
    evaluation(cp(100)),
  );
  assert.equal(game.moves[1].status, 'failed');
  assert.equal(done.moves[0].status, 'pending');
  const second = done.moves[1];
  assert.equal(second.status, 'complete');
  if (second.status === 'complete') {
    assert.equal(second.analysis.side, 'black');
    assert.equal(second.analysis.rating, 'blunder');
  }
  assert.deepEqual(JSON.parse(JSON.stringify(done)), done);
  assert.throws(() =>
    completeMoveAnalysis(game, 0, evaluation(cp(0)), evaluation(cp(0))),
  );
  assert.throws(() =>
    completeMoveAnalysis(game, 3, evaluation(cp(0)), evaluation(cp(0))),
  );
  assert.deepEqual(createGameAnalysis('empty', []).moves, []);
});
test('非法数据拒绝评级，避免输出伪造的中性分数', () => {
  for (const value of [NaN, Infinity, -Infinity])
    assert.throws(() => scoreToWinProbability(cp(value), 'red'));
  for (const scale of [0, -1, NaN, Infinity])
    assert.throws(() => scoreToWinProbability(cp(0), 'red', scale));
  for (const loss of [-1, 1.1, NaN])
    assert.throws(() => rateWinProbabilityLoss(loss));
  for (const plies of [-1, 1.5, NaN])
    assert.throws(() => scoreToWinProbability(mate('red', plies), 'red'));
  assert.throws(() =>
    rateWinProbabilityLoss(0.2, {
      unmarked: 0.1,
      inaccuracy: 0.1,
      mistake: 0.2,
    }),
  );
  assert.throws(() => createGameAnalysis('bad', ['a1a1']));
  assert.throws(() => createGameAnalysis('bad', ['0000']));
  assert.throws(() => createGameAnalysis('', []));
  assert.throws(() =>
    analyseMove({
      ply: 1,
      side: 'red',
      move: 'a4a5',
      before: { ...evaluation(cp(0)), depth: -1 },
      after: evaluation(cp(0)),
    }),
  );
});
console.log(`\n${checks} game analysis checks passed`);
