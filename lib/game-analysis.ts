import { engineMove } from './ai-game';
import { t, type Locale, type MessageKey } from './i18n';
import type { Side } from './xiangqi';

/** All scores use red's perspective, including evaluations taken after black moves.
 * A mate names the winner explicitly: mate 0 cannot safely use a numeric sign.
 * Supply exact evaluations from comparable searches, not upper/lower bounds.
 */
export type AnalysisScore =
  | { kind: 'cp'; value: number }
  | { kind: 'result'; winner: Side | 'draw' }
  | { kind: 'mate'; winner: Side; plies: number };
export type PositionEvaluation = {
  score: AnalysisScore;
  depth: number;
  /** Engine-coordinate PV; its first move is the recommendation for this position. */
  pv: readonly string[];
};
export type LossThresholds = {
  unmarked: number;
  inaccuracy: number;
  mistake: number;
};
export type AnalysisConfig = { cpScale: number; thresholds: LossThresholds };

/** Provisional logistic model, not calibrated win frequencies for Fairy-Stockfish.
 * Loss and thresholds are absolute probability differences: 0.10 = 10 points.
 */
export const DEFAULT_ANALYSIS_CONFIG: Readonly<AnalysisConfig> = Object.freeze({
  cpScale: 400,
  thresholds: Object.freeze({ unmarked: 0.05, inaccuracy: 0.1, mistake: 0.2 }),
});
export type MoveRating =
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'missed-mate'
  | 'allowed-mate'
  | null;
/** A rating in the viewer's language: the short badge (中, ?!, ??) or, with `long`, the word. */
export function ratingLabel(
  locale: Locale,
  rating: Exclude<MoveRating, null>,
  long = false,
): string {
  return t(locale, `rating.${rating}${long ? '.long' : ''}` as MessageKey);
}
/** The Chinese badges. */
export const RATING_LABELS = {
  inaccuracy: ratingLabel('zh', 'inaccuracy'),
  mistake: ratingLabel('zh', 'mistake'),
  blunder: ratingLabel('zh', 'blunder'),
  'missed-mate': ratingLabel('zh', 'missed-mate'),
  'allowed-mate': ratingLabel('zh', 'allowed-mate'),
} as const;
export type MoveIdentity = { ply: number; side: Side; move: string };
export type MoveAnalysis = MoveIdentity & {
  before: PositionEvaluation;
  after: PositionEvaluation;
  /** Separate search at the original root, restricted to the actual move. */
  played?: PositionEvaluation;
  playedWinProbability?: number;
  recommendedMove: string | null;
  beforeWinProbability: number;
  afterWinProbability: number;
  winProbabilityLoss: number;
  missedMate: boolean;
  allowedMate: boolean;
  rating: MoveRating;
};
export type MoveAnalysisEntry = MoveIdentity &
  (
    | { status: 'pending' }
    | { status: 'failed'; message: string }
    | { status: 'complete'; analysis: MoveAnalysis }
  );
export type GameAnalysis = {
  version: 1;
  gameId: string;
  /** Keep model parameters with cached results so later calibration is explicit. */
  model: { kind: 'logistic'; calibrated: false; config: AnalysisConfig };
  moves: MoveAnalysisEntry[];
};
function validSide(side: Side) {
  if (side !== 'red' && side !== 'black') throw new Error('无效走棋方');
}
function validThresholds(thresholds: LossThresholds) {
  const { unmarked, inaccuracy, mistake } = thresholds;
  if (
    ![unmarked, inaccuracy, mistake].every(Number.isFinite) ||
    unmarked < 0 ||
    unmarked >= inaccuracy ||
    inaccuracy >= mistake ||
    mistake >= 1
  )
    throw new Error('评级阈值必须在 0 到 1 之间严格递增');
}
function validConfig(config: AnalysisConfig) {
  if (!Number.isFinite(config.cpScale) || config.cpScale <= 0)
    throw new Error('分数换算尺度必须为有限正数');
  validThresholds(config.thresholds);
}
function validScore(score: AnalysisScore) {
  if (score.kind === 'cp') {
    if (!Number.isFinite(score.value)) throw new Error('分数必须为有限数');
  } else if (score.kind === 'mate') {
    validSide(score.winner);
    if (!Number.isInteger(score.plies) || score.plies < 0)
      throw new Error('杀棋距离必须为非负整数');
  } else if (score.kind === 'result') {
    if (score.winner !== 'draw') validSide(score.winner);
  } else throw new Error('无效评分类型');
}
function validMove(move: string) {
  const parsed = engineMove(move);
  if (!parsed || parsed.from === parsed.to) throw new Error('无效引擎记谱');
}
function copyEvaluation(evaluation: PositionEvaluation): PositionEvaluation {
  validScore(evaluation.score);
  if (!Number.isInteger(evaluation.depth) || evaluation.depth < 0)
    throw new Error('搜索深度必须为非负整数');
  evaluation.pv.forEach(validMove);
  return {
    ...evaluation,
    score: { ...evaluation.score },
    pv: [...evaluation.pv],
  };
}

/** Heuristic probability proxy, not a WDL model; extreme finite scores stay stable. */
export function scoreToWinProbability(
  score: AnalysisScore,
  side: Side,
  cpScale = DEFAULT_ANALYSIS_CONFIG.cpScale,
): number {
  validScore(score);
  validSide(side);
  if (!Number.isFinite(cpScale) || cpScale <= 0)
    throw new Error('分数换算尺度必须为有限正数');
  if (score.kind === 'mate') return score.winner === side ? 1 : 0;
  if (score.kind === 'result')
    return score.winner === 'draw' ? 0.5 : score.winner === side ? 1 : 0;
  const signed = (side === 'red' ? score.value : -score.value) / cpScale;
  // Keep exponentials non-positive to avoid overflow on either side.
  if (signed >= 0) return 1 / (1 + Math.exp(-signed));
  const exp = Math.exp(signed);
  return exp / (1 + exp);
}

/** <=5 points unmarked, (5,10] 中, (10,20] 差, >20 错 by default. */
export function rateWinProbabilityLoss(
  loss: number,
  thresholds = DEFAULT_ANALYSIS_CONFIG.thresholds,
): MoveRating {
  validThresholds(thresholds);
  if (!Number.isFinite(loss) || loss < 0 || loss > 1)
    throw new Error('胜率损失必须在 0 到 1 之间');
  // Subtraction such as .8 - .75 must not cross an exact boundary by rounding.
  const exceeds = (boundary: number) => loss - boundary > Number.EPSILON * 8;
  if (exceeds(thresholds.mistake)) return 'blunder';
  if (exceeds(thresholds.inaccuracy)) return 'mistake';
  return exceeds(thresholds.unmarked) ? 'inaccuracy' : null;
}

export function analyseMove(
  input: MoveIdentity & {
    before: PositionEvaluation;
    after: PositionEvaluation;
    played?: PositionEvaluation;
  },
  config = DEFAULT_ANALYSIS_CONFIG,
): MoveAnalysis {
  validConfig(config);
  validSide(input.side);
  if (!Number.isInteger(input.ply) || input.ply < 1)
    throw new Error('步号必须从 1 开始');
  validMove(input.move);
  const before = copyEvaluation(input.before),
    after = copyEvaluation(input.after);
  if (
    before.score.kind === 'result' ||
    (before.score.kind === 'mate' && before.score.plies === 0)
  )
    throw new Error('已终局的局面不能继续评级走子');
  const played = input.played && copyEvaluation(input.played);
  if (played && played.pv[0] !== input.move)
    throw new Error('限定搜索与实际着法不一致');
  const beforeWinProbability = scoreToWinProbability(
    before.score,
    input.side,
    config.cpScale,
  );
  const afterWinProbability = scoreToWinProbability(
    after.score,
    input.side,
    config.cpScale,
  );
  const winProbabilityLoss = Math.max(
    0,
    beforeWinProbability -
      (played
        ? scoreToWinProbability(played.score, input.side, config.cpScale)
        : afterWinProbability),
  );
  const winsMate = (score: AnalysisScore) =>
    score.kind === 'mate' && score.winner === input.side;
  const losesMate = (score: AnalysisScore) =>
    score.kind === 'mate' && score.winner !== input.side;
  const compared = played?.score ?? after.score;
  const missedMate = winsMate(before.score) && !winsMate(compared);
  const allowedMate = !losesMate(before.score) && losesMate(compared);
  // A winning mate thrown into a losing mate is both; show 送杀 first.
  const rating = allowedMate
    ? 'allowed-mate'
    : missedMate
      ? 'missed-mate'
      : rateWinProbabilityLoss(winProbabilityLoss, config.thresholds);
  return {
    ply: input.ply,
    side: input.side,
    move: input.move,
    before,
    after,
    ...(played
      ? {
          played,
          playedWinProbability: scoreToWinProbability(
            played.score,
            input.side,
            config.cpScale,
          ),
        }
      : {}),
    recommendedMove: before.pv[0] ?? null,
    beforeWinProbability,
    afterWinProbability,
    winProbabilityLoss,
    missedMate,
    allowedMate,
    rating,
  };
}

/** Pure bookkeeping only: no worker, search, storage, clock or UI. */
export function createGameAnalysis(
  gameId: string,
  moves: readonly string[],
  config = DEFAULT_ANALYSIS_CONFIG,
): GameAnalysis {
  validConfig(config);
  if (!gameId.trim()) throw new Error('缺少对局标识');
  moves.forEach(validMove);
  return {
    version: 1,
    gameId,
    model: {
      kind: 'logistic',
      calibrated: false,
      config: { cpScale: config.cpScale, thresholds: { ...config.thresholds } },
    },
    moves: moves.map((move, i) => ({
      ply: i + 1,
      side: i % 2 ? 'black' : 'red',
      move,
      status: 'pending',
    })),
  };
}
export function completeMoveAnalysis(
  game: GameAnalysis,
  ply: number,
  before: PositionEvaluation,
  after: PositionEvaluation,
  played?: PositionEvaluation,
): GameAnalysis {
  const entry = game.moves[ply - 1];
  if (!Number.isInteger(ply) || !entry || entry.ply !== ply)
    throw new Error('存档中没有这一步');
  const analysis = analyseMove(
    { ...entry, before, after, played },
    game.model.config,
  );
  return {
    ...game,
    moves: game.moves.map((move) =>
      move.ply === ply
        ? {
            ply,
            side: entry.side,
            move: entry.move,
            status: 'complete',
            analysis,
          }
        : move,
    ),
  };
}
