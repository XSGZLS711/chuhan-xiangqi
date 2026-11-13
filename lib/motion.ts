import type { Board } from './xiangqi';

/** Shared by board animation and sound scheduling; all times are milliseconds.
 * A lifted piece glides over in about 110 ms (measured at 60 fps). It starts to
 * tip its leading edge down halfway through the glide, so the set-down is long
 * enough to see, and lies flat at the landing, when the knock sounds. Captures
 * hang a little longer first.
 */
export const PIECE_MOTION = {
  slideMs: 110,
  moveHoverMs: 60,
  captureHoverMs: 130,
  dropMs: 140,
  /** After landing it rocks and settles; sound and overlays ignore this part. */
  settleMs: 320,
  selectionMs: 90,
};

/** How a piece travels, after the way it moves on the board:
 * - glide: lifted and carried straight over (advisors, elephants, soldiers, short moves);
 * - gallop: the horse touches down on its leg point, then leaps the diagonal (日);
 * - leap: a capturing cannon vaults its screen in a high arc and slams down;
 * - charge: a chariot crossing three or more points rushes over with a wake behind it.
 */
export type MoveStyle = 'glide' | 'gallop' | 'leap' | 'charge';

export function moveStyle(board: Board, from: number, to: number): MoveStyle {
  const piece = board[from];
  if (!piece) return 'glide';
  const rows = Math.abs(Math.floor(to / 9) - Math.floor(from / 9)),
    files = Math.abs((to % 9) - (from % 9));
  if (piece.kind === 'h' && rows + files === 3) return 'gallop';
  if (piece.kind === 'c' && board[to]) return 'leap';
  if (piece.kind === 'r' && rows + files >= 3) return 'charge';
  return 'glide';
}

/** The horse's leg point: one step along the longer side of its 日. */
export function gallopLeg(from: number, to: number) {
  const dr = Math.floor(to / 9) - Math.floor(from / 9),
    dc = (to % 9) - (from % 9);
  return Math.abs(dr) === 2 ? from + Math.sign(dr) * 9 : from + Math.sign(dc);
}

/** The piece a capturing cannon jumps over, if any. */
export function cannonScreen(board: Board, from: number, to: number) {
  const step =
    Math.floor(from / 9) === Math.floor(to / 9)
      ? Math.sign(to - from)
      : 9 * Math.sign(to - from);
  for (let n = from + step; n !== to; n += step) if (board[n]) return n;
  return null;
}

/** Time in the air before the set-down begins, by style. Gallops and leaps finish
 * their flight before they tip down; glides and charges tip while still travelling. */
const TRAVEL: Record<
  MoveStyle,
  { slide: number; hover: number; drop: number }
> = {
  glide: { slide: PIECE_MOTION.slideMs, hover: 0, drop: PIECE_MOTION.dropMs },
  charge: { slide: 170, hover: 90, drop: 120 },
  gallop: { slide: 250, hover: 250, drop: 110 },
  leap: { slide: 380, hover: 380, drop: 90 },
};

export function pieceMotion(capture = false, style: MoveStyle = 'glide') {
  const travel = TRAVEL[style];
  const hoverMs =
    style === 'glide'
      ? capture
        ? PIECE_MOTION.captureHoverMs
        : PIECE_MOTION.moveHoverMs
      : travel.hover + (capture && style === 'charge' ? 40 : 0);
  const dropMs = travel.drop;
  const landMs = hoverMs + dropMs;
  return {
    ...PIECE_MOTION,
    style,
    slideMs: travel.slide,
    hoverMs,
    dropMs,
    landMs,
    durationMs: landMs + PIECE_MOTION.settleMs,
  };
}

/** A new game deals the set from the river outwards, soldiers first and the back rank
 * last, each rank from the middle file to the edges: the order a player sets up a board.
 * `square` may be in either orientation; the order is the same from both sides.
 */
export const DEAL = {
  durationMs: 460,
  /** When the piece lies flat. */ knockAt: 0.62,
};
export function dealDelay(square: number) {
  const row = Math.floor(square / 9),
    rank = row < 5 ? 4 - row : row - 5;
  return rank * 55 + Math.abs((square % 9) - 4) * 24;
}
