import { applyAction, expireClock, newRoom, type Room } from './game';
import {
  AI_LEVELS,
  boardFen,
  engineMove,
  squareToEngine,
  type AiLevel,
} from './ai-game';
import { AppError } from './errors';
import { playerName, sideName, t, type Locale } from './i18n';
import { REASON } from './tokens';
import { opposite, type Result, type Side } from './xiangqi';

export const ARCHIVE_LIMIT = 200;
// Characters of serialized JSON. The 60-move rule caps a game near 3,700 plies,
// about 27,000 characters, so every legal game fits.
export const ARCHIVE_MAX_LENGTH = 32768;
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
  players: { red: { name: string } | null; black: { name: string } | null };
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
  if (!room.result || !room.players.red || !room.players.black)
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
    if (!move) throw new AppError('archive-invalid');
    applyAction(room, room.turn, { action: 'move', ...move }, now);
  }
  if (!room.result) {
    if (game.result.reason === REASON.agreed) {
      applyAction(room, 'red', { action: 'offer-draw' }, now);
      applyAction(room, 'black', { action: 'respond', accept: true }, now);
    } else if (game.result.reason === REASON.timeout) {
      room.clockMinutes = 1;
      room.clocks[room.turn] = 0;
      expireClock(room, now);
    } else if (
      game.result.reason === REASON.resigned.red ||
      game.result.reason === REASON.resigned.black
    ) {
      applyAction(
        room,
        game.result.reason === REASON.resigned.red ? 'red' : 'black',
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
    throw new AppError('archive-mismatch');
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
/** Signed in, 最近对局 lists both copies. Only local games inside the newest 200 are
 * sent up: the server keeps 200 per account and would drop older ones again. */
export function syncArchives(
  local: ArchivedGame[],
  server: ArchivedGame[],
): { games: ArchivedGame[]; upload: ArchivedGame[] } {
  const games = newestGames([...server, ...local]);
  const stored = new Set(server.map((game) => game.id));
  return {
    games,
    upload: games.filter(
      (game) =>
        !stored.has(game.id) &&
        serializeArchive(game).length <= ARCHIVE_MAX_LENGTH,
    ),
  };
}
export function archiveLabel(
  game: ArchivedGame,
  locale: Locale = 'zh',
): {
  opponent: string;
  result: string;
} {
  const name = (side: Side) => playerName(locale, game.players[side]);
  return {
    opponent: game.viewerSide
      ? name(opposite(game.viewerSide))
      : `${name('red')} / ${name('black')}`,
    result:
      game.result.winner === 'draw'
        ? t(locale, 'result.draw')
        : game.viewerSide
          ? t(
              locale,
              game.result.winner === game.viewerSide
                ? 'result.won'
                : 'result.lost',
            )
          : t(locale, 'result.sideWon', {
              side: sideName(locale, game.result.winner),
            }),
  };
}
