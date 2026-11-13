'use client';
/* oxlint-disable next/no-html-link-for-pages -- The AI entry is a separate document with its own browser isolation. */
import type { CSSProperties, PointerEvent } from 'react';
import RecentGames from './recent-games';
import SiteLinks from './site-links';
import { useLocale } from '@/lib/use-locale';
import { ArrowRight, BookOpen, Bot, GitBranch, Users } from 'lucide-react';

export default function GameLobby({
  signedIn,
  friendDisabled,
  onCreate,
  onExplore,
  onClassics,
}: {
  signedIn: boolean;
  friendDisabled: boolean;
  onCreate: () => void;
  onExplore: () => void;
  onClassics: () => void;
}) {
  const { t } = useLocale();
  // The art leans towards the pointer, its layers at different depths; a mouse only, so a
  // finger scrolling the page does not tip it.
  const lean = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'mouse') return;
    const box = event.currentTarget.getBoundingClientRect(),
      x = ((event.clientX - box.left) / box.width) * 2 - 1,
      y = ((event.clientY - box.top) / box.height) * 2 - 1,
      style = event.currentTarget.style;
    style.setProperty('--px', x.toFixed(3));
    style.setProperty('--py', y.toFixed(3));
    style.setProperty('--lean', `${(Math.hypot(x, y) * 9).toFixed(2)}deg`);
  };
  const settle = (event: PointerEvent<HTMLElement>) => {
    const style = event.currentTarget.style;
    for (const name of ['--px', '--py', '--lean']) style.removeProperty(name);
  };
  // The cards carry a soft light where the pointer is.
  const light = (event: PointerEvent<HTMLElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty(
      '--mx',
      `${event.clientX - box.left}px`,
    );
    event.currentTarget.style.setProperty(
      '--my',
      `${event.clientY - box.top}px`,
    );
  };
  const title = t('lobby.title');
  return (
    <section className="game-lobby" aria-labelledby="lobby-title">
      <div
        className="lobby-welcome"
        onPointerMove={lean}
        onPointerLeave={settle}
      >
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
          {/* The question is inked in a character at a time; it reads as one line. */}
          <h1 id="lobby-title" aria-label={title}>
            {Array.from(title).map((ch, i) => (
              <span
                key={`${title}:${i}`}
                aria-hidden="true"
                style={{ '--i': i } as CSSProperties}
              >
                {ch}
              </span>
            ))}
          </h1>
        </div>
      </div>
      <div className="lobby-choices">
        <button
          className="lobby-mode lobby-mode-friend"
          disabled={friendDisabled}
          onClick={onCreate}
          onPointerMove={light}
        >
          <span className="lobby-mode-icon">
            <Users size={25} />
          </span>
          <span className="lobby-mode-copy">
            <strong>{t('lobby.friend')}</strong>
          </span>
          <ArrowRight size={21} />
        </button>
        <a
          className="lobby-mode lobby-mode-ai"
          href="./ai/"
          onPointerMove={light}
        >
          <span className="lobby-mode-icon">
            <Bot size={25} />
          </span>
          <span className="lobby-mode-copy">
            <strong>{t('lobby.ai')}</strong>
          </span>
          <ArrowRight size={21} />
        </a>
        <div className="lobby-extras">
          <button className="lobby-explore" onClick={onExplore}>
            <GitBranch size={16} /> {t('lobby.explore')}
          </button>
          <button className="lobby-classics" onClick={onClassics}>
            <BookOpen size={16} /> {t('classics.title')}
          </button>
        </div>
      </div>
      <RecentGames signedIn={signedIn} />
      <SiteLinks />
    </section>
  );
}
