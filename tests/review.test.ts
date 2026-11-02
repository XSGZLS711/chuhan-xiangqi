import assert from 'node:assert/strict';
import { engineMove } from '../lib/ai-game';
import {
  completeMoveAnalysis,
  createGameAnalysis,
  type AnalysisScore,
  type PositionEvaluation,
} from '../lib/game-analysis';
import {
  gamePhases,
  lineSteps,
  moveAccuracy,
  moveComparison,
  moveNumber,
  phaseOf,
  playedScore,
  reviewReport,
  reviewSeries,
  scoreAt,
  scoreText,
  scoreValue,
} from '../lib/review';
import {
  initialBoard,
  moveBoard,
  notation,
  opposite,
  type Board,
  type Move,
  type Piece,
  type Side,
} from '../lib/xiangqi';

let checks = 0;
function test(name: string, run: () => void) {
  run();
  checks++;
  console.log('✓ ' + name);
}
const cp = (value: number): AnalysisScore => ({ kind: 'cp', value });
const evaluation = (
  score: AnalysisScore,
  pv: string[],
): PositionEvaluation => ({
  score,
  depth: 12,
  pv,
});
function play(tokens: string[]) {
  let board = initialBoard(),
    side: Side = 'red';
  const history: Move[] = [];
  for (const token of tokens) {
    const { from, to } = engineMove(token)!;
    history.push({
      from,
      to,
      text: notation(board, from, to),
      side,
      captured: board[to],
      check: false,
      before: board,
      clocks: { red: 0, black: 0 },
      quietBefore: 0,
    });
    board = moveBoard(board, from, to);
    side = opposite(side);
  }
  return { history, board };
}
// 炮二平五 马8进7 车一进一, with the last move rated as a mistake.
const OPENING = ['h3e3', 'h10g8', 'i1i2'];
function analysed() {
  const game = play(OPENING);
  let analysis = createGameAnalysis('t', OPENING);
  analysis = completeMoveAnalysis(
    analysis,
    1,
    evaluation(cp(20), ['h3e3', 'h10g8']),
    evaluation(cp(18), ['h10g8']),
    evaluation(cp(18), ['h3e3', 'h10g8']),
  );
  analysis = completeMoveAnalysis(
    analysis,
    2,
    evaluation(cp(18), ['h10g8']),
    evaluation(cp(25), ['h1g3']),
    evaluation(cp(25), ['h10g8', 'h1g3']),
  );
  analysis = completeMoveAnalysis(
    analysis,
    3,
    evaluation(cp(25), ['h1g3', 'i10h10']),
    evaluation(cp(-180), ['i10h10']),
    evaluation(cp(-180), ['i1i2', 'i10h10']),
  );
  return { ...game, analysis };
}

test('评分文字：红优、黑优、均势与杀棋', () => {
  assert.equal(scoreText(cp(133)), '红优 133');
  assert.equal(scoreText(cp(-767)), '黑优 767');
  assert.equal(scoreText(cp(4)), '均势');
  assert.equal(
    scoreText({ kind: 'mate', winner: 'red', plies: 3 }),
    '红方2步杀',
  );
  assert.equal(scoreText({ kind: 'mate', winner: 'black', plies: 0 }), '黑胜');
  assert.equal(scoreText(null), '分析中');
  assert.equal(scoreText({ kind: 'result', winner: 'draw' }), '和棋');
  assert.equal(scoreValue({ kind: 'result', winner: 'red' }), 1000);
  assert.equal(scoreValue(cp(5000)), 1000);
  assert.equal(scoreValue({ kind: 'mate', winner: 'black', plies: 2 }), -1000);
});

test('局势序列：起点用走前评分，之后用每步走后评分，未完成为空', () => {
  const { analysis } = analysed();
  const series = reviewSeries(analysis, 3);
  assert.deepEqual(
    series.map((p) => p.value),
    [20, 18, 25, -180],
  );
  assert.equal(series[3].rating, 'mistake');
  assert.deepEqual(scoreAt(analysis, 0), cp(20));
  const partial = createGameAnalysis('t', OPENING);
  assert.deepEqual(
    reviewSeries(partial, 3).map((p) => p.value),
    [null, null, null, null],
  );
});

test('阶段：兑掉大子后进入中局，大子不足后进入残局', () => {
  const strip = (drop: (p: Piece) => boolean): Board =>
    initialBoard().map((p) => (p && !drop(p) ? p : null));
  const full = initialBoard(),
    lessHorse = strip((p) => p.id === 'black-h-1'),
    // Red keeps both chariots (18 points): well under the endgame line.
    bare = strip(
      (p) =>
        p.kind === 'c' ||
        p.kind === 'h' ||
        (p.kind === 'r' && p.side === 'black'),
    );
  const history = Array.from({ length: 12 }, (_, i) => ({
    ...play(['h3e3']).history[0],
    side: (i % 2 ? 'black' : 'red') as Side,
    before: i < 9 ? full : i < 11 ? lessHorse : bare,
  }));
  const phases = gamePhases(history, bare);
  assert.deepEqual(phases, { middle: 9, end: 11 });
  assert.equal(phaseOf(9, phases), 'opening');
  assert.equal(phaseOf(10, phases), 'middle');
  assert.equal(phaseOf(12, phases), 'end');
  // Quiet games still reach the middlegame by move 10.
  const quiet = Array.from({ length: 24 }, () => ({
    ...history[0],
    before: full,
  }));
  assert.deepEqual(gamePhases(quiet, full), { middle: 20, end: null });
});

test('准确度：零损失接近满分，损失越大越低', () => {
  assert(moveAccuracy(0) > 99.9);
  assert(moveAccuracy(0.05) > moveAccuracy(0.2));
  assert.equal(moveAccuracy(1), 0);
});

test('报告：按走棋方统计评级、失误摘要与阶段得分', () => {
  const { history, board, analysis } = analysed();
  const report = reviewReport(history, analysis, gamePhases(history, board));
  assert.equal(report.red.counts.mistake, 1);
  assert.deepEqual(
    report.red.mistakes.map((m) => [m.ply, m.text, m.rating]),
    [[3, '車一进一', 'mistake']],
  );
  assert.equal(report.black.mistakes.length, 0);
  assert(report.red.overall! < report.black.overall!);
  assert.equal(report.red.phases.middle, null);
  assert.equal(moveNumber(3, 'red'), '2.');
  assert.equal(moveNumber(4, 'black'), '2…');
});

test('变化：推荐线与实战线都从走前局面合法展开', () => {
  const { history, analysis } = analysed();
  const compared = moveComparison(history, analysis, 3)!;
  assert.deepEqual(
    compared.best.map((s) => s.text),
    ['马二进三', '車9平8'],
  );
  assert.deepEqual(
    compared.actual.map((s) => s.text),
    ['車一进一', '車9平8'],
  );
  assert.deepEqual(playedScore(compared.result!), cp(-180));
  // An illegal token ends the line instead of inventing a position.
  assert.equal(lineSteps(initialBoard(), 'red', ['h3e3', 'e3e3']).length, 1);
  assert.equal(moveComparison(history, analysis, 9), null);
});

console.log(`\n${checks} review checks passed`);
