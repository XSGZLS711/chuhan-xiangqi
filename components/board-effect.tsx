import { useId, type CSSProperties } from 'react';
import {
  STAMP_TIMING,
  stampDuration,
  stampWords,
  type BoardEffect as Effect,
} from '@/lib/presentation';
import { useLocale } from '@/lib/use-locale';

const vars = (v: Record<string, string | number>) => v as CSSProperties;
// Fixed, hand-spread values keep server and client markup identical.
const SPLATS = [
  { a: -128, d: 47, s: 3.2 },
  { a: -96, d: 52, s: 1.6 },
  { a: -30, d: 50, s: 2.4 },
  { a: 12, d: 55, s: 1.4 },
  { a: 54, d: 49, s: 3.6 },
  { a: 118, d: 53, s: 2 },
  { a: 158, d: 48, s: 2.8 },
  { a: 200, d: 56, s: 1.3 },
];
const SPARKS = [
  { x: 18, d: 0, h: 34 },
  { x: 31, d: 140, h: 46 },
  { x: 47, d: 60, h: 40 },
  { x: 62, d: 200, h: 52 },
  { x: 76, d: 100, h: 38 },
  { x: 86, d: 240, h: 44 },
];

/** Our own ink stamp for captures, checks and results: a brushed ring drawn around
 * a gilded word that lands out of a zoom blur, with a ripple and spatter on impact.
 */
export default function BoardEffect({ effect }: { effect: Effect | null }) {
  const { locale, t } = useLocale();
  const brush = `brush-${useId().replace(/[^a-z0-9]/gi, '')}`;
  if (!effect) return null;
  const duration = stampDuration(effect.kind);
  const words = stampWords(locale, effect);
  const title = words.word;
  const tactical = effect.kind === 'capture' || effect.kind === 'check';
  return (
    <output
      key={effect.id}
      className={`board-effect effect-${effect.kind} ${effect.side ?? ''}`}
      style={vars({
        '--stamp-delay': `${STAMP_TIMING.delayMs}ms`,
        '--stamp-enter': `${STAMP_TIMING.enterMs}ms`,
        '--stamp-fade': `${STAMP_TIMING.fadeMs}ms`,
        '--stamp-fade-at': `${STAMP_TIMING.delayMs + duration - STAMP_TIMING.fadeMs}ms`,
        // Latin words are longer than one brushed character: the stylesheet sizes them by this.
        '--word-len': title.length,
      })}
      aria-live="polite"
      aria-label={
        (effect.analysis ? t('effect.analysis.prefix') : '') +
        `${words.title} · ${words.detail}`
      }
    >
      <div className="ink-stamp" aria-hidden="true">
        <i className="ink-glow" />
        {effect.kind === 'mate' && (
          <svg className="ink-slash" viewBox="0 0 300 300">
            <path
              filter={`url(#${brush})`}
              d="M24 58C70 66 118 102 160 138C198 170 234 206 278 248L264 258C226 224 188 192 150 162C106 128 64 98 18 72Z"
            />
            <path
              opacity=".55"
              d="M40 86C76 98 104 116 128 136L120 140C96 122 70 106 36 94ZM212 214L246 244L236 248L206 220Z"
            />
          </svg>
        )}
        {effect.kind === 'check' && <i className="ink-blade" />}
        <svg className="ink-ring" viewBox="0 0 300 300">
          <defs>
            {/* Rough, slightly dry edges, as if dragged by a loaded brush. */}
            <filter id={brush} x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.04"
                numOctaves="2"
                seed="4"
                result="warp"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="warp"
                scale="7"
                xChannelSelector="R"
                yChannelSelector="G"
                result="rough"
              />
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.55"
                numOctaves="1"
                seed="9"
                result="grain"
              />
              <feColorMatrix
                in="grain"
                type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 3.1"
                result="dry"
              />
              <feComposite in="rough" in2="dry" operator="in" />
            </filter>
          </defs>
          <g fill="currentColor" filter={`url(#${brush})`}>
            <path d="M229 48C183 17 119 23 74 54C25 88 16 146 40 198C64 249 122 274 177 257C218 247 247 222 263 186L251 195C229 226 205 241 171 247C119 257 74 228 56 184C36 137 51 91 89 66C128 39 184 33 225 57Z" />
            <path d="M233 60C258 79 277 116 272 152C271 165 265 181 257 190L260 166C267 125 250 95 230 76L222 65Z" />
            <path
              opacity=".55"
              d="M62 65C37 92 27 123 33 151L28 143C23 112 38 80 62 65ZM91 248C120 263 154 269 185 255L174 265C143 278 110 268 91 248Z"
            />
          </g>
          <g fill="none" stroke="#fff3d6" strokeWidth="1.2" opacity=".3">
            <path d="M66 73C39 104 34 138 47 166M81 62C57 83 45 104 43 124M116 251C139 259 166 257 186 249" />
            <path d="M251 100L260 125L260 143M67 184L61 161" />
          </g>
        </svg>
        <i className="ink-ripple" />
        {SPLATS.map((p, i) => (
          <i
            key={i}
            className="ink-splat"
            style={vars({
              '--a': `${p.a}deg`,
              '--d': p.d,
              '--s': p.s,
              '--i': i,
            })}
          />
        ))}
        {effect.kind === 'mate' &&
          SPARKS.map((p, i) => (
            <i
              key={i}
              className="ink-spark"
              style={vars({
                '--x': `${p.x}%`,
                '--sd': `${p.d}ms`,
                '--h': `${p.h}%`,
              })}
            />
          ))}
        {!tactical && effect.analysis && (
          <span className="ink-stamp-context">{t('effect.context')}</span>
        )}
        <span className="ink-word">
          <span className="ink-outline">{title}</span>
          <span className="ink-echo">{title}</span>
          <span className="ink-fill">{title}</span>
        </span>
        {!tactical && <span className="effect-detail">{words.detail}</span>}
      </div>
    </output>
  );
}
