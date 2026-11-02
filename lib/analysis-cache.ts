import { GAME_ANALYSIS_PROFILE } from './analyse-game';
import type { ArchivedGame } from './archive';
import {
  completeMoveAnalysis,
  createGameAnalysis,
  type GameAnalysis,
  type PositionEvaluation,
} from './game-analysis';

export type CachedAnalysis = {
  version: 1;
  gameId: string;
  fingerprint: string;
  profile: string;
  updatedAt: number;
  analysis: GameAnalysis;
};
export interface AnalysisCacheBackend {
  read(gameId: string): Promise<unknown>;
  write(entry: CachedAnalysis): Promise<void>;
}
const fingerprint = (game: ArchivedGame) =>
  JSON.stringify([game.moves, game.finalFen, game.result]);
const completed = (analysis: GameAnalysis) =>
  analysis.moves.filter((entry) => entry?.status === 'complete').length;

/** Recompute labels from validated evaluations; never trust a cached badge string. */
export function restoreAnalysisCache(
  raw: unknown,
  game: ArchivedGame,
): GameAnalysis | null {
  try {
    const entry = raw as CachedAnalysis;
    if (
      !entry ||
      entry.version !== 1 ||
      entry.gameId !== game.id ||
      entry.profile !== GAME_ANALYSIS_PROFILE ||
      entry.fingerprint !== fingerprint(game) ||
      !Number.isFinite(entry.updatedAt)
    )
      return null;
    const stored = entry.analysis;
    let fresh = createGameAnalysis(game.id, game.moves);
    if (
      stored.version !== 1 ||
      stored.gameId !== game.id ||
      stored.model.kind !== 'logistic' ||
      stored.model.calibrated !== false ||
      stored.model.config.cpScale !== fresh.model.config.cpScale ||
      JSON.stringify(stored.model.config.thresholds) !==
        JSON.stringify(fresh.model.config.thresholds) ||
      !Array.isArray(stored.moves) ||
      stored.moves.length !== fresh.moves.length
    )
      return null;
    for (let i = 0; i < stored.moves.length; i++) {
      const move = stored.moves[i],
        expected = fresh.moves[i];
      if (
        move.ply !== expected.ply ||
        move.side !== expected.side ||
        move.move !== expected.move
      )
        return null;
      if (move.status === 'complete') {
        const { before, after, played } = move.analysis;
        if (!played) return null;
        fresh = completeMoveAnalysis(
          fresh,
          i + 1,
          before as PositionEvaluation,
          after as PositionEvaluation,
          played as PositionEvaluation,
        );
      } else if (move.status === 'failed' && typeof move.message === 'string') {
        fresh.moves[i] = {
          ...expected,
          status: 'failed',
          message: move.message.slice(0, 200),
        };
      } else if (move.status !== 'pending') return null;
    }
    return fresh;
  } catch {
    return null;
  }
}
export function createAnalysisCache(backend: AnalysisCacheBackend) {
  return {
    async load(game: ArchivedGame): Promise<GameAnalysis | null> {
      return restoreAnalysisCache(await backend.read(game.id), game);
    },
    async save(game: ArchivedGame, analysis: GameAnalysis): Promise<void> {
      const entry: CachedAnalysis = {
        version: 1,
        gameId: game.id,
        fingerprint: fingerprint(game),
        profile: GAME_ANALYSIS_PROFILE,
        updatedAt: Date.now(),
        analysis,
      };
      const validated = restoreAnalysisCache(entry, game);
      if (!validated) throw new Error('分析结果与对局不匹配，未写入缓存');
      await backend.write({ ...entry, analysis: validated });
    },
  };
}

function indexedAnalysisBackend(): AnalysisCacheBackend {
  let connection: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('chuhan-analysis', 1);
      let abandoned = false;
      const fail = (error: unknown) => {
        abandoned = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(() => fail(new Error('分析缓存打开超时')), 2000);
      request.onupgradeneeded = () =>
        request.result.createObjectStore('analyses', { keyPath: 'gameId' });
      request.onerror = () => fail(request.error);
      request.onblocked = () => fail(new Error('分析缓存被其他页面占用'));
      request.onsuccess = () => {
        clearTimeout(timer);
        const db = request.result;
        if (abandoned) {
          db.close();
          return;
        }
        db.onversionchange = () => {
          db.close();
          connection = null;
        };
        resolve(db);
      };
    }).catch((error: unknown) => {
      connection = null;
      throw error;
    });
    return connection;
  }
  return {
    async read(gameId) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('analyses', 'readonly');
        const request = tx.objectStore('analyses').get(gameId);
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    async write(entry) {
      const db = await open();
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction('analyses', 'readwrite'),
          store = tx.objectStore('analyses');
        const current = store.get(entry.gameId);
        current.onsuccess = () => {
          const old = current.result as CachedAnalysis | undefined;
          // A slower tab must not overwrite a more complete checkpoint.
          if (
            old?.profile === entry.profile &&
            old.fingerprint === entry.fingerprint &&
            Array.isArray(old.analysis?.moves) &&
            completed(old.analysis) > completed(entry.analysis)
          )
            return;
          store.put(entry);
          const all = store.getAll();
          all.onsuccess = () => {
            const ordered = (all.result as CachedAnalysis[]).sort(
              (a, b) => b.updatedAt - a.updatedAt,
            );
            for (const expired of ordered.slice(200))
              store.delete(expired.gameId);
          };
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
  };
}
let cache: ReturnType<typeof createAnalysisCache> | null = null;
export function analysisCache() {
  return (cache ??= createAnalysisCache(indexedAnalysisBackend()));
}
