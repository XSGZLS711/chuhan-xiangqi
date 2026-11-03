import {
  ARCHIVE_LIMIT,
  parseArchive,
  syncArchives,
  type ArchivedGame,
} from './archive';
import { getArchivedGame } from './archive-storage';
import { fetchAccountGame, fetchAccountGames, uploadGame } from './client-api';

const valid = (values: unknown[]) =>
  values.flatMap((value) => {
    const game = parseArchive(value);
    return game ? [game] : [];
  });

/** Every game the account keeps, newest first; the server holds 200 at most. */
async function accountGames(): Promise<ArchivedGame[]> {
  const games: ArchivedGame[] = [];
  let before: string | null = null;
  do {
    const page = await fetchAccountGames(before ?? undefined);
    games.push(...valid(page.games));
    before = page.games.length ? page.next : null;
  } while (before && games.length < ARCHIVE_LIMIT);
  return games;
}

/** Signed in, 最近对局 shows this browser's games with the account's. Local games the
 * account lacks go up in the background, one at a time; any that fail go next visit. */
export async function syncAccountArchive(
  local: ArchivedGame[],
): Promise<ArchivedGame[]> {
  const { games, upload } = syncArchives(local, await accountGames());
  void (async () => {
    for (const game of upload) await uploadGame(game);
  })().catch(() => {});
  return games;
}

/** A game from 最近对局: this browser's copy, otherwise the account's. */
export async function findArchivedGame(id: string): Promise<ArchivedGame> {
  try {
    return await getArchivedGame(id);
  } catch (error) {
    const game = parseArchive(await fetchAccountGame(id).catch(() => null));
    if (game?.id === id) return game;
    throw error;
  }
}
