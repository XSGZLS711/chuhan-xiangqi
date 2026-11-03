'use client';
/* oxlint-disable next/no-html-link-for-pages -- The AI entry is a separate document with its own browser isolation. */
import RecentGames from './recent-games';
import { useLocale } from '@/lib/use-locale';
import { ArrowRight, Bot, GitBranch, Users } from 'lucide-react';

export default function GameLobby({
  signedIn,
  friendDisabled,
  onCreate,
  onExplore,
}: {
  signedIn: boolean;
  friendDisabled: boolean;
  onCreate: () => void;
  onExplore: () => void;
}) {
  const { t } = useLocale();
  return (
    <section className="game-lobby" aria-labelledby="lobby-title">
      <div className="lobby-welcome">
        <div className="lobby-art" aria-hidden="true">
          <div className="lobby-grid" />
          <span className="lobby-river">
            <span>楚 河</span>
            <span>汉 界</span>
          </span>
          <span className="lobby-piece lobby-piece-back">馬</span>
          <span className="lobby-piece lobby-piece-black">将</span>
          <span className="lobby-piece lobby-piece-red">帅</span>
        </div>
        <div className="lobby-intro">
          <h1 id="lobby-title">{t('lobby.title')}</h1>
        </div>
      </div>
      <div className="lobby-choices">
        <button
          className="lobby-mode lobby-mode-friend"
          disabled={friendDisabled}
          onClick={onCreate}
        >
          <span className="lobby-mode-icon">
            <Users size={25} />
          </span>
          <span className="lobby-mode-copy">
            <strong>{t('lobby.friend')}</strong>
          </span>
          <ArrowRight size={21} />
        </button>
        <a className="lobby-mode lobby-mode-ai" href="./ai/">
          <span className="lobby-mode-icon">
            <Bot size={25} />
          </span>
          <span className="lobby-mode-copy">
            <strong>{t('lobby.ai')}</strong>
          </span>
          <ArrowRight size={21} />
        </a>
        <button className="lobby-explore" onClick={onExplore}>
          <GitBranch size={16} /> {t('lobby.explore')}
        </button>
      </div>
      <RecentGames signedIn={signedIn} />
    </section>
  );
}
