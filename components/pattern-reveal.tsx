import { useId, type CSSProperties } from 'react';
import { t as translate, type MessageKey } from '@/lib/i18n';
import type { PatternHit } from '@/lib/patterns';
import { useLocale } from '@/lib/use-locale';

const vars = (v: Record<string, string | number>) => v as CSSProperties;
/** How long a pattern stays on the board (ms): an opening named in passing, the same at
 * length (its first sighting, or the gallery), and a mate's figure, drawn with its stamp. */
export function revealLife(kind: PatternHit['kind'], full: boolean) {
  return kind === 'mate' ? 3000 : full ? 2800 : 1400;
}

/** A named pattern on the board as it is completed. An opening is written on the wood: its
 * name brushed across the river in ink that soaks away, with a small seal, and at length a
 * line on what it is. A mate is named by its stamp (components/board-effect.tsx), so here it
 * only draws its figure. Both draw under the pieces what the pattern is made of: its lines of
 * force, the pieces that made it, and its figure (the aim of a central cannon, the iron bolt,
 * the sealed palace, the folding screen). The name is brushed in Chinese, as a picture; other
 * languages get a caption.
 */
export default function PatternReveal({
  hit,
  delay,
  flipped,
  full,
}: {
  hit: PatternHit;
  delay: number;
  flipped: boolean;
  full: boolean;
}) {
  const { locale, t } = useLocale();
  const uid = useId().replace(/[^a-z0-9]/gi, '');
  const key = `pattern.${hit.id}` as MessageKey;
  const life = revealLife(hit.kind, full);
  const view = (n: number) => (flipped ? 89 - n : n);
  const point = (n: number) => {
    const v = view(n);
    return [50 + (v % 9) * 100, 50 + Math.floor(v / 9) * 100];
  };
  const place = (n: number) => {
    const v = view(n);
    return {
      left: `${(((v % 9) + 0.5) / 9) * 100}%`,
      top: `${((Math.floor(v / 9) + 0.5) / 10) * 100}%`,
    };
  };
  const aim = hit.target === null ? null : point(hit.target);
  // The palace the mate happened in, as the viewer sees it (rows 0-2 or 7-9).
  const palaceTop =
    hit.target === null ? 0 : Math.floor(view(hit.target) / 9) <= 2 ? 0 : 7;
  return (
    <div
      className={`pattern-reveal reveal-${hit.kind} ${full ? 'reveal-full' : ''}`}
      style={vars({
        '--reveal-delay': `${delay}ms`,
        '--reveal-life': `${life}ms`,
        // The ink is written in the first part and soaks away over the last.
        '--write': `${full ? 420 : 340}ms`,
        '--soak-at': `${life - (full ? 650 : 520)}ms`,
        '--soak': `${full ? 650 : 520}ms`,
      })}
      aria-hidden="true"
    >
      <svg
        className="pattern-figure"
        viewBox="0 0 900 1000"
        preserveAspectRatio="none"
      >
        <defs>
          <filter
            id={`soft-${uid}`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feGaussianBlur stdDeviation="7" />
          </filter>
        </defs>
        {hit.motif === 'seal' && (
          <g className="palace-seal">
            <rect
              className="palace-wall"
              x={350}
              y={50 + palaceTop * 100}
              width={200}
              height={200}
            />
            <path
              className="palace-cross"
              pathLength={1}
              d={`M350 ${50 + palaceTop * 100}L550 ${250 + palaceTop * 100}M550 ${50 + palaceTop * 100}L350 ${250 + palaceTop * 100}`}
            />
          </g>
        )}
        {hit.lines.map(([from, to], i) => {
          const [x1, y1] = point(from),
            [x2, y2] = point(to);
          return (
            <g key={i} className="force" style={vars({ '--i': i })}>
              <line
                className="force-glow"
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                filter={`url(#soft-${uid})`}
              />
              <line
                className="force-core"
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                pathLength={1}
              />
            </g>
          );
        })}
        {hit.motif === 'aim' &&
          aim && (
            // Cross-hairs settle on the general the cannon now faces.
            <g
              className="aim"
              style={{ transformOrigin: `${aim[0]}px ${aim[1]}px` }}
            >
              <circle cx={aim[0]} cy={aim[1]} r="62" />
              <circle cx={aim[0]} cy={aim[1]} r="80" className="aim-outer" />
              {[0, 90, 180, 270].map((a) => (
                <line
                  key={a}
                  x1={aim[0]}
                  y1={aim[1] - 92}
                  x2={aim[0]}
                  y2={aim[1] - 70}
                  transform={`rotate(${a} ${aim[0]} ${aim[1]})`}
                />
              ))}
            </g>
          )}
      </svg>
      {hit.focus.map((n, i) => (
        <i
          key={n}
          className="pattern-halo"
          style={{ ...place(n), ...vars({ '--i': i }) }}
        />
      ))}
      {hit.motif === 'screen' &&
        hit.focus.map((n, i) => (
          // A folding screen of lattice panels opens behind each horse.
          <i
            key={`screen-${n}`}
            className="pattern-screen"
            style={{ ...place(n), ...vars({ '--i': i }) }}
          >
            <b />
            <b />
            <b />
          </i>
        ))}
      {hit.motif === 'bolt' &&
        hit.target !== null && (
          // The iron bolt slides across the palace on the general's rank.
          <i className="pattern-bolt" style={{ top: place(hit.target).top }}>
            <b />
          </i>
        )}
      {hit.kind === 'opening' && (
        <div className="pattern-ink">
          <span className="ink-seal">
            {translate('zh', 'classics.openings')}
          </span>
          <strong className="ink-name">{translate('zh', key)}</strong>
          {locale !== 'zh' && <span className="ink-caption">{t(key)}</span>}
          {full && (
            <span className="ink-gloss">
              {t(`pattern.${hit.id}.gloss` as MessageKey)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
