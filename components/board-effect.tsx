import type { CSSProperties } from 'react';
import { effectDuration, type BoardEffect as Effect } from '@/lib/presentation';

// Fixed, hand-spread values keep the markup identical on server and client.
const EMBERS = Array.from({ length: 16 }, (_, i) => ({
  x: (i * 37 + 11) % 100,
  size: 3 + ((i * 5) % 4),
  delay: (i % 8) * 90,
  rise: 36 + ((i * 13) % 34),
  drift: ((i * 29) % 40) - 20,
}));
const vars = (v: Record<string, string | number>) => v as CSSProperties;

export default function BoardEffect({ effect }: { effect: Effect | null }) {
  if (!effect) return null;
  const check = effect.kind === 'check';
  return (
    <output
      key={effect.id}
      className={`board-effect effect-${effect.kind} ${effect.side ?? ''}`}
      style={vars({ '--fx': `${effectDuration(effect.kind)}ms` })}
      aria-live="polite"
    >
      <div className="effect-veil" aria-hidden="true" />
      {check ? (
        <div className="effect-slash" aria-hidden="true">
          <i />
          <i />
        </div>
      ) : (
        <>
          <div className="effect-rings" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="effect-embers" aria-hidden="true">
            {EMBERS.map((e, i) => (
              <i
                key={i}
                style={vars({
                  '--x': `${e.x}%`,
                  '--s': `${e.size}px`,
                  '--d': `${e.delay}ms`,
                  '--rise': `${e.rise}%`,
                  '--drift': `${e.drift}px`,
                })}
              />
            ))}
          </div>
        </>
      )}
      <div className="effect-inscription">
        <span className="effect-overline">
          {effect.analysis ? '独立推演' : check ? '楚河汉界' : '胜负已定'}
        </span>
        <strong aria-label={effect.title}>
          {Array.from(effect.title).map((char, i) => (
            <span key={i} aria-hidden="true" style={vars({ '--i': i })}>
              {char}
            </span>
          ))}
        </strong>
        <span className="effect-detail">{effect.detail}</span>
        {!check && (
          <span className="effect-seal" aria-hidden="true">
            <b>楚</b>
            <b>汉</b>
          </span>
        )}
      </div>
    </output>
  );
}
