'use client';
import { useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { ratingLabel, type GameAnalysis } from '@/lib/game-analysis';
import { historyMoveText } from '@/lib/notation';
import { useLocale } from '@/lib/use-locale';
import type { Move } from '@/lib/xiangqi';

export default function GameRecord({
  history,
  index,
  onNavigate,
  onLive,
  analysis = null,
  ratedPly = null,
  onRatingSelect,
}: {
  history: Move[];
  index: number;
  onNavigate: (index: number) => void;
  onLive: () => void;
  analysis?: GameAnalysis | null;
  ratedPly?: number | null;
  onRatingSelect?: (ply: number) => void;
}) {
  const { locale, t, notation } = useLocale();
  const list = useRef<HTMLDivElement>(null);
  const shown = useRef(0);
  // Keep the move being viewed (or the newest one) inside the scrolling list.
  useEffect(() => {
    const el = list.current;
    const current =
      el?.querySelector<HTMLElement>('.selected-rating') ??
      el?.querySelector<HTMLElement>('.current-move');
    if (!el || !current) return;
    const rect = current.getBoundingClientRect();
    const margin = 10,
      top = rect.top - el.getBoundingClientRect().top + el.scrollTop,
      bottom = top + rect.height;
    const behavior = shown.current ? 'smooth' : 'auto';
    shown.current = history.length;
    if (top < el.scrollTop + margin)
      el.scrollTo({ top: Math.max(0, top - margin), behavior });
    else if (bottom > el.scrollTop + el.clientHeight - margin)
      el.scrollTo({ top: bottom - el.clientHeight + margin, behavior });
  }, [index, history.length, ratedPly]);
  const rows = Array.from(
    { length: Math.ceil(history.length / 2) },
    (_, n) => n,
  );
  return (
    <div className="game-record">
      {history.length ? (
        <>
          <div className="record-header">
            <span>{t('record.header.turn')}</span>
            <span>{t('record.header.red')}</span>
            <span>{t('record.header.black')}</span>
          </div>
          <div className="move-list" ref={list}>
            {rows.map((n) => (
              <div className="move-row" key={n}>
                <span>{String(n + 1).padStart(2, '0')}</span>
                {[0, 1].map((offset) => {
                  const step = n * 2 + offset,
                    move = history[step];
                  const entry = analysis?.moves[step];
                  const rating =
                    entry?.status === 'complete' ? entry.analysis.rating : null;
                  return move ? (
                    <div key={offset} className="record-move-cell">
                      <button
                        className={`${move.side} ${index === step + 1 ? 'current-move' : ''}`}
                        onClick={() => onNavigate(step + 1)}
                      >
                        {historyMoveText(move, notation)}
                        {move.check && <small>{t('record.check')}</small>}
                      </button>
                      {rating && onRatingSelect && (
                        <button
                          className={`move-rating rating-${rating} ${ratedPly === step + 1 ? 'selected-rating' : ''}`}
                          aria-label={t('record.rated', {
                            n: step + 1,
                            rating: ratingLabel(locale, rating),
                          })}
                          aria-pressed={ratedPly === step + 1}
                          onClick={() => onRatingSelect(step + 1)}
                        >
                          {ratingLabel(locale, rating)}
                        </button>
                      )}
                    </div>
                  ) : (
                    <span key={offset}>—</span>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="empty-record">
          <p>{t('record.empty')}</p>
        </div>
      )}
      <div className="replay-nav">
        <button
          aria-label={t('record.nav.start')}
          disabled={!history.length}
          onClick={() => onNavigate(0)}
        >
          <ChevronsLeft size={18} />
        </button>
        <button
          aria-label={t('record.nav.prev')}
          disabled={!index}
          onClick={() => onNavigate(index - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {index} / {history.length}
        </span>
        <button
          aria-label={t('record.nav.next')}
          disabled={index >= history.length}
          onClick={() => onNavigate(index + 1)}
        >
          <ChevronRight size={18} />
        </button>
        <button
          aria-label={t('record.nav.latest')}
          disabled={!history.length}
          onClick={onLive}
        >
          <ChevronsRight size={18} />
        </button>
      </div>
    </div>
  );
}
