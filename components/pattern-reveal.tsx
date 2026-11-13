import { useId, type CSSProperties } from 'react';
import { t as translate, type MessageKey } from '@/lib/i18n';
import type { PatternHit } from '@/lib/patterns';
import { useLocale } from '@/lib/use-locale';

const vars = (v: Record<string, string | number>) => v as CSSProperties;
/** How long each kind of reveal stays, from its start (ms). */
export const REVEAL_MS = { opening: 3000, mate: 5000 };

/** A named pattern, written on the board as it is completed. Openings get a brushed banner
 * across the river; mates a hanging scroll, unrolled once the mate stamp has faded and rolled
 * up again so the finished position can be seen with its figure drawn on it. Under the
 * pieces, the pattern itself is drawn: its lines of force, the pieces that made it, and its
 * figure (the aim of a central cannon, the iron bolt, the sealed palace, the folding screen).
 * The name is always brushed in Chinese, as a picture; other languages get a caption.
 */
export default function PatternReveal({
  hit,
  delay,
  flipped,
}: {
  hit: PatternHit;
  delay: number;
  flipped: boolean;
}) {
  const { locale } = useLocale();
  const uid = useId().replace(/[^a-z0-9]/gi, '');
  const key = `pattern.${hit.id}` as MessageKey;
  const name = translate('zh', key),
    caption = locale === 'zh' ? '' : translate(locale, key),
    kicker = translate(
      'zh',
      hit.kind === 'mate' ? 'classics.mates' : 'classics.openings',
    );
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
  const target = hit.target === null ? null : view(hit.target),
    aim = hit.target === null ? null : point(hit.target);
  // The palace the mate happened in, as the viewer sees it (rows 0-2 or 7-9).
  const palaceTop = target === null ? 0 : Math.floor(target / 9) <= 2 ? 0 : 7;
  return (
    <div
      className={`pattern-reveal reveal-${hit.kind} motif-${hit.motif}`}
      style={vars({
        '--reveal-delay': `${delay}ms`,
        '--reveal-life': `${REVEAL_MS[hit.kind]}ms`,
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
          <linearGradient id={`force-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffe7a8" stopOpacity="0.2" />
            <stop offset="1" stopColor="#ffcf6a" />
          </linearGradient>
        </defs>
        {hit.motif === 'seal' && target !== null && (
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
      {hit.kind === 'opening' ? (
        <div className="pattern-banner">
          <svg
            className="banner-swash"
            viewBox="0 0 600 120"
            preserveAspectRatio="none"
          >
            <defs>
              <filter
                id={`dry-${uid}`}
                x="-5%"
                y="-20%"
                width="110%"
                height="140%"
              >
                <feTurbulence
                  type="fractalNoise"
                  baseFrequency="0.035 0.6"
                  numOctaves="2"
                  seed="11"
                  result="grain"
                />
                <feDisplacementMap
                  in="SourceGraphic"
                  in2="grain"
                  scale="14"
                  xChannelSelector="R"
                  yChannelSelector="G"
                />
              </filter>
            </defs>
            <path
              filter={`url(#dry-${uid})`}
              d="M16 58C58 20 150 10 260 14C380 18 470 10 562 24C592 30 598 58 582 78C550 106 440 104 330 106C210 108 110 114 40 110C8 106 2 84 16 58Z"
            />
          </svg>
          <span className="banner-seal">{kicker}</span>
          <strong className="banner-name">{name}</strong>
          {caption && <span className="banner-caption">{caption}</span>}
        </div>
      ) : (
        <div className="pattern-scroll">
          <i className="scroll-roller top" />
          <div className="scroll-paper">
            <strong className="scroll-name">
              {Array.from(name).map((ch, i) => (
                <span key={i} style={vars({ '--i': i })}>
                  {ch}
                </span>
              ))}
            </strong>
            <span className="scroll-seal">{kicker}</span>
            {caption && <span className="scroll-caption">{caption}</span>}
          </div>
          <i className="scroll-roller bottom" />
        </div>
      )}
    </div>
  );
}
