/* oxlint-disable next/no-html-link-for-pages -- Archive review opens the isolated AI document. */
import { useEffect, useState } from 'react';
import { History, ChevronRight } from 'lucide-react';
import { archiveLabel, type ArchivedGame } from '@/lib/archive';
import { gameArchive } from '@/lib/archive-storage';
import { syncAccountArchive } from '@/lib/archive-sync';
import { formatDateTime, reasonText } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';

export default function RecentGames({ signedIn }: { signedIn: boolean }) {
  const { locale, t, tn } = useLocale();
  const [local, setLocal] = useState<ArchivedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Signed in: this browser's games merged with the account's.
  const [synced, setSynced] = useState<ArchivedGame[] | null>(null);
  const [syncError, setSyncError] = useState(false);
  const games = (signedIn && synced) || local;
  useEffect(() => {
    let active = true;
    void gameArchive()
      .list()
      .then((games) => {
        if (active) setLocal(games);
      })
      .catch(() => {
        if (active) setError(true);
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
        setSyncError(false);
      })
      .catch(() => {
        if (active) setSyncError(true);
      });
    return () => {
      active = false;
    };
  }, [signedIn, loading, local]);
  return (
    <details className="recent-games">
      <summary>
        <History size={18} /> {t('recent.title')}{' '}
        <span>{games.length || ''}</span>
      </summary>
      <p>{t(signedIn ? 'recent.synced' : 'recent.local')}</p>
      {!loading && (error || syncError) && (
        <p role="alert">{t(error ? 'recent.readError' : 'recent.syncError')}</p>
      )}
      {loading ? (
        <p>{t('recent.loading')}</p>
      ) : games.length ? (
        <ul>
          {games.map((game) => {
            const label = archiveLabel(game, locale);
            return (
              <li key={game.id}>
                <a href={`./ai/?game=${encodeURIComponent(game.id)}`}>
                  <span>
                    <strong>{label.opponent}</strong>
                    <small>
                      {formatDateTime(locale, game.date)} ·{' '}
                      {t(
                        game.mode.kind === 'ai'
                          ? 'recent.mode.ai'
                          : 'recent.mode.friend',
                      )}{' '}
                      · {tn('recent.moves', game.moves.length)}
                    </small>
                  </span>
                  <span
                    className="archive-result"
                    title={reasonText(locale, game.result.reason)}
                  >
                    {label.result}
                  </span>
                  <ChevronRight size={17} />
                </a>
              </li>
            );
          })}
        </ul>
      ) : error ? null : (
        <p>{t('recent.empty')}</p>
      )}
    </details>
  );
}
