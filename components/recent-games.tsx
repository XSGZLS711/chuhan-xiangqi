/* oxlint-disable next/no-html-link-for-pages -- Archive review opens the isolated AI document. */
import { useEffect, useState } from 'react';
import { History, ChevronRight } from 'lucide-react';
import { archiveLabel, type ArchivedGame } from '@/lib/archive';
import { gameArchive } from '@/lib/archive-storage';
import { syncAccountArchive } from '@/lib/archive-sync';

export default function RecentGames({ signedIn }: { signedIn: boolean }) {
  const [local, setLocal] = useState<ArchivedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Signed in: this browser's games merged with the account's.
  const [synced, setSynced] = useState<ArchivedGame[] | null>(null);
  const [syncError, setSyncError] = useState('');
  const games = (signedIn && synced) || local;
  useEffect(() => {
    let active = true;
    void gameArchive()
      .list()
      .then((games) => {
        if (active) setLocal(games);
      })
      .catch(() => {
        if (active) setError('当前浏览器无法读取本地对局。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!signedIn || loading) return;
    let active = true;
    void syncAccountArchive(local)
      .then((games) => {
        if (!active) return;
        setSynced(games);
        setSyncError('');
      })
      .catch(() => {
        if (active) setSyncError('暂时读不到账号里的对局，先显示本机保存的。');
      });
    return () => {
      active = false;
    };
  }, [signedIn, loading, local]);
  return (
    <details className="recent-games">
      <summary>
        <History size={18} /> 最近对局 <span>{games.length || ''}</span>
      </summary>
      <p>
        {signedIn
          ? '同步到你的账号，换台设备登录也能看到，最多保留最近 200 局。'
          : '仅保存在当前浏览器，最多保留最近 200 局。'}
      </p>
      {!loading && (error || syncError) && (
        <p role="alert">{error || syncError}</p>
      )}
      {loading ? (
        <p>正在读取…</p>
      ) : games.length ? (
        <ul>
          {games.map((game) => {
            const label = archiveLabel(game);
            return (
              <li key={game.id}>
                <a href={`./ai/?game=${encodeURIComponent(game.id)}`}>
                  <span>
                    <strong>{label.opponent}</strong>
                    <small>
                      {new Date(game.date).toLocaleString('zh-CN')} ·{' '}
                      {game.mode.kind === 'ai' ? '人机' : '好友'} ·{' '}
                      {game.moves.length} 步
                    </small>
                  </span>
                  <span className="archive-result" title={game.result.reason}>
                    {label.result}
                  </span>
                  <ChevronRight size={17} />
                </a>
              </li>
            );
          })}
        </ul>
      ) : error ? null : (
        <p>还没有已结束的对局，下完一盘后会自动保存在这里。</p>
      )}
    </details>
  );
}
