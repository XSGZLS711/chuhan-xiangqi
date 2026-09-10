'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { nextGameViewport, type GameViewport } from './game-viewport';

/** Address bars resize the board; the keyboard only repositions the overlay. */
export function useGameViewport(active: boolean): CSSProperties | undefined {
  const [viewport, setViewport] = useState<CSSProperties>();
  useEffect(() => {
    if (!active) return;
    const visible = window.visualViewport;
    let frame = 0;
    let layout: GameViewport | undefined;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const height = visible?.height ?? window.innerHeight;
        const top = visible?.offsetTop ?? 0;
        const focused = document.activeElement;
        const editing =
          focused instanceof HTMLElement &&
          (focused.matches('input, textarea') || focused.isContentEditable);
        layout = nextGameViewport(
          layout,
          {
            width: document.documentElement.clientWidth,
            height,
            top,
          },
          editing,
        );
        setViewport({
          '--game-height': `${layout.height}px`,
          '--game-top': `${layout.top}px`,
          '--game-visible-height': `${height}px`,
          '--game-keyboard-inset': `${Math.max(0, window.innerHeight - height - top)}px`,
        } as CSSProperties);
      });
    };
    measure();
    visible?.addEventListener('resize', measure);
    visible?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    document.addEventListener('focusin', measure);
    document.addEventListener('focusout', measure);
    return () => {
      cancelAnimationFrame(frame);
      visible?.removeEventListener('resize', measure);
      visible?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      document.removeEventListener('focusin', measure);
      document.removeEventListener('focusout', measure);
    };
  }, [active]);
  return active ? viewport : undefined;
}
