import { engineMove } from './ai-game';
import {
  scoreToWinProbability,
  type AnalysisScore,
  type GameAnalysis,
  type MoveAnalysis,
  type MoveRating,
} from './game-analysis';
import {
  legalMove,
  moveBoard,
  notation,
  opposite,
  type Board,
  type Move,
  type Side,
} from './xiangqi';

/** Chart and bar values are red's view in centipawns; mates pin to the edge. */
export const SCORE_CAP = 1000;
export function scoreValue(score: AnalysisScore): number {
  if (score.kind === 'cp')
    return Math.max(-SCORE_CAP, Math.min(SCORE_CAP, score.value));
  if (score.winner === 'draw') return 0;
  return score.winner === 'red' ? SCORE_CAP : -SCORE_CAP;
}
const sideName = (side: Side) => (side === 'red' ? '红' : '黑');
export function scoreText(score: AnalysisScore | null): string {
  if (!score) return '分析中';
  // A finished game (resignation, draw, timeout) has no engine score left.
  if (score.kind === 'result')
    return score.winner === 'draw' ? '和棋' : `${sideName(score.winner)}胜`;
  if (score.kind === 'mate')
    return score.plies === 0
      ? `${sideName(score.winner)}胜`
      : `${sideName(score.winner)}方${Math.ceil(score.plies / 2)}步杀`;
  const value = Math.round(score.value);
  return Math.abs(value) < 10
    ? '均势'
    : `${value > 0 ? '红' : '黑'}优 ${Math.abs(value)}`;
}
/** Red's share of the advantage bar, 0..1. */
export const redShare = (score: AnalysisScore | null) =>
  score ? scoreToWinProbability(score, 'red') : 0.5;

function completed(analysis: GameAnalysis | null, index: number) {
  const entry = analysis?.moves[index];
  return entry?.status === 'complete' ? entry.analysis : null;
}
/** The evaluation of the position after `ply` moves (0 = the start). */
export function scoreAt(
  analysis: GameAnalysis | null,
  ply: number,
): AnalysisScore | null {
  if (ply === 0) return completed(analysis, 0)?.before.score ?? null;
  return completed(analysis, ply - 1)?.after.score ?? null;
}
export type ReviewPoint = {
  ply: number;
  value: number | null;
  rating: MoveRating;
};
export function reviewSeries(
  analysis: GameAnalysis | null,
  plies: number,
): ReviewPoint[] {
  return Array.from({ length: plies + 1 }, (_, ply) => {
    const score = scoreAt(analysis, ply);
    return {
      ply,
      value: score ? scoreValue(score) : null,
      rating: ply ? (completed(analysis, ply - 1)?.rating ?? null) : null,
    };
  });
}

// Pawns, advisors and elephants barely change the phase; chariots, horses and cannons do.
const MAJOR: Partial<Record<string, number>> = { r: 9, h: 4, c: 4.5 };
const majorMaterial = (board: Board) =>
  board.reduce((sum, piece) => sum + (piece ? (MAJOR[piece.kind] ?? 0) : 0), 0);
export const FULL_MAJOR_MATERIAL = 70;
export const ENDGAME_MATERIAL = 40;
export type GamePhases = { middle: number | null; end: number | null };
export type Phase = 'opening' | 'middle' | 'end';
export const PHASE_LABELS: Record<Phase, string> = {
  opening: '开局',
  middle: '中局',
  end: '残局',
};
/** Plies at which the middlegame and the endgame begin, by position after that ply.
 * The middlegame starts by move 10 at the latest, earlier once a chariot, horse or
 * cannon is traded after the first four moves. The endgame starts once at most 40
 * of the 70 points of chariots, horses and cannons remain, about six pieces in all.
 */
export function gamePhases(
  history: readonly Move[],
  finalBoard: Board,
): GamePhases {
  const after = (ply: number) =>
    ply < history.length ? history[ply].before : finalBoard;
  let middle: number | null = null,
    end: number | null = null;
  for (let ply = 1; ply <= history.length; ply++) {
    const material = majorMaterial(after(ply));
    if (
      middle === null &&
      (ply >= 20 || (ply >= 8 && material < FULL_MAJOR_MATERIAL))
    )
      middle = ply;
    if (middle !== null && material <= ENDGAME_MATERIAL) {
      end = ply;
      break;
    }
  }
  return { middle, end };
}
/** The phase a move was played in, judged by the position it was played from. */
export function phaseOf(ply: number, phases: GamePhases): Phase {
  const from = ply - 1;
  if (phases.end !== null && from >= phases.end) return 'end';
  if (phases.middle !== null && from >= phases.middle) return 'middle';
  return 'opening';
}

/** Lichess-style accuracy from a win-probability loss (0..1); 100 = perfect. */
export function moveAccuracy(loss: number): number {
  const value = 103.1668 * Math.exp(-0.04354 * loss * 100) - 3.1669;
  return Math.max(0, Math.min(100, value));
}
export type Mistake = {
  ply: number;
  side: Side;
  text: string;
  rating: Exclude<MoveRating, null>;
};
export type SideReport = {
  overall: number | null;
  phases: Record<Phase, number | null>;
  counts: Record<Exclude<MoveRating, null>, number>;
  mistakes: Mistake[];
};
const mean = (values: number[]) =>
  values.length
    ? Math.round(values.reduce((a, b) => a + b, 0) / values.length)
    : null;
export function reviewReport(
  history: readonly Move[],
  analysis: GameAnalysis | null,
  phases: GamePhases,
): Record<Side, SideReport> {
  const build = (side: Side): SideReport => {
    const all: number[] = [],
      byPhase: Record<Phase, number[]> = { opening: [], middle: [], end: [] },
      counts = {
        inaccuracy: 0,
        mistake: 0,
        blunder: 0,
        'missed-mate': 0,
        'allowed-mate': 0,
      },
      mistakes: Mistake[] = [];
    history.forEach((move, index) => {
      const result = completed(analysis, index);
      if (!result || move.side !== side) return;
      const accuracy = moveAccuracy(result.winProbabilityLoss);
      all.push(accuracy);
      byPhase[phaseOf(index + 1, phases)].push(accuracy);
      if (result.rating) {
        counts[result.rating]++;
        mistakes.push({
          ply: index + 1,
          side,
          text: move.text,
          rating: result.rating,
        });
      }
    });
    return {
      overall: mean(all),
      phases: {
        opening: mean(byPhase.opening),
        middle: mean(byPhase.middle),
        end: mean(byPhase.end),
      },
      counts,
      mistakes,
    };
  };
  return { red: build('red'), black: build('black') };
}

/** "12." for red, "12…" for black: the round number of a ply. */
export const moveNumber = (ply: number, side: Side) =>
  `${Math.ceil(ply / 2)}${side === 'red' ? '.' : '…'}`;

export type LineStep = { from: number; to: number; text: string; board: Board };
/** Engine lines run deep; past ten moves they stop being instructive on a phone. */
export const LINE_LIMIT = 10;
/** Plays an engine line from a position, stopping at the first illegal move. */
export function lineSteps(
  start: Board,
  side: Side,
  pv: readonly string[],
): LineStep[] {
  const steps: LineStep[] = [];
  let board = start,
    turn = side;
  for (const token of pv.slice(0, LINE_LIMIT)) {
    const move = engineMove(token);
    if (!move || !legalMove(board, move.from, move.to, turn)) break;
    const text = notation(board, move.from, move.to);
    board = moveBoard(board, move.from, move.to);
    steps.push({ ...move, text, board });
    turn = opposite(turn);
  }
  return steps;
}
/** The rated move at `ply` and the engine's choice from the same position. */
export function moveComparison(
  history: readonly Move[],
  analysis: GameAnalysis | null,
  ply: number,
): {
  played: Move;
  result: MoveAnalysis | null;
  best: LineStep[];
  actual: LineStep[];
} | null {
  const played = history[ply - 1];
  if (!played) return null;
  const result = completed(analysis, ply - 1);
  // Older caches have no restricted search: rebuild the line from the reply.
  const actualLine = result
    ? (result.played?.pv ?? [result.move, ...result.after.pv])
    : [];
  return {
    played,
    result,
    best: result ? lineSteps(played.before, played.side, result.before.pv) : [],
    actual: lineSteps(played.before, played.side, actualLine),
  };
}
/** How good the played move was judged, from the same search as the rating. */
export const playedScore = (result: MoveAnalysis) =>
  (result.played ?? result.after).score;
