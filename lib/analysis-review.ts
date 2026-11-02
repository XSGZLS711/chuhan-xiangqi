import { describeLine, squareToEngine } from './ai-game';
import type { GameAnalysis } from './game-analysis';
import type { Move } from './xiangqi';

/** Recommendations belong to the position before the rated move, not after it. */
export function ratingReviewSelection(
  history: readonly Move[],
  analysis: GameAnalysis | null,
  ply: number,
) {
  if (!Number.isInteger(ply) || ply < 1) return null;
  const played = history[ply - 1],
    entry = analysis?.moves[ply - 1];
  if (
    !played ||
    entry?.status !== 'complete' ||
    !entry.analysis.rating ||
    entry.side !== played.side ||
    entry.move !== squareToEngine(played.from) + squareToEngine(played.to)
  )
    return null;
  const move = entry.analysis.recommendedMove;
  return {
    ply,
    index: ply - 1,
    recommendation: move
      ? (describeLine(played.before, played.side, [move], 1)[0] ?? null)
      : null,
  };
}
