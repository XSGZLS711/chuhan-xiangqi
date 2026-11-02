import { applyAction, expireClock, newRoom, type Room } from './game';
import {
  AI_LEVELS,
  boardFen,
  engineMove,
  squareToEngine,
  type AiLevel,
} from './ai-game';
import { opposite, sideLabel, type Result, type Side } from './xiangqi';

export const ARCHIVE_LIMIT = 200;
export type ArchiveMode = { kind: 'friend' } | { kind: 'ai'; level: AiLevel };
export type ArchivedGame = {
  version: 1;
  id: string;
  round: number;
  date: string;
  mode: ArchiveMode;
  viewerSide: Side | null;
  players: { red: string; black: string };
  moves: string[];
  result: Result;
  finalFen: string;
};
export type ArchiveSource = Pick<
  Room,
  'board' | 'turn' | 'round' | 'history' | 'result'
> & {
  players: { red: { name: string }; black: { name: string } | null };
};
export type ArchiveOptions = {
  id: string;
  date: string;
  mode: ArchiveMode;
  viewerSide: Side | null;
};

/** Compact record, with no cookies, seat credentials or redundant board snapshots. */
export function archiveGame(
  room: ArchiveSource,
  options: ArchiveOptions,
): ArchivedGame {
  if (!room.result || !room.players.black)
    throw new Error('只能保存已结束的完整对局');
  return {
    version: 1,
    ...options,
    round: room.round,
    players: { red: room.players.red.name, black: room.players.black.name },
    moves: room.history.map(
      (move) => squareToEngine(move.from) + squareToEngine(move.to),
    ),
    result: { ...room.result },
    finalFen: boardFen(room.board, room.turn),
  };
}
export function serializeArchive(game: ArchivedGame): string {
  return JSON.stringify(game);
}
export function parseArchive(value: unknown): ArchivedGame | null {
  if (!value || typeof value !== 'object') return null;
  const game = value as Partial<ArchivedGame>;
  if (
    game.version !== 1 ||
    typeof game.id !== 'string' ||
    !game.id ||
    game.id.length > 200 ||
    !Number.isInteger(game.round) ||
    game.round! < 1 ||
    typeof game.date !== 'string' ||
    !Number.isFinite(Date.parse(game.date)) ||
    (game.viewerSide !== 'red' &&
      game.viewerSide !== 'black' &&
      game.viewerSide !== null) ||
    typeof game.players?.red !== 'string' ||
    typeof game.players?.black !== 'string' ||
    !Array.isArray(game.moves) ||
    game.moves.length > 10000 ||
    !game.moves.every((move) => typeof move === 'string' && engineMove(move)) ||
    !['red', 'black', 'draw'].includes(game.result?.winner ?? '') ||
    typeof game.result?.reason !== 'string' ||
    !game.result.reason ||
    typeof game.finalFen !== 'string' ||
    game.finalFen.length > 150 ||
    (game.mode?.kind !== 'friend' &&
      (game.mode?.kind !== 'ai' || !Object.hasOwn(AI_LEVELS, game.mode.level)))
  )
    return null;
  return {
    version: 1,
    id: game.id,
    round: game.round!,
    date: game.date,
    mode:
      game.mode.kind === 'ai'
        ? { kind: 'ai', level: game.mode.level }
        : { kind: 'friend' },
    viewerSide: game.viewerSide,
    players: { red: game.players.red, black: game.players.black },
    moves: [...game.moves],
    result: { ...game.result } as Result,
    finalFen: game.finalFen,
  };
}
export function deserializeArchive(raw: string): ArchivedGame | null {
  try {
    return parseArchive(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Rebuild the existing review model through the same rules used by live games. */
export function replayArchive(game: ArchivedGame): Room {
  const now = Date.parse(game.date);
  const room = newRoom(game.id, { id: 'red', name: game.players.red }, 0, now);
  applyAction(room, 'black', { action: 'join', name: game.players.black }, now);
  room.round = game.round;
  for (const token of game.moves) {
    const move = engineMove(token);
    if (!move) throw new Error('存档中有无效着法');
    applyAction(room, room.turn, { action: 'move', ...move }, now);
  }
  if (!room.result) {
    if (game.result.reason === '双方同意和棋') {
      applyAction(room, 'red', { action: 'offer-draw' }, now);
      applyAction(room, 'black', { action: 'respond', accept: true }, now);
    } else if (game.result.reason === '超时') {
      room.clockMinutes = 1;
      room.clocks[room.turn] = 0;
      expireClock(room, now);
    } else if (
      game.result.reason === '红方认输' ||
      game.result.reason === '黑方认输'
    ) {
      applyAction(
        room,
        game.result.reason.startsWith('红') ? 'red' : 'black',
        { action: 'resign' },
        now,
      );
    }
  }
  if (
    room.result?.winner !== game.result.winner ||
    room.result?.reason !== game.result.reason ||
    boardFen(room.board, room.turn) !== game.finalFen
  )
    throw new Error('存档的棋谱与终局不一致');
  return room;
}

/** Stable ids make repeated polls and saves replace one entry, never duplicate it. */
export function newestGames(games: ArchivedGame[]): ArchivedGame[] {
  const unique = new Map<string, ArchivedGame>();
  for (const game of [...games].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date),
  ))
    if (!unique.has(game.id)) unique.set(game.id, game);
  return [...unique.values()].slice(0, ARCHIVE_LIMIT);
}
export function mergeGame(
  games: ArchivedGame[],
  game: ArchivedGame,
): ArchivedGame[] {
  const existing = games.find((entry) => entry.id === game.id);
  return newestGames([
    { ...game, date: existing?.date ?? game.date },
    ...games.filter((entry) => entry.id !== game.id),
  ]);
}
export function archiveLabel(game: ArchivedGame): {
  opponent: string;
  result: string;
} {
  return {
    opponent: game.viewerSide
      ? game.players[opposite(game.viewerSide)]
      : `${game.players.red} / ${game.players.black}`,
    result:
      game.result.winner === 'draw'
        ? '和棋'
        : game.viewerSide
          ? game.result.winner === game.viewerSide
            ? '胜'
            : '负'
          : sideLabel(game.result.winner) + '胜',
  };
}
