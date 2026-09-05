'use client';
import { useEffect, useState, type CSSProperties } from 'react';

/** Follow the visible viewport, including mobile address bars and the keyboard. */
export function useGameViewport(active: boolean): CSSProperties | undefined {
  const [viewport, setViewport] = useState<CSSProperties>();
  useEffect(() => {
    if (!active) return;
    const visible = window.visualViewport;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setViewport({
          '--game-height': `${visible?.height ?? window.innerHeight}px`,
          '--game-top': `${visible?.offsetTop ?? 0}px`,
        } as CSSProperties),
      );
    };
    measure();
    visible?.addEventListener('resize', measure);
    visible?.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(frame);
      visible?.removeEventListener('resize', measure);
      visible?.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [active]);
  return active ? viewport : undefined;
}
