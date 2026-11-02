import assert from 'node:assert/strict';
import { engineMove } from '../lib/ai-game';
import { explainMove, pieceValue } from '../lib/explain';
import {
  analyseMove,
  type AnalysisScore,
  type PositionEvaluation,
} from '../lib/game-analysis';
import {
  initialBoard,
  moveBoard,
  notation,
  type Board,
  type Kind,
  type Move,
  type Side,
} from '../lib/xiangqi';

let checks = 0;
function test(name: string, run: () => void) {
  run();
  checks++;
  console.log('✓ ' + name);
}
const cp = (value: number): AnalysisScore => ({ kind: 'cp', value });
const line = (score: AnalysisScore, pv: string[]): PositionEvaluation => ({
  score,
  depth: 12,
  pv,
});
const square = (at: string) => engineMove(at + at)!.from;
function after(tokens: string[], start = initialBoard()): Board {
  return tokens.reduce((board, token) => {
    const { from, to } = engineMove(token)!;
    return moveBoard(board, from, to);
  }, start);
}
/** The move `token` played from `before`, with the engine's two lines around it. */
function explain(
  before: Board,
  side: Side,
  token: string,
  lines: {
    best: string[];
    actual: string[];
    bestScore?: AnalysisScore;
    playedScore?: AnalysisScore;
  },
) {
  const { from, to } = engineMove(token)!;
  const move: Move = {
    from,
    to,
    side,
    text: notation(before, from, to),
    captured: before[to],
    check: false,
    before,
    clocks: { red: 0, black: 0 },
    quietBefore: 0,
  };
  const played = lines.playedScore ?? cp(side === 'red' ? -300 : 300);
  const result = analyseMove({
    ply: 1,
    side,
    move: token,
    before: line(lines.bestScore ?? cp(0), lines.best),
    after: line(played, lines.actual.slice(1)),
    played: line(played, lines.actual),
  });
  return explainMove(move, result);
}
function board(pieces: [Side, Kind, string][]): Board {
  const b: Board = Array(90).fill(null);
  pieces.forEach(([side, kind, at], i) => {
    b[square(at)] = { side, kind, id: `${side}-${kind}-${i}` };
  });
  return b;
}

test('子力分值：过河兵翻倍，车最重', () => {
  const pawn = initialBoard()[square('a4')]!;
  assert.equal(pieceValue(pawn, square('a4')), 1);
  assert.equal(pieceValue(pawn, square('a6')), 2);
  assert.equal(pieceValue(initialBoard()[square('a1')]!, square('a1')), 9);
});

test('车一进一：右马失去车的保护，黑炮可以打马', () => {
  const c = explain(initialBoard(), 'red', 'i1i2', {
    best: ['h1g3', 'h10g8'],
    actual: ['i1i2', 'h8h1'],
  });
  assert(c.certain);
  assert.deepEqual(c.problem, [
    '红車走开后，红马失去保护，黑方可以炮8进7吃掉它。',
  ]);
  assert.match(c.reason[0], /^引擎更看好马二进三/);
});

test('车一平二：把车送到炮口，被白吃', () => {
  const before = after(['i1i2', 'b8e8']);
  const c = explain(before, 'red', 'i2h2', {
    best: ['h1g3'],
    actual: ['i2h2', 'h8h2'],
  });
  assert.deepEqual(c.problem, ['車一平二把红車走到了黑炮可以白吃的位置。']);
});

test('对方已在捉马却置之不理；推荐着把马跳开', () => {
  const before = after(['i1i2', 'a10a9']);
  const c = explain(before, 'red', 'g4g5', {
    best: ['h1g3', 'a9d9'],
    actual: ['g4g5', 'h8h1'],
  });
  assert.deepEqual(c.problem, ['黑方已经在捉红马，这步没有应对。']);
  assert.deepEqual(c.reason, ['马二进三把被捉的红马走到了安全的位置。']);
});

test('捉双：推荐着同时攻击两个无保护的大子', () => {
  const before = board([
    ['red', 'k', 'e1'],
    ['red', 'h', 'c3'],
    ['black', 'k', 'd10'],
    ['black', 'r', 'b6'],
    ['black', 'h', 'f6'],
    ['black', 'p', 'd6'],
  ]);
  const c = explain(before, 'red', 'e1e2', {
    best: ['c3d5'],
    actual: ['e1e2', 'b6b5'],
    bestScore: cp(300),
    playedScore: cp(0),
  });
  assert.deepEqual(c.reason, ['马七进六同时捉黑車和黑马，黑方难以兼顾。']);
  // Nothing concrete went wrong with the king move itself.
  assert.match(c.problem[0], /^这步没有直接丢子/);
});

test('错过得子：放着白送的车不吃', () => {
  const before = after(['i1i2', 'b8e8', 'i2h2']);
  const c = explain(before, 'black', 'e8e4', {
    best: ['h8h2', 'h1g3'],
    actual: ['e8e4', 'h2h8'],
    bestScore: cp(-650),
    playedScore: cp(-100),
  });
  assert.deepEqual(c.problem, ['错过了得子的机会：炮8进6可以吃掉红車。']);
  assert.match(c.reason[0], /^按推荐的变化（炮8进6）/);
});

test('送杀与漏杀优先于其他解释', () => {
  const allowed = explain(initialBoard(), 'red', 'h3e3', {
    best: ['b3e3'],
    actual: ['h3e3', 'h10g8', 'h1g3', 'i10h10'],
    playedScore: { kind: 'mate', winner: 'black', plies: 3 },
  });
  assert.equal(
    allowed.problem[0],
    '这步之后黑方有2步杀：马8进7，马二进三，車9平8。',
  );
  const missed = explain(initialBoard(), 'red', 'i1i2', {
    best: ['h3e3'],
    actual: ['i1i2', 'h10g8'],
    bestScore: { kind: 'mate', winner: 'red', plies: 1 },
    playedScore: cp(0),
  });
  assert(missed.problem.includes('错过了杀棋。'));
  assert.deepEqual(missed.reason, ['炮二平五起1步成杀：炮二平五。']);
});

test('找不到战术时如实说明，只给引擎判断', () => {
  const c = explain(initialBoard(), 'red', 'a4a5', {
    best: ['h3e3', 'h10g8', 'h1g3', 'i10h10', 'i1h1'],
    actual: ['a4a5', 'h10g8'],
    bestScore: cp(30),
    playedScore: cp(-60),
  });
  assert.equal(c.certain, false);
  assert.match(c.problem[0], /红优 30.*黑优 60/);
  assert.equal(
    c.reason[0],
    '引擎更看好炮二平五：走后红优 30，主要变化是炮二平五，马8进7，马二进三，車9平8。',
  );
});

console.log(`\n${checks} commentary checks passed`);
