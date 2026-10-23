import {
  hasLegalMove,
  inCheck,
  initialBoard,
  moveBoard,
  opposite,
  sideLabel,
  type Board,
  type Kind,
  type Piece,
  type Result,
  type Side,
} from './xiangqi';
import type { PublicRoom } from './game';

const originalPieces = initialBoard().filter(
  (piece): piece is Piece => !!piece,
);
const captureOrder: Kind[] = ['r', 'h', 'c', 'e', 'a', 'p', 'k'];
export type CaptureGroup = { piece: Piece; count: number };
export function capturedBy(board: Board, side: Side): CaptureGroup[] {
  const remaining = new Set(
    board.flatMap((piece) => (piece ? [piece.id] : [])),
  );
  const missing = originalPieces.filter(
    (piece) => piece.side === opposite(side) && !remaining.has(piece.id),
  );
  return captureOrder.flatMap((kind) => {
    const group = missing.filter((piece) => piece.kind === kind);
    return group.length ? [{ piece: group[0], count: group.length }] : [];
  });
}

/** Identity of every piece on every square; equal boards compare equal across polls. */
export function boardSignature(board: Board): string {
  return board.map((piece) => piece?.id ?? '').join('|');
}

export type BoardTransition = {
  piece: Piece;
  from: number;
  to: number;
  captured: Piece | null;
  /** A piece restored by undoing a capture; it reappears on `from`. */
  revived: Piece | null;
};
export function boardTransition(
  before: Board,
  after: Board,
): BoardTransition | null {
  const old = new Map(
    before.flatMap((piece, index) =>
      piece ? [[piece.id, index] as const] : [],
    ),
  );
  const now = new Set(after.flatMap((piece) => (piece ? [piece.id] : [])));
  const appeared = after.filter(
    (piece): piece is Piece => !!piece && !old.has(piece.id),
  );
  const changes = after.flatMap((piece, to) => {
    if (!piece || !old.has(piece.id) || old.get(piece.id) === to) return [];
    return [{ piece, from: old.get(piece.id)!, to }];
  });
  // A jump in the replay or a reconnect may contain many moves. Don't invent a capture.
  if (changes.length !== 1) return null;
  const move = changes[0];
  const removed = before.filter(
    (piece): piece is Piece => !!piece && !now.has(piece.id),
  );
  if (removed.length > 1 || appeared.length > 1) return null;
  if (removed.length && appeared.length) return null;
  const captured = before[move.to];
  if (
    removed.length &&
    (!captured ||
      removed[0].id !== captured.id ||
      captured.side === move.piece.side)
  )
    return null;
  return {
    ...move,
    captured: removed.length ? captured : null,
    revived: appeared[0] ?? null,
  };
}

/** The slice of a room the sound and effect feedback depends on. */
export type FeedbackRoom = Pick<
  PublicRoom,
  'id' | 'round' | 'version' | 'history' | 'result' | 'turn'
>;

export const LOW_CLOCK_MS = 30_000;

export type SoundKind =
  | 'move'
  | 'capture'
  | 'undo'
  | 'check'
  | 'mate'
  | 'result';
export type BoardEffect = {
  id: string;
  kind: 'check' | 'mate' | 'result';
  title: string;
  detail: string;
  side?: Side;
  analysis?: boolean;
};
/** How long an overlay stays up; the stylesheet reads the same value as --fx. */
export const effectDuration = (kind: BoardEffect['kind']) =>
  kind === 'check' ? 1500 : 3400;
export function resultEffect(
  result: Result,
  id: string,
  analysis = false,
): BoardEffect {
  const mate = result.reason === '将死';
  return {
    id,
    kind: mate ? 'mate' : 'result',
    title: mate
      ? '绝杀'
      : result.winner === 'draw'
        ? '和棋'
        : result.reason === '困毙'
          ? '困毙'
          : '胜局',
    detail:
      (analysis ? '推演 · ' : '') +
      (result.winner === 'draw'
        ? result.reason
        : sideLabel(result.winner) + '获胜 · ' + result.reason),
    side: result.winner === 'draw' ? undefined : result.winner,
    analysis,
  };
}

export function updateFeedback<T extends FeedbackRoom>(
  previous: T | null,
  next: T,
): { sounds: SoundKind[]; effect: BoardEffect | null; reset: boolean } {
  const empty = { sounds: [] as SoundKind[], effect: null, reset: false };
  if (!previous || previous.id !== next.id || previous.round !== next.round)
    return { ...empty, reset: true };
  if (next.version <= previous.version) return empty;
  if (
    next.history.length < previous.history.length ||
    (previous.result && !next.result)
  )
    return { sounds: ['undo'], effect: null, reset: true };
  const sounds: SoundKind[] = [];
  let effect: BoardEffect | null = null;
  const moved = next.history.length === previous.history.length + 1;
  if (moved) {
    const move = next.history[next.history.length - 1];
    sounds.push(move.captured ? 'capture' : 'move');
    if (move.check && !next.result) {
      sounds.push('check');
      effect = {
        id: `${next.id}:${next.round}:${next.version}`,
        kind: 'check',
        title: '将军',
        detail: sideLabel(next.turn) + '应将',
        side: move.side,
      };
    }
  }
  if (!previous.result && next.result) {
    effect = resultEffect(
      next.result,
      `${next.id}:${next.round}:${next.version}`,
    );
    sounds.push(effect.kind === 'mate' ? 'mate' : 'result');
  }
  return { sounds, effect, reset: false };
}

/** Sound and overlay for a move made on a free-play branch (no server involved). */
export function branchFeedback(
  board: Board,
  from: number,
  to: number,
  turn: Side,
  id: string,
): { sounds: SoundKind[]; effect: BoardEffect | null } {
  const next = moveBoard(board, from, to),
    nextTurn = opposite(turn);
  const sounds: SoundKind[] = [board[to] ? 'capture' : 'move'];
  if (!hasLegalMove(next, nextTurn)) {
    const effect = resultEffect(
      { winner: turn, reason: inCheck(next, nextTurn) ? '将死' : '困毙' },
      id,
      true,
    );
    sounds.push(effect.kind === 'mate' ? 'mate' : 'result');
    return { sounds, effect };
  }
  if (inCheck(next, nextTurn)) {
    sounds.push('check');
    return {
      sounds,
      effect: {
        id,
        kind: 'check',
        title: '将军',
        detail: '推演 · ' + sideLabel(nextTurn) + '应将',
        side: turn,
        analysis: true,
      },
    };
  }
  return { sounds, effect: null };
}
