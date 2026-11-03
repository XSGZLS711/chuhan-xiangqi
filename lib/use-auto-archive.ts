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
): string {
  const queued = useRef(new Set<string>());
  const [error, setError] = useState('');
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
      .then(() => setError(''))
      .catch(() => {
        queued.current.delete(key);
        setError('这盘棋暂未保存：浏览器的本地存储不可用或空间已满。');
      });
    // Signed in, the account keeps a copy too. The lobby resends any that failed.
    if (signedIn) void uploadGame(game).catch(() => {});
  }, [room, id, mode, viewerSide, signedIn]);
  return room?.result && id ? error : '';
}
