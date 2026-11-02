import {
  mergeGame,
  newestGames,
  parseArchive,
  type ArchivedGame,
} from './archive';

export interface ArchiveBackend {
  list(): Promise<ArchivedGame[]>;
  save(game: ArchivedGame): Promise<void>;
}
const STORAGE_KEY = 'chuhan-archive';
const entries = (raw: unknown): ArchivedGame[] =>
  Array.isArray(raw)
    ? raw.flatMap((value) => {
        const game = parseArchive(value);
        return game ? [game] : [];
      })
    : [];
export function localArchiveBackend(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
): ArchiveBackend {
  function list() {
    if (!storage) throw new Error('本地存储不可用');
    try {
      return newestGames(
        entries(JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]')),
      );
    } catch (error) {
      if (error instanceof SyntaxError) return [];
      throw error;
    }
  }
  return {
    async list() {
      return list();
    },
    async save(game) {
      if (!storage) throw new Error('本地存储不可用');
      storage.setItem(STORAGE_KEY, JSON.stringify(mergeGame(list(), game)));
    },
  };
}

function indexedArchiveBackend(): ArchiveBackend {
  let connection: Promise<IDBDatabase> | null = null;
  function open(): Promise<IDBDatabase> {
    if (connection) return connection;
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('chuhan-archive', 1);
      let abandoned = false;
      const fail = (error: unknown) => {
        abandoned = true;
        clearTimeout(timer);
        reject(error);
      };
      const timer = setTimeout(
        () => fail(new Error('存档数据库打开超时')),
        2000,
      );
      request.onupgradeneeded = () =>
        request.result.createObjectStore('games', { keyPath: 'id' });
      request.onerror = () => {
        fail(request.error);
      };
      request.onblocked = () => {
        fail(new Error('存档数据库被占用'));
      };
      request.onsuccess = () => {
        clearTimeout(timer);
        if (abandoned) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => {
          request.result.close();
          connection = null;
        };
        resolve(request.result);
      };
    }).catch((error: unknown) => {
      connection = null;
      throw error;
    });
    return connection;
  }
  return {
    async list() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('games', 'readonly');
        const request = tx.objectStore('games').getAll();
        tx.oncomplete = () => resolve(newestGames(entries(request.result)));
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
    async save(game) {
      const db = await open();
      return new Promise((resolve, reject) => {
        // Read, upsert and prune in one transaction, including concurrent tabs.
        const tx = db.transaction('games', 'readwrite');
        const store = tx.objectStore('games');
        const request = store.getAll();
        request.onsuccess = () => {
          const kept = mergeGame(entries(request.result), game);
          const ids = new Set(kept.map((entry) => entry.id));
          for (const entry of entries(request.result))
            if (!ids.has(entry.id)) store.delete(entry.id);
          for (const entry of kept) store.put(entry);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
  };
}
export function createArchiveStore(
  primary: ArchiveBackend,
  fallback: ArchiveBackend,
): ArchiveBackend {
  return {
    async list() {
      const [one, two] = await Promise.allSettled([
        primary.list(),
        fallback.list(),
      ]);
      if (one.status === 'rejected' && two.status === 'rejected')
        throw new Error('当前浏览器无法读取本地对局');
      return newestGames([
        ...(one.status === 'fulfilled' ? one.value : []),
        ...(two.status === 'fulfilled' ? two.value : []),
      ]);
    },
    async save(game) {
      try {
        await primary.save(game);
      } catch {
        await fallback.save(game);
      }
    },
  };
}
let store: ArchiveBackend | null = null;
export function gameArchive(): ArchiveBackend {
  if (!store) {
    let storage: Storage | null = null;
    try {
      storage = localStorage;
    } catch {}
    store = createArchiveStore(
      indexedArchiveBackend(),
      localArchiveBackend(storage),
    );
  }
  return store;
}
export async function getArchivedGame(id: string): Promise<ArchivedGame> {
  const game = (await gameArchive().list()).find((entry) => entry.id === id);
  if (!game)
    throw new Error('找不到这盘本地对局，可能已被清理或保存在另一台设备上。');
  return game;
}
