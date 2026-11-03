import { useEffect, useRef, useState } from 'react';
import { archiveGame, type ArchiveMode, type ArchiveSource } from './archive';
import { gameArchive } from './archive-storage';
import { uploadGame } from './client-api';
import type { Side } from './xiangqi';

export function useAutoArchive(
  room: ArchiveSource | null,
  id: string | null,
  mode: ArchiveMode,
  viewerSide: Side | null,
  signedIn: boolean,
): boolean {
  const queued = useRef(new Set<string>());
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!room?.result || !room.players.black || !id) return;
    const key = JSON.stringify([
      id,
      room.history.map((move) => [move.from, move.to]),
      room.result,
    ]);
    if (queued.current.has(key)) return;
    queued.current.add(key);
    const game = archiveGame(room, {
      id,
      mode,
      viewerSide,
      date: new Date().toISOString(),
    });
    void gameArchive()
      .save(game)
      .then(() => setError(false))
      .catch(() => {
        queued.current.delete(key);
        setError(true);
      });
    // Signed in, the account keeps a copy too. The lobby resends any that failed.
    if (signedIn) void uploadGame(game).catch(() => {});
  }, [room, id, mode, viewerSide, signedIn]);
  // True when this game could not be saved here; the page shows `archive.saveFailed`.
  return !!room?.result && !!id && error;
}
