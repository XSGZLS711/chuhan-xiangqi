import {
  displayNotation,
  notation,
  type Board,
  type Kind,
  type Move,
} from './xiangqi';

/** How a move is written. Today the interface language picks it; keeping it a separate
 * choice lets a notation switch come later without touching the languages.
 */
export type NotationStyle = 'chinese' | 'wxf';

const WXF_LETTER: Record<Kind, string> = {
  k: 'K',
  a: 'A',
  e: 'E',
  h: 'H',
  r: 'R',
  c: 'C',
  p: 'P',
};

/** WXF notation: piece letter, the file it stands on, `+` forward / `-` backward / `=` along
 * the rank, then the destination file (horse, advisor, elephant) or the number of steps.
 * Files count 1..9 from each player's right, as the Chinese notation does. Same pieces on
 * one file drop the file number for a prefix before the letter: `+` the front piece, `-` the
 * rear one, and with three or more pawns the ones in between by number from the front
 * (`+P`, `2P`, `-P`).
 */
export function wxfNotation(b: Board, from: number, to: number): string {
  const p = b[from]!;
  const x = from % 9,
    y = Math.floor(from / 9),
    X = to % 9,
    Y = Math.floor(to / 9);
  const file = (column: number) => (p.side === 'red' ? 9 - column : column + 1);
  // Front first: red advances toward index 0, black toward index 89.
  const twins = b
    .map((q, i) => ({ q, i }))
    .filter(
      ({ q, i }) => q?.side === p.side && q.kind === p.kind && i % 9 === x,
    )
    .sort((a, z) => (p.side === 'red' ? a.i - z.i : z.i - a.i));
  const index = twins.findIndex((v) => v.i === from);
  const letter = WXF_LETTER[p.kind];
  const prefix =
    twins.length === 1
      ? letter + file(x)
      : (index === 0
          ? '+'
          : index === twins.length - 1
            ? '-'
            : String(index + 1)) + letter;
  if (y === Y) return prefix + '=' + file(X);
  const forward = p.side === 'red' ? Y < y : Y > y;
  return (
    prefix +
    (forward ? '+' : '-') +
    (p.kind === 'h' || p.kind === 'a' || p.kind === 'e'
      ? file(X)
      : Math.abs(Y - y))
  );
}

/** The move from `from` to `to` on `board`, written in the chosen style. */
export function moveText(
  board: Board,
  from: number,
  to: number,
  style: NotationStyle,
): string {
  return style === 'wxf'
    ? wxfNotation(board, from, to)
    : notation(board, from, to);
}

/** Stored history keeps the Chinese text (`Move.text`); other styles are recomputed from the
 * position the move was played from, never translated from that text.
 */
export function historyMoveText(
  move: Pick<Move, 'text' | 'before' | 'from' | 'to'>,
  style: NotationStyle,
): string {
  return style === 'chinese'
    ? displayNotation(move.text)
    : moveText(move.before, move.from, move.to, style);
}
