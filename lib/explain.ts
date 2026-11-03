import type { MoveAnalysis } from './game-analysis';
import {
  notationFor,
  sideName,
  sidePieceName,
  t,
  tn,
  type Locale,
  type MessageKey,
  type Params,
} from './i18n';
import { moveText, type NotationStyle } from './notation';
import { lineSteps, playedScore, scoreText, type LineStep } from './review';
import {
  inCheck,
  legalMove,
  moveBoard,
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

/** Why `move` fell short, in `locale`. Moves are written in `style`, which follows the
 * language unless the caller chooses otherwise. */
export function explainMove(
  move: Move,
  result: MoveAnalysis,
  locale: Locale = 'zh',
  style: NotationStyle = notationFor(locale),
): Commentary {
  const say = (key: MessageKey, params?: Params) => t(locale, key, params);
  const pieceName = (piece: Piece) => sidePieceName(locale, piece);
  const side = (value: Side) => sideName(locale, value);
  const join = (steps: LineStep[]) =>
    steps.map((s) => s.text).join(say('list.moves'));
  const text = (board: Board, from: number, to: number) =>
    moveText(board, from, to, style);
  const me = move.side,
    them = opposite(me),
    moved = move.before[move.from]!,
    after = moveBoard(move.before, move.from, move.to),
    played = playedScore(result),
    best = lineSteps(move.before, me, result.before.pv, style),
    actual = lineSteps(
      move.before,
      me,
      result.played?.pv ?? [result.move, ...result.after.pv],
      style,
    ),
    // The stored text is the Chinese notation; the other styles are rewritten from the position.
    playedText =
      style === 'chinese' ? move.text : text(move.before, move.from, move.to),
    first = best[0];
  const problem: string[] = [],
    reason: string[] = [],
    explained = new Set<number>(),
    threatened: number[] = [];

  // Mates outrank every other explanation.
  if (played.kind === 'mate' && played.winner === them) {
    const line = actual.slice(1, 1 + played.plies);
    problem.push(
      say(line.length ? 'explain.mateAgainst.line' : 'explain.mateAgainst', {
        side: side(them),
        n: Math.ceil(played.plies / 2),
        line: join(line),
      }),
    );
  }
  const mate = result.before.score;
  const missedMate =
    mate.kind === 'mate' &&
    mate.winner === me &&
    !(played.kind === 'mate' && played.winner === me);
  if (missedMate && first) {
    problem.push(say('explain.missedMate'));
    reason.push(
      say('explain.mateLine', {
        first: first.text,
        n: Math.ceil(mate.plies / 2),
        line: join(best.slice(0, mate.plies)),
      }),
    );
  }

  // The moved piece now stands where it can be taken.
  const hung = threat(after, move.to, them);
  if (hung) {
    problem.push(
      say(hung.free ? 'explain.hung.free' : 'explain.hung.trade', {
        move: playedText,
        piece: pieceName(moved),
        attacker: pieceName(after[hung.attacker]!),
      }),
    );
    explained.add(move.to);
  }
  // Something else became loose, or was already attacked and stays so.
  for (const danger of threatsAgainst(after, me)) {
    if (explained.has(danger.victim)) continue;
    const victim = pieceName(after[danger.victim]!),
      take = say('explain.take', {
        side: side(them),
        move: text(after, danger.attacker, danger.victim),
      });
    if (threat(move.before, danger.victim, them)) {
      problem.push(say('explain.ignored', { side: side(them), victim }));
      threatened.push(danger.victim);
    } else if (attackers(move.before, danger.victim, them).length)
      problem.push(
        say('explain.unprotected', { piece: pieceName(moved), victim, take }),
      );
    else
      problem.push(
        say('explain.exposed', {
          victim,
          attacker: pieceName(after[danger.attacker]!),
          take,
        }),
      );
    explained.add(danger.victim);
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
      say('explain.missedCapture', {
        move: best[firstWin.index].text,
        piece: pieceName(firstWin.piece),
      }),
    );
  if (lost <= -WORTH && !explained.size) {
    const taken = captures(move.before, me, actual).filter(
      (c) => c.by === them,
    );
    problem.push(
      tn(locale, 'explain.loses', -lost, {
        line: join(actual.slice(0, (taken.at(-1)?.index ?? 1) + 1)),
        side: side(me),
        points: points(-lost),
        pieces: [...new Set(taken.map((c) => pieceName(c.piece)))].join(
          say('list.pieces'),
        ),
      }),
    );
  }

  if (first && !missedMate) {
    const bestBoard = first.board;
    for (const square of threatened) {
      const piece = move.before[square]!;
      if (first.from === square)
        reason.push(
          say('explain.escape', {
            move: first.text,
            piece: pieceName(piece),
          }),
        );
      else if (!threat(bestBoard, square, them))
        reason.push(
          say('explain.protect', { move: first.text, piece: pieceName(piece) }),
        );
    }
    if (inCheck(bestBoard, them))
      reason.push(say('explain.check', { move: first.text, side: side(them) }));
    const forks = threatsAgainst(bestBoard, them).filter(
      (danger) => danger.attacker === first.to,
    );
    if (forks.length >= 2)
      reason.push(
        say('explain.fork', {
          move: first.text,
          a: pieceName(bestBoard[forks[0].victim]!),
          b: pieceName(bestBoard[forks[1].victim]!),
          side: side(them),
        }),
      );
    const won = captures(move.before, me, best);
    const gain = balance(won, me);
    if (gain >= WORTH)
      reason.push(
        tn(locale, 'explain.gain', gain, {
          line: join(best.slice(0, (won.at(-1)?.index ?? 0) + 1)),
          side: side(me),
          points: points(gain),
        }),
      );
  }
  const certain = problem.length > 0 || reason.length > 0;
  if (!problem.length)
    problem.push(
      say('explain.noLoss', {
        from: scoreText(result.before.score, locale),
        to: scoreText(played, locale),
      }),
    );
  if (!reason.length && first)
    reason.push(
      say('explain.prefers', {
        move: first.text,
        score: scoreText(result.before.score, locale),
        line: join(best.slice(0, 4)),
      }),
    );
  return { problem, reason, certain };
}
