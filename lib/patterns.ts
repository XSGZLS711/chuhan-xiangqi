import {
  hasLegalMove,
  inCheck,
  moveBoard,
  opposite,
  pseudoLegal,
  type Board,
  type Piece,
  type Side,
} from './xiangqi';

/** Classic openings and mating patterns the board recognises as they are played. Pure: the
 * board works them out from the position before a move and the move itself, so they show
 * the same in friend rooms, AI games, reviews and free play.
 */
export const OPENING_PATTERNS = [
  'central-cannon',
  'corner-cannon',
  'cross-cannon',
  'pawn-opening',
  'elephant-opening',
  'horse-opening',
  'same-cannons',
  'opposite-cannons',
  'screen-horses',
] as const;
export const MATE_PATTERNS = [
  'iron-bolt',
  'smothered',
  'double-cannon',
  'horse-cannon',
  'double-chariot',
  'crouching-horse',
  'corner-horse',
] as const;
export type PatternId =
  | (typeof OPENING_PATTERNS)[number]
  | (typeof MATE_PATTERNS)[number];
/** What the board draws while a pattern's name is shown. */
export type Motif = 'aim' | 'bolt' | 'seal' | 'screen' | 'lines';
export type PatternHit = {
  id: PatternId;
  kind: 'opening' | 'mate';
  /** The side that played it. */
  side: Side;
  /** Squares whose pieces take part; they glow while the name is shown. */
  focus: number[];
  /** Lines of force, square to square. */
  lines: [number, number][];
  /** The enemy general the pattern bears on, if it bears on one. */
  target: number | null;
  motif: Motif;
};

/** The general of `side` and the pieces giving it check, for drawing the lines of attack. */
export function checkLines(
  board: Board,
  side: Side,
): { king: number; from: number[] } | null {
  const king = board.findIndex((p) => p?.side === side && p.kind === 'k');
  if (king < 0) return null;
  const from = board.flatMap((p, i) =>
    p && p.side !== side && pseudoLegal(board, i, king) ? [i] : [],
  );
  return from.length ? { king, from } : null;
}

const row = (n: number) => Math.floor(n / 9),
  col = (n: number) => n % 9;
/** Rows counted from a side's own back rank: rank 0 is where its general starts. */
const rowOf = (side: Side, rank: number) => (side === 'red' ? 9 - rank : rank);
const kingOf = (b: Board, side: Side) =>
  b.findIndex((p) => p?.side === side && p.kind === 'k');

/** Where a piece of the standard set started, read from its id (`red-c-7`). */
export function homeSquare(p: Piece): number | null {
  const m = /^(?:red|black)-[kaehrcp]-(\d)$/.exec(p.id);
  if (!m) return null;
  const rank = p.kind === 'c' ? 2 : p.kind === 'p' ? 3 : 0;
  return rowOf(p.side, rank) * 9 + Number(m[1]);
}
/** Every piece of `side` still on the point it started on. */
function untouched(b: Board, side: Side) {
  let count = 0;
  for (let n = 0; n < 90; n++) {
    const p = b[n];
    if (p?.side !== side) continue;
    if (homeSquare(p) !== n) return false;
    count++;
  }
  return count === 16;
}
/** The only piece of `side` that has moved, if exactly one has. */
function onlyMoved(b: Board, side: Side) {
  let moved: number | null = null,
    count = 0;
  for (let n = 0; n < 90; n++) {
    const p = b[n];
    if (p?.side !== side) continue;
    count++;
    if (homeSquare(p) === n) continue;
    if (moved !== null) return null;
    moved = n;
  }
  return count === 16 ? moved : null;
}
/** The general, advisors and elephants of `side` still at home: the palace not yet touched. */
function guardHome(b: Board, side: Side) {
  return b.every(
    (p, n) =>
      !p ||
      p.side !== side ||
      !['k', 'a', 'e'].includes(p.kind) ||
      homeSquare(p) === n,
  );
}
/** The pieces strictly between two points on one line. */
function between(b: Board, from: number, to: number) {
  const step =
    row(from) === row(to)
      ? Math.sign(to - from)
      : col(from) === col(to)
        ? 9 * Math.sign(to - from)
        : 0;
  if (!step) return [];
  const found: number[] = [];
  for (let n = from + step; n !== to; n += step) if (b[n]) found.push(n);
  return found;
}

function hit(
  id: PatternId,
  side: Side,
  focus: number[],
  lines: [number, number][],
  target: number | null,
  motif: Motif,
): PatternHit {
  return {
    id,
    kind: (OPENING_PATTERNS as readonly string[]).includes(id)
      ? 'opening'
      : 'mate',
    side,
    focus,
    lines,
    target,
    motif,
  };
}

/** An opening named by a single quiet move: the first move of the game, the first reply to
 * a central cannon, or the second horse completing a screen. */
export function openingPattern(
  before: Board,
  from: number,
  to: number,
): PatternHit | null {
  const p = before[from];
  if (!p || before[to]) return null;
  const side = p.side,
    foe = opposite(side),
    after = moveBoard(before, from, to),
    enemyKing = kingOf(after, foe),
    [fr, fc, tr, tc] = [row(from), col(from), row(to), col(to)],
    rank = (r: number) => rowOf(side, r),
    gameStart = untouched(before, side) && untouched(before, foe);
  if (untouched(before, side) && p.kind === 'c' && fr === rank(2)) {
    if (tr === rank(2) && tc === 4 && (fc === 1 || fc === 7)) {
      // A central cannon answering one: the same flank (顺) or the other (列).
      const theirs = onlyMoved(before, foe),
        answer =
          theirs !== null &&
          theirs === rowOf(foe, 2) * 9 + 4 &&
          before[theirs]?.kind === 'c';
      if (answer) {
        const same = homeSquare(before[theirs]!)! % 9 === fc;
        return hit(
          same ? 'same-cannons' : 'opposite-cannons',
          side,
          [to, theirs],
          [[to, theirs]],
          null,
          'lines',
        );
      }
      if (gameStart)
        return hit(
          'central-cannon',
          side,
          [to],
          [[to, enemyKing]],
          enemyKing,
          'aim',
        );
    }
    if (gameStart && tr === fr && (tc === 3 || tc === 5)) {
      // The cannon stays on its own flank (士角) or crosses the palace front (过宫).
      const corner = (fc === 1 && tc === 3) || (fc === 7 && tc === 5);
      return hit(
        corner ? 'corner-cannon' : 'cross-cannon',
        side,
        [to],
        [[to, rowOf(foe, 0) * 9 + tc]],
        null,
        'lines',
      );
    }
  }
  if (gameStart) {
    if (p.kind === 'p' && (fc === 2 || fc === 6) && tc === fc && tr === rank(4))
      return hit(
        'pawn-opening',
        side,
        [to],
        [[to, rowOf(foe, 3) * 9 + tc]],
        null,
        'lines',
      );
    if (p.kind === 'e' && tr === rank(2) && tc === 4)
      return hit('elephant-opening', side, [to], [[from, to]], null, 'lines');
    if (p.kind === 'h' && tr === rank(2) && (tc === 2 || tc === 6))
      return hit('horse-opening', side, [to], [[from, to]], null, 'lines');
  }
  // The screen: both horses on their third-rank points behind a closed palace, facing a
  // central cannon, completed by this move.
  if (p.kind === 'h' && tr === rank(2) && (tc === 2 || tc === 6)) {
    const other = rank(2) * 9 + (tc === 2 ? 6 : 2),
      cannon = rowOf(foe, 2) * 9 + 4;
    if (
      after[other]?.kind === 'h' &&
      after[other]?.side === side &&
      guardHome(after, side) &&
      after[cannon]?.kind === 'c' &&
      after[cannon]?.side === foe
    )
      return hit(
        'screen-horses',
        side,
        [to, other],
        [],
        kingOf(after, side),
        'screen',
      );
  }
  return null;
}

/** How a mate was given, from the final position; `mated` is the side that has lost. */
export function matePattern(board: Board, mated: Side): PatternHit | null {
  const check = checkLines(board, mated);
  if (!check) return null;
  const { king, from: checkers } = check,
    side = opposite(mated),
    kr = row(king),
    kc = col(king),
    lines = checkers.map((n): [number, number] => [n, king]),
    ours = (n: number, kind: Piece['kind']) =>
      board[n]?.side === side && board[n]?.kind === kind;
  // 铁门栓: a cannon holds the central file while a chariot or soldier mates on the flank.
  const bolt = board.findIndex(
    (p, n) => p?.side === side && p.kind === 'c' && col(n) === 4,
  );
  if (
    (kc === 3 || kc === 5) &&
    bolt >= 0 &&
    checkers.some((n) => ours(n, 'r') || ours(n, 'p'))
  )
    return hit('iron-bolt', side, [...checkers, bolt], lines, king, 'bolt');
  // 闷杀: every point the general could step to inside the palace is filled by its own men.
  const palace = (n: number) =>
    col(n) >= 3 &&
    col(n) <= 5 &&
    (mated === 'black' ? row(n) <= 2 : row(n) >= 7);
  const around = [
    king - 9,
    king + 9,
    kc > 0 ? king - 1 : -1,
    kc < 8 ? king + 1 : -1,
  ].filter((n) => n >= 0 && n < 90 && palace(n));
  if (around.length && around.every((n) => board[n]?.side === mated))
    return hit(
      'smothered',
      side,
      [...checkers, ...around],
      lines,
      king,
      'seal',
    );
  for (const n of checkers) {
    if (!ours(n, 'c')) continue;
    const [screen] = between(board, n, king);
    // 重炮 and 马后炮: the cannon's screen is a cannon, or a horse, of its own side.
    if (screen !== undefined && ours(screen, 'c'))
      return hit(
        'double-cannon',
        side,
        [n, screen],
        [[n, king]],
        king,
        'lines',
      );
    if (screen !== undefined && ours(screen, 'h'))
      return hit('horse-cannon', side, [n, screen], [[n, king]], king, 'lines');
  }
  for (const n of checkers) {
    if (!ours(n, 'r')) continue;
    // 双车错: one chariot checks along a line, the other holds the line next to it.
    const alongRow = row(n) === kr;
    const partner = board.findIndex(
      (p, m) =>
        m !== n &&
        p?.side === side &&
        p.kind === 'r' &&
        (alongRow ? Math.abs(row(m) - kr) === 1 : Math.abs(col(m) - kc) === 1),
    );
    if (partner >= 0)
      return hit(
        'double-chariot',
        side,
        [n, partner],
        [
          [n, king],
          [partner, alongRow ? row(partner) * 9 + kc : kr * 9 + col(partner)],
        ],
        king,
        'lines',
      );
  }
  for (const n of checkers) {
    if (!ours(n, 'h')) continue;
    const dr = Math.abs(row(n) - kr),
      dc = Math.abs(col(n) - kc);
    // 卧槽: beside the general's elephant eye; 挂角: on the advisor's corner, two ranks off.
    if (dr === 1 && dc === 2)
      return hit('crouching-horse', side, [n], [[n, king]], king, 'lines');
    if (dr === 2 && dc === 1)
      return hit('corner-horse', side, [n], [[n, king]], king, 'lines');
  }
  return null;
}

/** The pattern a move completes, if any: a named mate when it mates, else a named opening. */
export function movePattern(
  before: Board,
  from: number,
  to: number,
): PatternHit | null {
  const mover = before[from]?.side;
  if (!mover) return null;
  const after = moveBoard(before, from, to),
    foe = opposite(mover);
  if (inCheck(after, foe))
    return hasLegalMove(after, foe) ? null : matePattern(after, foe);
  return openingPattern(before, from, to);
}
