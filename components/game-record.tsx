'use client';
import { useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { RATING_LABELS, type GameAnalysis } from '@/lib/game-analysis';
import type { Move } from '@/lib/xiangqi';
import { displayNotation } from '@/lib/mobile-game';

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
            <span>回合</span>
            <span>红方</span>
            <span>黑方</span>
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
                        {displayNotation(move.text)}
                        {move.check && <small>将</small>}
                      </button>
                      {rating && onRatingSelect && (
                        <button
                          className={`move-rating rating-${rating} ${ratedPly === step + 1 ? 'selected-rating' : ''}`}
                          aria-label={`第 ${step + 1} 步，${RATING_LABELS[rating]}，查看走前推荐着`}
                          aria-pressed={ratedPly === step + 1}
                          onClick={() => onRatingSelect(step + 1)}
                        >
                          {RATING_LABELS[rating]}
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
          <p>棋谱从第一步开始记录</p>
        </div>
      )}
      <div className="replay-nav">
        <button
          aria-label="回到开局"
          disabled={!history.length}
          onClick={() => onNavigate(0)}
        >
          <ChevronsLeft size={18} />
        </button>
        <button
          aria-label="上一步"
          disabled={!index}
          onClick={() => onNavigate(index - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span>
          {index} / {history.length}
        </span>
        <button
          aria-label="下一步"
          disabled={index >= history.length}
          onClick={() => onNavigate(index + 1)}
        >
          <ChevronRight size={18} />
        </button>
        <button
          aria-label="回到最新局面"
          disabled={!history.length}
          onClick={onLive}
        >
          <ChevronsRight size={18} />
        </button>
      </div>
    </div>
  );
}
