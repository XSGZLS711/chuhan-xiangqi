import type { CSSProperties } from 'react';
import {
  STAMP_TIMING,
  stampDuration,
  type BoardEffect as Effect,
} from '@/lib/presentation';

export default function BoardEffect({
  effect,
  at = null,
}: {
  effect: Effect | null;
  /** Board position for a stamp that belongs to one point, such as a capture. */
  at?: { x: string; y: string } | null;
}) {
  if (!effect) return null;
  const duration = stampDuration(effect.kind);
  const title = effect.kind === 'check' ? '将' : effect.title;
  const tactical = effect.kind === 'capture' || effect.kind === 'check';
  return (
    <output
      key={effect.id}
      className={`board-effect effect-${effect.kind} ${effect.side ?? ''} ${at ? 'at-point' : ''}`}
      style={
        {
          ...(at ? { '--at-x': at.x, '--at-y': at.y } : {}),
          '--stamp-delay': `${STAMP_TIMING.delayMs}ms`,
          '--stamp-enter': `${STAMP_TIMING.enterMs}ms`,
          '--stamp-fade': `${STAMP_TIMING.fadeMs}ms`,
          '--stamp-fade-at': `${STAMP_TIMING.delayMs + duration - STAMP_TIMING.fadeMs}ms`,
        } as CSSProperties
      }
      aria-live="polite"
      aria-label={`${effect.analysis ? '独立推演 · ' : ''}${effect.title} · ${effect.detail}`}
    >
      <div className="ink-stamp">
        {effect.kind === 'mate' && (
          // A single diagonal stroke of dark red ink behind the words.
          <svg className="ink-slash" viewBox="0 0 300 300" aria-hidden="true">
            <path d="M28 62C70 70 118 104 160 140C196 171 232 206 274 246L262 254C224 222 186 190 148 160C106 126 66 98 22 74Z" />
            <path
              opacity=".6"
              d="M40 86C76 98 104 116 128 136L120 140C96 122 70 106 36 94ZM212 214L246 244L236 248L206 220Z"
            />
          </svg>
        )}
        <svg className="ink-ring" viewBox="0 0 300 300" aria-hidden="true">
          <g fill="currentColor">
            <path d="M229 48C183 17 119 23 74 54C25 88 16 146 40 198C64 249 122 274 177 257C218 247 247 222 263 186L251 195C229 226 205 241 171 247C119 257 74 228 56 184C36 137 51 91 89 66C128 39 184 33 225 57Z" />
            <path d="M233 60C258 79 277 116 272 152C271 165 265 181 257 190L260 166C267 125 250 95 230 76L222 65Z" />
            <path
              opacity=".55"
              d="M62 65C37 92 27 123 33 151L28 143C23 112 38 80 62 65ZM91 248C120 263 154 269 185 255L174 265C143 278 110 268 91 248Z"
            />
          </g>
          <g fill="none" stroke="#fff0d1" strokeWidth="1" opacity=".24">
            <path d="M66 73C39 104 34 138 47 166M81 62C57 83 45 104 43 124M116 251C139 259 166 257 186 249" />
            <path d="M251 100L260 125L260 143M67 184L61 161" />
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
        {!tactical && (
          <span className="ink-stamp-context">
            {effect.analysis ? '独立推演' : ''}
          </span>
        )}
        <strong aria-label={effect.title} data-text={title}>
          {title}
        </strong>
        {!tactical && <span className="effect-detail">{effect.detail}</span>}
      </div>
    </output>
  );
}
