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
export type NotationStyle = 'chinese' | 'wxf' | 'vietnamese';

type Direction = 'forward' | 'back' | 'along';
/** What the Latin notations say about a move: the piece, the file it stands on, its place
 * among same pieces on that file (front first), the direction, and the destination file
 * (horse, advisor, elephant, or any move along the rank) or the number of steps. Files count
 * 1..9 from each player's right, as the Chinese notation does.
 */
function moveParts(b: Board, from: number, to: number) {
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
  const direction: Direction =
    y === Y ? 'along' : (p.side === 'red' ? Y < y : Y > y) ? 'forward' : 'back';
  return {
    kind: p.kind,
    file: file(x),
    index: twins.findIndex((v) => v.i === from),
    count: twins.length,
    direction,
    target:
      direction === 'along' ||
      p.kind === 'h' ||
      p.kind === 'a' ||
      p.kind === 'e'
        ? file(X)
        : Math.abs(Y - y),
  };
}

const WXF_LETTER: Record<Kind, string> = {
  k: 'K',
  a: 'A',
  e: 'E',
  h: 'H',
  r: 'R',
  c: 'C',
  p: 'P',
};
const WXF_DIRECTION: Record<Direction, string> = {
  forward: '+',
  back: '-',
  along: '=',
};

/** WXF notation: piece letter, the file it stands on, `+` forward / `-` backward / `=` along
 * the rank, then the destination file (horse, advisor, elephant) or the number of steps.
 * Same pieces on one file drop the file number for a prefix before the letter: `+` the
 * front piece, `-` the rear one, and with three or more pawns the ones in between by number
 * from the front (`+P`, `2P`, `-P`).
 */
export function wxfNotation(b: Board, from: number, to: number): string {
  const { kind, file, index, count, direction, target } = moveParts(
    b,
    from,
    to,
  );
  const letter = WXF_LETTER[kind];
  const prefix =
    count === 1
      ? letter + file
      : (index === 0 ? '+' : index === count - 1 ? '-' : String(index + 1)) +
        letter;
  return prefix + WXF_DIRECTION[direction] + target;
}

const VIETNAMESE_LETTER: Record<Kind, string> = {
  k: 'Tg',
  a: 'S',
  e: 'T',
  h: 'M',
  r: 'X',
  c: 'P',
  p: 'B',
};
const VIETNAMESE_DIRECTION: Record<Direction, string> = {
  forward: '.',
  back: '/',
  along: '-',
};

/** Vietnamese notation, as the Luật Cờ Tướng writes a game record: Tg (tướng), S (sĩ),
 * T (tượng), X (xe), P (pháo), M (mã), B (binh, the pawn, so it does not read as tượng),
 * the file, `.` tiến (forward) / `/` thoái (backward) / `-` bình (along the rank), then the
 * destination file or the number of steps, counted as WXF counts them (`P2-5`, `M2.3`,
 * `X1/1`). Same pieces on one file drop the file number for a letter after the piece's:
 * `t` (trước) the front one, `s` (sau) the rear, `g` (giữa) the middle of three pawns
 * (`Pt/1`, `Xs.2`, `Bg.1`). Four or five pawns on a file have no letter for the ones in
 * between: they are numbered from the front, before the letter as in WXF (`2B-4`), so the
 * number cannot be read as a file.
 */
export function vietnameseNotation(b: Board, from: number, to: number): string {
  const { kind, file, index, count, direction, target } = moveParts(
    b,
    from,
    to,
  );
  const letter = VIETNAMESE_LETTER[kind];
  const prefix =
    count === 1
      ? letter + file
      : index === 0
        ? letter + 't'
        : index === count - 1
          ? letter + 's'
          : count === 3
            ? letter + 'g'
            : index + 1 + letter;
  return prefix + VIETNAMESE_DIRECTION[direction] + target;
}

const WRITERS: Record<
  NotationStyle,
  (board: Board, from: number, to: number) => string
> = { chinese: notation, wxf: wxfNotation, vietnamese: vietnameseNotation };

/** The move from `from` to `to` on `board`, written in the chosen style. */
export function moveText(
  board: Board,
  from: number,
  to: number,
  style: NotationStyle,
): string {
  return WRITERS[style](board, from, to);
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
