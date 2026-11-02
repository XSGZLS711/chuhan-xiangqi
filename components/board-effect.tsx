import type { CSSProperties } from 'react';
import {
  STAMP_TIMING,
  stampDuration,
  type BoardEffect as Effect,
} from '@/lib/presentation';

export default function BoardEffect({ effect }: { effect: Effect | null }) {
  if (!effect) return null;
  const duration = stampDuration(effect.kind);
  const title = effect.kind === 'check' ? '将' : effect.title;
  return (
    <output
      key={effect.id}
      className={`board-effect effect-${effect.kind} ${effect.side ?? ''}`}
      style={
        {
          '--stamp-delay': `${STAMP_TIMING.delayMs}ms`,
          '--stamp-enter': `${STAMP_TIMING.enterMs}ms`,
          '--stamp-fade': `${STAMP_TIMING.fadeMs}ms`,
          '--stamp-fade-at': `${STAMP_TIMING.delayMs + duration - STAMP_TIMING.fadeMs}ms`,
        } as CSSProperties
      }
      aria-live="polite"
    >
      <div className="ink-stamp">
        <svg className="ink-ring" viewBox="0 0 300 300" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path
              strokeWidth="12"
              d="M232 61C201 32 141 26 96 48C47 71 29 126 43 179C57 230 104 259 160 253C208 249 250 217 260 171C269 129 256 91 235 71"
            />
            <path
              strokeWidth="3"
              opacity=".65"
              d="M245 74C272 112 272 160 251 200M219 238C168 273 98 260 65 224M34 150C27 104 57 51 104 36"
            />
            <path
              strokeWidth="5"
              opacity=".5"
              d="M71 61C45 89 36 122 44 152M155 258C193 257 224 241 243 214"
            />
          </g>
          <g fill="currentColor" opacity=".8">
            <ellipse
              cx="30"
              cy="74"
              rx="4"
              ry="7"
              transform="rotate(-30 30 74)"
            />
            <circle cx="268" cy="218" r="5" />
            <circle cx="277" cy="229" r="2" />
            <ellipse cx="68" cy="265" rx="6" ry="3" />
            <circle cx="26" cy="196" r="3" />
          </g>
        </svg>
        <span className="ink-stamp-context">
          {effect.analysis ? '独立推演' : ''}
        </span>
        <strong aria-label={effect.title}>{title}</strong>
        <span className="effect-detail">{effect.detail}</span>
      </div>
    </output>
  );
}
