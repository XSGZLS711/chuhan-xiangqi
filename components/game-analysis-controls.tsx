import { errorText } from '@/lib/errors';
import type { useGameAnalysis } from '@/lib/use-game-analysis';
import { useLocale } from '@/lib/use-locale';

export default function GameAnalysisControls({
  analysis,
}: {
  analysis: ReturnType<typeof useGameAnalysis>;
}) {
  const { locale, t, tn } = useLocale();
  const total = analysis.analysis?.moves.length ?? 0;
  const done =
    analysis.analysis?.moves.filter((entry) => entry.status === 'complete')
      .length ?? 0;
  const loading = analysis.status === 'loading';
  return (
    <section className="whole-game-analysis" aria-label={t('analysis.title')}>
      <div>
        <strong>{t('analysis.title')}</strong>
        {analysis.busy ? (
          <button
            onClick={analysis.cancel}
            disabled={analysis.status === 'cancelling'}
          >
            {t(
              analysis.status === 'cancelling'
                ? 'analysis.stopping'
                : 'analysis.cancel',
            )}
          </button>
        ) : (
          <button
            onClick={analysis.start}
            disabled={loading || !analysis.enabled || !total || done === total}
          >
            {t(
              loading
                ? 'analysis.loadingCache'
                : done === total && total
                  ? 'analysis.done'
                  : done
                    ? 'analysis.continue'
                    : 'analysis.start',
            )}
          </button>
        )}
      </div>
      <progress
        max={Math.max(1, total)}
        value={done}
        aria-label={t('analysis.progress.label')}
      />
      <output aria-live="polite">
        {loading
          ? t('analysis.readingCache')
          : !total
            ? t('analysis.noMoves')
            : tn('analysis.progress', total, {
                prefix:
                  analysis.status === 'cancelled'
                    ? t('analysis.cancelled')
                    : analysis.busy
                      ? t('analysis.running')
                      : '',
                done,
                total,
              })}
      </output>
      {analysis.error && (
        <p role="alert">{errorText(locale, analysis.error)}</p>
      )}
      {analysis.cacheMessage && (
        <p>
          {t(
            analysis.cacheMessage === 'read-failed'
              ? 'analysis.cache.read'
              : 'analysis.cache.write',
          )}
        </p>
      )}
      <small>{t('analysis.note')}</small>
    </section>
  );
}
