'use client';
/* oxlint-disable next/no-html-link-for-pages -- The AI entry is a separate document with its own browser isolation. */
import { useState } from 'react';
import ChessBoard from './chess-board';
import RecentGames from './recent-games';
import SiteLinks from './site-links';
import { initialBoard, legalMove, legalTargets } from '@/lib/xiangqi';
import { useLocale } from '@/lib/use-locale';
import { ArrowRight } from 'lucide-react';

/** The lobby leads with a real board in the opening position: red can pick up a piece
 * right here, and the first move opens the analysis board with it played. */
export default function GameLobby({
  signedIn,
  friendDisabled,
  onCreate,
  onExplore,
  onFirstMove,
}: {
  signedIn: boolean;
  friendDisabled: boolean;
  onCreate: () => void;
  onExplore: () => void;
  onFirstMove: (from: number, to: number) => void;
}) {
  const { t } = useLocale();
  const [board] = useState(initialBoard);
  const [selected, setSelected] = useState<number | null>(null);
  function square(n: number) {
    if (selected !== null && legalMove(board, selected, n, 'red'))
      onFirstMove(selected, n);
    else setSelected(board[n]?.side === 'red' && n !== selected ? n : null);
  }
  return (
    <section className="game-lobby" aria-labelledby="lobby-title">
      <div className="lobby-intro">
        <h1 id="lobby-title">{t('lobby.title')}</h1>
        <p>{t('lobby.lead')}</p>
      </div>
      <div className="lobby-choices">
        <button
          className="lobby-mode lobby-mode-friend"
          disabled={friendDisabled}
          onClick={onCreate}
        >
          <span>{t('lobby.friend')}</span>
          <ArrowRight size={22} aria-hidden="true" />
        </button>
        <a className="lobby-mode lobby-mode-ai" href="./ai/">
          <span>{t('lobby.ai')}</span>
          <ArrowRight size={22} aria-hidden="true" />
        </a>
        <button className="lobby-explore" onClick={() => onExplore()}>
          {t('lobby.explore')} <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="lobby-board">
        <ChessBoard
          board={board}
          selected={selected}
          targets={selected === null ? [] : legalTargets(board, selected)}
          onSquare={square}
          animationContext="lobby"
          animate={false}
        />
      </div>
      <RecentGames signedIn={signedIn} />
      <SiteLinks />
    </section>
  );
}
