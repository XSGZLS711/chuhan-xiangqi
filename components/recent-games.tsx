/* oxlint-disable next/no-html-link-for-pages -- Archive review opens the isolated AI document. */
import { useEffect, useState } from 'react';
import { History, ChevronRight } from 'lucide-react';
import { archiveLabel, type ArchivedGame } from '@/lib/archive';
import { gameArchive } from '@/lib/archive-storage';

export default function RecentGames() {
  const [games, setGames] = useState<ArchivedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void gameArchive()
      .list()
      .then((games) => {
        if (active) setGames(games);
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
  return (
    <details className="recent-games">
      <summary>
        <History size={18} /> 最近对局 <span>{games.length || ''}</span>
      </summary>
      <p>仅保存在当前浏览器，最多保留最近 200 局。</p>
      {loading ? (
        <p>正在读取…</p>
      ) : error ? (
        <p role="alert">{error}</p>
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
      ) : (
        <p>还没有已结束的对局，下完一盘后会自动保存在这里。</p>
      )}
    </details>
  );
}
