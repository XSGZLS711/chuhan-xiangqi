import type { BrowserEngine, SearchOptions } from './ai-engine';
import {
  engineMove,
  historyPosition,
  squareToEngine,
  type EngineInfo,
} from './ai-game';
import type { Room } from './game';
import {
  completeMoveAnalysis,
  createGameAnalysis,
  type GameAnalysis,
  type PositionEvaluation,
} from './game-analysis';
import {
  legalMove,
  moveBoard,
  opposite,
  outcome,
  type Board,
  type Side,
} from './xiangqi';

// Bump this when the vendored engine, evaluator, limits or score interpretation changes.
export const GAME_ANALYSIS_PROFILE =
  'fairy-1.1.12-classical-d12-t450-searchmoves-v1';
export const GAME_ANALYSIS_SEARCH = {
  depth: 12,
  time: 450,
  skill: 20,
} as const;
const abort = (signal: AbortSignal) => {
  if (signal.aborted)
    throw new DOMException('Analysis cancelled', 'AbortError');
};

/** Existing parseEngineInfo has already normalized both cp and mate to red. */
export function analysisEvaluation(
  info: EngineInfo,
  turn: Side,
): PositionEvaluation {
  if (!Number.isInteger(info.depth) || info.depth < 1)
    throw new Error('引擎未返回完整搜索评分');
  if (info.mate !== undefined) {
    if (!Number.isInteger(info.mate) || info.mate === 0)
      throw new Error('非终局的杀棋评分无效');
    const winner = info.mate > 0 ? 'red' : 'black';
    // UCI reports full moves. Winner-to-move mates have odd half-move distance.
    const plies = 2 * Math.abs(info.mate) - (winner === turn ? 1 : 0);
    return {
      score: { kind: 'mate', winner, plies },
      depth: info.depth,
      pv: [...info.pv],
    };
  }
  if (info.cp === undefined || !Number.isFinite(info.cp))
    throw new Error('引擎未返回可用评分');
  return {
    score: { kind: 'cp', value: info.cp },
    depth: info.depth,
    pv: [...info.pv],
  };
}
function validPv(board: Board, turn: Side, pv: readonly string[]) {
  if (!pv.length) return false;
  for (const token of pv) {
    const move = engineMove(token);
    if (!move || !legalMove(board, move.from, move.to, turn)) return false;
    board = moveBoard(board, move.from, move.to);
    turn = opposite(turn);
  }
  return true;
}
async function evaluate(
  engine: Pick<BrowserEngine, 'search'>,
  room: Room,
  index: number,
  signal: AbortSignal,
  actual?: string,
): Promise<PositionEvaluation> {
  abort(signal);
  const board = room.history[index]?.before ?? room.board;
  const turn = room.history[index]?.side ?? room.turn;
  let latest: PositionEvaluation | null = null;
  const options: SearchOptions = {
    ...GAME_ANALYSIS_SEARCH,
    position: historyPosition(room, index),
    turn,
    signal,
    ...(actual ? { searchMoves: [actual] } : {}),
    onInfo(info) {
      if (
        signal.aborted ||
        !validPv(board, turn, info.pv) ||
        (actual && info.pv[0] !== actual)
      )
        return;
      try {
        const evaluation = analysisEvaluation(info, turn);
        if (!latest || evaluation.depth >= latest.depth) latest = evaluation;
      } catch {
        /* Wait for a complete exact score instead of inventing one. */
      }
    },
  };
  const best = await engine.search(options);
  abort(signal);
  const result = latest as PositionEvaluation | null;
  if (!result || best !== result.pv[0] || (actual && best !== actual))
    throw new Error(`第 ${index + 1} 步未获得完整评分，请重试`);
  return result;
}
function terminalAfter(room: Room, ply: number): PositionEvaluation | null {
  const move = room.history[ply - 1];
  const board = room.history[ply]?.before ?? room.board;
  const result = outcome(
    board,
    opposite(move.side),
    room.history.slice(0, ply),
    move.captured ? 0 : move.quietBefore + 1,
  );
  if (!result) return null;
  return {
    score:
      result.reason === '将死' && result.winner !== 'draw'
        ? { kind: 'mate', winner: result.winner, plies: 0 }
        : { kind: 'result', winner: result.winner },
    depth: 0,
    pv: [],
  };
}

/** Each actual move is searched at the same root as its recommendation.
 * The unrestricted post-move search supplies the refutation and the next root.
 */
export async function analyseGame(
  room: Room,
  options: {
    gameId: string;
    engine: Pick<BrowserEngine, 'search'>;
    signal: AbortSignal;
    initial?: GameAnalysis;
    onProgress: (analysis: GameAnalysis) => void | Promise<void>;
  },
): Promise<GameAnalysis> {
  const { engine, signal, onProgress } = options;
  const moves = room.history.map(
    (move) => squareToEngine(move.from) + squareToEngine(move.to),
  );
  let analysis = options.initial ?? createGameAnalysis(options.gameId, moves);
  if (
    analysis.gameId !== options.gameId ||
    analysis.moves.length !== moves.length ||
    analysis.moves.some(
      (entry, i) =>
        entry.move !== moves[i] ||
        entry.ply !== i + 1 ||
        entry.side !== room.history[i].side,
    )
  )
    throw new Error('分析结果与存档棋谱不匹配');
  for (let index = 0; index < moves.length; index++) {
    abort(signal);
    if (analysis.moves[index].status === 'complete') continue;
    const ply = index + 1;
    try {
      const previous = analysis.moves[index - 1];
      const before =
        previous?.status === 'complete'
          ? previous.analysis.after
          : await evaluate(engine, room, index, signal);
      let played = await evaluate(engine, room, index, signal, moves[index]);
      const terminal = terminalAfter(room, ply);
      const after = terminal ?? (await evaluate(engine, room, ply, signal));
      if (terminal)
        played = {
          ...played,
          score:
            terminal.score.kind === 'mate'
              ? { ...terminal.score, plies: 1 }
              : { ...terminal.score },
        };
      abort(signal);
      analysis = completeMoveAnalysis(analysis, ply, before, after, played);
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof DOMException && error.name === 'AbortError')
      )
        throw error;
      const message = error instanceof Error ? error.message : '引擎分析失败';
      analysis = {
        ...analysis,
        moves: analysis.moves.map((entry, i) =>
          i === index
            ? {
                ply,
                side: entry.side,
                move: entry.move,
                status: 'failed',
                message,
              }
            : entry,
        ),
      };
      await onProgress(analysis);
      throw error;
    }
    await onProgress(analysis);
  }
  abort(signal);
  return analysis;
}
