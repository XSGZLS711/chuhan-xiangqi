import { applyAction, newRoom, type Room } from './game';
import {
  legalMove,
  moveBoard,
  notation,
  opposite,
  type Board,
  type Side,
} from './xiangqi';

export const AI_LEVELS = {
  easy: { label: '入门', skill: -10, depth: 4, time: 250 },
  medium: { label: '进阶', skill: 0, depth: 9, time: 650 },
  hard: { label: '挑战', skill: 20, depth: 16, time: 1500 },
} as const;
export type AiLevel = keyof typeof AI_LEVELS;
export type AiMatch = {
  room: Room;
  human: Side;
  level: AiLevel;
  revision: number;
};

export function createAiMatch(human: Side, level: AiLevel, round = 1): AiMatch {
  const room = newRoom(
    'local-ai',
    { id: 'red', name: human === 'red' ? '我方' : '象棋 AI' },
    0,
    Date.now(),
  );
  applyAction(
    room,
    'black',
    { action: 'join', name: human === 'black' ? '我方' : '象棋 AI' },
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
): string[] {
  const result: string[] = [];
  for (const token of moves.slice(0, limit)) {
    const move = engineMove(token);
    if (!move || !legalMove(board, move.from, move.to, turn)) break;
    result.push(notation(board, move.from, move.to));
    board = moveBoard(board, move.from, move.to);
    turn = opposite(turn);
  }
  return result;
}
export function evaluationLabel(info: EngineInfo | null): string {
  if (!info) return '等待分析';
  if (info.mate !== undefined)
    return info.mate > 0
      ? '红方有杀棋'
      : info.mate < 0
        ? '黑方有杀棋'
        : '已到终局';
  const cp = info.cp ?? 0;
  if (Math.abs(cp) < 50) return '局势均衡';
  return `${cp > 0 ? '红方' : '黑方'}${Math.abs(cp) < 200 ? '略优' : '明显占优'}`;
}
