import type { MoveAnalysis } from './game-analysis';
import { lineSteps, playedScore, scoreText, type LineStep } from './review';
import {
  inCheck,
  label,
  legalMove,
  moveBoard,
  notation,
  opposite,
  type Board,
  type Kind,
  type Move,
  type Piece,
  type Side,
} from './xiangqi';

/** Why a move was worse and why the engine's choice is better, in plain sentences.
 * Every sentence comes from replaying engine lines with the rules; when no concrete
 * tactic is found the commentary says so instead of inventing a reason.
 */
export type Commentary = {
  problem: string[];
  reason: string[];
  certain: boolean;
};

const VALUE: Record<Kind, number> = {
  k: 1000,
  r: 9,
  c: 4.5,
  h: 4,
  e: 2,
  a: 2,
  p: 1,
};
/** Rough points for a piece where it stands; a pawn across the river counts double. */
export function pieceValue(piece: Piece, at: number): number {
  if (piece.kind !== 'p') return VALUE[piece.kind];
  const row = Math.floor(at / 9);
  return (piece.side === 'red' ? row <= 4 : row >= 5) ? 2 : 1;
}
const pieceName = (piece: Piece) =>
  (piece.side === 'red' ? '红' : '黑') + label(piece);
const sideName = (side: Side) => (side === 'red' ? '红方' : '黑方');
// Below two points (a pawn, or an even trade) a loss is noise, not a lesson.
const WORTH = 2;

/** Squares of `side` pieces that could legally capture on `square` now. */
function attackers(board: Board, square: number, side: Side): number[] {
  const found: number[] = [];
  board.forEach((piece, at) => {
    if (piece?.side === side && legalMove(board, at, square, side))
      found.push(at);
  });
  return found;
}
type Threat = { victim: number; attacker: number; free: boolean; gain: number };
/** The most profitable way for `by` to take the piece on `square`, if it wins material. */
function threat(board: Board, square: number, by: Side): Threat | null {
  const victim = board[square];
  if (!victim || victim.side === by || victim.kind === 'k') return null;
  let best: Threat | null = null;
  for (const from of attackers(board, square, by)) {
    const free = !attackers(moveBoard(board, from, square), square, victim.side)
      .length;
    const gain = free
      ? pieceValue(victim, square)
      : pieceValue(victim, square) - pieceValue(board[from]!, from);
    if (gain >= WORTH && (!best || gain > best.gain))
      best = { victim: square, attacker: from, free, gain };
  }
  return best;
}
/** Every piece of `side` that the opponent could win right now. */
function threatsAgainst(board: Board, side: Side): Threat[] {
  const found: Threat[] = [];
  board.forEach((piece, at) => {
    const t = piece?.side === side ? threat(board, at, opposite(side)) : null;
    if (t) found.push(t);
  });
  return found;
}

type Capture = { index: number; by: Side; piece: Piece; value: number };
/** Captures along a line, with who made them; lines are cut short to stay concrete. */
function captures(
  start: Board,
  mover: Side,
  steps: LineStep[],
  plies = 6,
): Capture[] {
  const found: Capture[] = [];
  let board = start,
    side = mover;
  steps.slice(0, plies).forEach((step, index) => {
    const piece = board[step.to];
    if (piece)
      found.push({ index, by: side, piece, value: pieceValue(piece, step.to) });
    board = step.board;
    side = opposite(side);
  });
  return found;
}
const balance = (found: Capture[], side: Side) =>
  found.reduce((sum, c) => sum + (c.by === side ? c.value : -c.value), 0);
const points = (value: number) =>
  Number.isInteger(value) ? value : value.toFixed(1);
const join = (steps: LineStep[]) => steps.map((s) => s.text).join('，');

export function explainMove(move: Move, result: MoveAnalysis): Commentary {
  const me = move.side,
    them = opposite(me),
    moved = move.before[move.from]!,
    after = moveBoard(move.before, move.from, move.to),
    played = playedScore(result),
    best = lineSteps(move.before, me, result.before.pv),
    actual = lineSteps(
      move.before,
      me,
      result.played?.pv ?? [result.move, ...result.after.pv],
    ),
    first = best[0];
  const problem: string[] = [],
    reason: string[] = [],
    explained = new Set<number>(),
    threatened: number[] = [];

  // Mates outrank every other explanation.
  if (played.kind === 'mate' && played.winner === them) {
    const line = actual.slice(1, 1 + played.plies);
    problem.push(
      `这步之后${sideName(them)}有${Math.ceil(played.plies / 2)}步杀${line.length ? `：${join(line)}` : ''}。`,
    );
  }
  const mate = result.before.score;
  const missedMate =
    mate.kind === 'mate' &&
    mate.winner === me &&
    !(played.kind === 'mate' && played.winner === me);
  if (missedMate && first) {
    problem.push('错过了杀棋。');
    reason.push(
      `${first.text}起${Math.ceil(mate.plies / 2)}步成杀：${join(best.slice(0, mate.plies))}。`,
    );
  }

  // The moved piece now stands where it can be taken.
  const hung = threat(after, move.to, them);
  if (hung) {
    problem.push(
      `${move.text}把${pieceName(moved)}走到了${pieceName(after[hung.attacker]!)}${hung.free ? '可以白吃' : '能换掉并得子'}的位置。`,
    );
    explained.add(move.to);
  }
  // Something else became loose, or was already attacked and stays so.
  for (const t of threatsAgainst(after, me)) {
    if (explained.has(t.victim)) continue;
    const victim = pieceName(after[t.victim]!),
      take = `${sideName(them)}可以${notation(after, t.attacker, t.victim)}吃掉它。`;
    if (threat(move.before, t.victim, them)) {
      problem.push(`${sideName(them)}已经在捉${victim}，这步没有应对。`);
      threatened.push(t.victim);
    } else if (attackers(move.before, t.victim, them).length)
      problem.push(`${pieceName(moved)}走开后，${victim}失去保护，${take}`);
    else
      problem.push(
        `这步之后${victim}暴露在${pieceName(after[t.attacker]!)}的攻击下，${take}`,
      );
    explained.add(t.victim);
  }
  // What the engine's reply line actually costs.
  const lost = balance(captures(move.before, me, actual), me);
  // A free piece left on the board is a mistake even when nothing was lost.
  const bestCaptures = captures(move.before, me, best),
    firstWin = bestCaptures.find((c) => c.by === me);
  if (
    !missedMate &&
    firstWin &&
    balance(bestCaptures, me) - lost >= WORTH &&
    balance(bestCaptures, me) >= WORTH
  )
    problem.push(
      `错过了得子的机会：${best[firstWin.index].text}可以吃掉${pieceName(firstWin.piece)}。`,
    );
  if (lost <= -WORTH && !explained.size) {
    const taken = captures(move.before, me, actual).filter(
      (c) => c.by === them,
    );
    problem.push(
      `按引擎的应对（${join(actual.slice(0, (taken.at(-1)?.index ?? 1) + 1))}），${sideName(me)}净亏约${points(-lost)}分子力：${[...new Set(taken.map((c) => pieceName(c.piece)))].join('、')}。`,
    );
  }

  if (first && !missedMate) {
    const bestBoard = first.board;
    for (const square of threatened) {
      const piece = move.before[square]!;
      if (first.from === square)
        reason.push(
          `${first.text}把被捉的${pieceName(piece)}走到了安全的位置。`,
        );
      else if (!threat(bestBoard, square, them))
        reason.push(`${first.text}保住了${pieceName(piece)}。`);
    }
    if (inCheck(bestBoard, them))
      reason.push(`${first.text}将军，先手逼${sideName(them)}应将。`);
    const forks = threatsAgainst(bestBoard, them).filter(
      (t) => t.attacker === first.to,
    );
    if (forks.length >= 2)
      reason.push(
        `${first.text}同时捉${forks
          .slice(0, 2)
          .map((t) => pieceName(bestBoard[t.victim]!))
          .join('和')}，${sideName(them)}难以兼顾。`,
      );
    const won = captures(move.before, me, best);
    const gain = balance(won, me);
    if (gain >= WORTH)
      reason.push(
        `按推荐的变化（${join(best.slice(0, (won.at(-1)?.index ?? 0) + 1))}），${sideName(me)}净得约${points(gain)}分子力。`,
      );
  }
  const certain = problem.length > 0 || reason.length > 0;
  if (!problem.length)
    problem.push(
      `这步没有直接丢子，但引擎认为局面从${scoreText(result.before.score)}变为${scoreText(played)}，差别多在子力位置和长远形势。`,
    );
  if (!reason.length && first)
    reason.push(
      `引擎更看好${first.text}：走后${scoreText(result.before.score)}，主要变化是${join(best.slice(0, 4))}。`,
    );
  return { problem, reason, certain };
}
