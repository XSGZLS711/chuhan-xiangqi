import { reasonText, sideName, t, type Locale, type MessageKey } from './i18n';
import { REASON } from './tokens';
import {
  hasLegalMove,
  inCheck,
  initialBoard,
  moveBoard,
  opposite,
  pseudoLegal,
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
  | 'select'
  | 'deal'
  | 'move'
  | 'capture'
  | 'undo'
  | 'check'
  | 'mate'
  | 'result';
/** What a stamp says, as dictionary keys plus the side and reason it names. The overlay turns
 * it into words in the viewer's language when it draws, so switching language mid-stamp works. */
export type StampText = {
  title: MessageKey;
  detail: MessageKey;
  side?: Side;
  reason?: string;
};
export type BoardEffect = {
  id: string;
  kind: 'capture' | 'check' | 'mate' | 'result';
  /** The Chinese words, kept for callers that read them; display with `stampWords`. */
  title: string;
  detail: string;
  side?: Side;
  analysis?: boolean;
  text: StampText;
};
export function stampWords(
  locale: Locale,
  effect: Pick<BoardEffect, 'text' | 'analysis'>,
): { title: string; detail: string; word: string } {
  const { text } = effect;
  const title = t(locale, text.title);
  return {
    title,
    word: text.title === 'stamp.check' ? t(locale, 'stamp.check.word') : title,
    detail:
      (effect.analysis ? t(locale, 'stamp.exploring') : '') +
      t(locale, text.detail, {
        side: text.side ? sideName(locale, text.side) : '',
        reason: text.reason ? reasonText(locale, text.reason) : '',
      }),
  };
}
function stamp(
  base: Omit<BoardEffect, 'title' | 'detail'>,
  locale: Locale = 'zh',
): BoardEffect {
  const { title, detail } = stampWords(locale, base);
  return { ...base, title, detail };
}
export const STAMP_TIMING = {
  delayMs: 250,
  enterMs: 150,
  fadeMs: 400,
  /** The most a slow landing (a cannon's vault) holds the stamp back. */
  lateMs: 220,
};
/** The stamp lands with the blow: its usual delay, or just before a later landing. */
export const stampDelay = (landMs: number) =>
  Math.min(
    STAMP_TIMING.delayMs + STAMP_TIMING.lateMs,
    Math.max(STAMP_TIMING.delayMs, landMs - 20),
  );
/** Visible lifetime, after the stamp's delayed entrance. */
export const stampDuration = (kind: BoardEffect['kind']) =>
  kind === 'mate' || kind === 'result' ? 1600 : 1400;
/** Includes the entrance delay, so cleanup cannot cut the fade short. */
export const effectDuration = (kind: BoardEffect['kind']) =>
  STAMP_TIMING.delayMs + STAMP_TIMING.lateMs + stampDuration(kind);
export function captureEffect(
  id: string,
  side: Side,
  analysis = false,
  locale: Locale = 'zh',
): BoardEffect {
  return stamp(
    {
      id,
      kind: 'capture',
      side,
      analysis,
      text: { title: 'stamp.capture', detail: 'stamp.capture.detail', side },
    },
    locale,
  );
}
function resultTitle(result: Result): MessageKey {
  if (result.reason === REASON.mate) return 'stamp.mate';
  if (result.winner === 'draw') return 'stamp.draw';
  if (
    result.reason === REASON.resigned.red ||
    result.reason === REASON.resigned.black
  )
    return 'stamp.resigned';
  if (result.reason === REASON.stalemate) return 'stamp.stalemate';
  if (result.reason === REASON.timeout) return 'stamp.timeout';
  if (result.reason === REASON.perpetual) return 'stamp.perpetual';
  return 'stamp.over';
}
export function resultEffect(
  result: Result,
  id: string,
  analysis = false,
  locale: Locale = 'zh',
): BoardEffect {
  const mate = result.reason === REASON.mate;
  // Name how the game ended, not who won: both players and spectators see this stamp.
  return stamp(
    {
      id,
      kind: mate ? 'mate' : 'result',
      side: result.winner === 'draw' ? undefined : result.winner,
      analysis,
      text: {
        title: resultTitle(result),
        detail:
          result.winner === 'draw' ? 'result.reasonOnly' : 'result.withReason',
        side: result.winner === 'draw' ? undefined : result.winner,
        reason: result.reason,
      },
    },
    locale,
  );
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
    if (move.captured)
      effect = captureEffect(
        `${next.id}:${next.round}:${next.version}`,
        move.side,
      );
    if (move.check && !next.result) {
      sounds.push('check');
      effect = stamp({
        id: `${next.id}:${next.round}:${next.version}`,
        kind: 'check',
        side: move.side,
        text: {
          title: 'stamp.check',
          detail: 'stamp.check.detail',
          side: next.turn,
        },
      });
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
      {
        winner: turn,
        reason: inCheck(next, nextTurn) ? REASON.mate : REASON.stalemate,
      },
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
      effect: stamp({
        id,
        kind: 'check',
        side: turn,
        analysis: true,
        text: {
          title: 'stamp.check',
          detail: 'stamp.check.detail',
          side: nextTurn,
        },
      }),
    };
  }
  return { sounds, effect: board[to] ? captureEffect(id, turn, true) : null };
}
