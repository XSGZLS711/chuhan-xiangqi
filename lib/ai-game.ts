import { applyAction, newRoom, type Room } from './game';
import { sideName, t, type Locale, type MessageKey } from './i18n';
import { moveText, type NotationStyle } from './notation';
import { NAME } from './tokens';
import {
  legalMove,
  moveBoard,
  opposite,
  type Board,
  type Side,
} from './xiangqi';

export const AI_LEVELS = {
  easy: { skill: -10, depth: 4, time: 250 },
  medium: { skill: 0, depth: 9, time: 650 },
  hard: { skill: 20, depth: 16, time: 1500 },
} as const;
export type AiLevel = keyof typeof AI_LEVELS;
// A reply lands 1.2–1.8 s after the human's move, like a person's; the opening move as red,
// right after the setup closes, waits less. The search counts towards the pause.
export const AI_PAUSE = {
  opening: { min: 800, max: 1200 },
  reply: { min: 1200, max: 1800 },
} as const;
/** When the AI's move may appear, in ms after its turn began: `ply` is the number of moves
 * already played, `random` a draw in [0, 1). */
export function aiMovePause(ply: number, random = Math.random()): number {
  const { min, max } = ply === 0 ? AI_PAUSE.opening : AI_PAUSE.reply;
  return Math.round(min + (max - min) * Math.min(1, Math.max(0, random)));
}
/** What is left of the pause once the search took `elapsed` ms: a slower search waits no more. */
export function pauseLeft(pause: number, elapsed: number): number {
  return Math.max(0, pause - elapsed);
}
export const levelName = (locale: Locale, level: AiLevel) =>
  t(locale, `ai.level.${level}` as MessageKey);
export type AiMatch = {
  room: Room;
  human: Side;
  level: AiLevel;
  revision: number;
};

export function createAiMatch(human: Side, level: AiLevel, round = 1): AiMatch {
  const room = newRoom(
    'local-ai',
    { id: 'red', name: human === 'red' ? NAME.me : NAME.ai },
    0,
    Date.now(),
  );
  applyAction(
    room,
    'black',
    { action: 'join', name: human === 'black' ? NAME.me : NAME.ai },
    Date.now(),
  );
  room.round = round;
  return { room, human, level, revision: 0 };
}

export function playAiMove(match: AiMatch, from: number, to: number): AiMatch {
  const room = structuredClone(match.room);
  applyAction(room, room.turn, { action: 'move', from, to }, Date.now());
  return { ...match, room, revision: match.revision + 1 };
}

/** Undo to the human's previous decision, including a pending AI reply. */
export function undoAiTurn(match: AiMatch): AiMatch {
  if (!match.room.history.length && !match.room.result) return match;
  const room = structuredClone(match.room);
  do {
    applyAction(room, match.human, { action: 'undo' }, Date.now());
  } while (room.history.length && room.turn !== match.human);
  return { ...match, room, revision: match.revision + 1 };
}
export function resignAiMatch(match: AiMatch): AiMatch {
  const room = structuredClone(match.room);
  applyAction(room, match.human, { action: 'resign' }, Date.now());
  return { ...match, room, revision: match.revision + 1 };
}

// Fairy-Stockfish uses a1..i10 for Xiangqi (Pikafish uses a different convention).
export function squareToEngine(square: number): string {
  if (!Number.isInteger(square) || square < 0 || square >= 90)
    throw new Error('无效棋盘坐标');
  return String.fromCharCode(97 + (square % 9)) + (10 - Math.floor(square / 9));
}
export function engineMove(move: string): { from: number; to: number } | null {
  const m = /^([a-i])(10|[1-9])([a-i])(10|[1-9])$/.exec(move);
  if (!m) return null;
  const square = (file: string, rank: string) =>
    (10 - Number(rank)) * 9 + file.charCodeAt(0) - 97;
  return { from: square(m[1], m[2]), to: square(m[3], m[4]) };
}
export function boardFen(board: Board, turn: Side): string {
  const kinds = { k: 'k', a: 'a', e: 'b', h: 'n', r: 'r', c: 'c', p: 'p' };
  const rows: string[] = [];
  for (let row = 0; row < 10; row++) {
    let text = '',
      empty = 0;
    for (let col = 0; col < 9; col++) {
      const p = board[row * 9 + col];
      if (!p) {
        empty++;
        continue;
      }
      if (empty) text += empty;
      empty = 0;
      text += p.side === 'red' ? kinds[p.kind].toUpperCase() : kinds[p.kind];
    }
    rows.push(text + (empty || ''));
  }
  return `${rows.join('/')} ${turn === 'red' ? 'w' : 'b'} - - 0 1`;
}
export function historyPosition(
  room: Room,
  index = room.history.length,
): string {
  const moves = room.history
    .slice(0, index)
    .map((m) => squareToEngine(m.from) + squareToEngine(m.to));
  return (
    'position startpos' + (moves.length ? ' moves ' + moves.join(' ') : '')
  );
}
export type EngineInfo = {
  depth: number;
  cp?: number;
  mate?: number;
  pv: string[];
};
export function parseEngineInfo(line: string, turn: Side): EngineInfo | null {
  if (!line.startsWith('info ') || /\b(?:lowerbound|upperbound)\b/.test(line))
    return null;
  const score = /\bscore (cp|mate) (-?\d+)/.exec(line);
  const depth = /\bdepth (\d+)/.exec(line);
  const pv = /\bpv (.+)/.exec(line);
  if (!score || !depth || !pv || /\bmultipv ([2-9]|\d{2,})\b/.test(line))
    return null;
  const value = Number(score[2]) * (turn === 'red' ? 1 : -1);
  return {
    depth: Number(depth[1]),
    [score[1]]: value,
    pv: pv[1].trim().split(/\s+/),
  };
}
export function describeLine(
  board: Board,
  turn: Side,
  moves: string[],
  limit = 5,
  style: NotationStyle = 'chinese',
): string[] {
  const result: string[] = [];
  for (const token of moves.slice(0, limit)) {
    const move = engineMove(token);
    if (!move || !legalMove(board, move.from, move.to, turn)) break;
    result.push(moveText(board, move.from, move.to, style));
    board = moveBoard(board, move.from, move.to);
    turn = opposite(turn);
  }
  return result;
}
export function evaluationLabel(
  info: EngineInfo | null,
  locale: Locale = 'zh',
): string {
  if (!info) return t(locale, 'eval.waiting');
  if (info.mate !== undefined)
    return t(
      locale,
      info.mate > 0
        ? 'eval.redMate'
        : info.mate < 0
          ? 'eval.blackMate'
          : 'eval.ended',
    );
  const cp = info.cp ?? 0;
  if (Math.abs(cp) < 50) return t(locale, 'eval.even');
  return t(locale, Math.abs(cp) < 200 ? 'eval.slight' : 'eval.clear', {
    side: sideName(locale, cp > 0 ? 'red' : 'black'),
  });
}
