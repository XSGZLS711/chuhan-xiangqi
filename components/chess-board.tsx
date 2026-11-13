'use client';
import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  Board,
  hasLegalMove,
  initialBoard,
  label,
  Side,
  type Piece,
} from '@/lib/xiangqi';
import { sidePieceName } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';
import {
  boardSignature,
  boardTransition,
  checkLines,
  STAMP_TIMING,
  stampDelay,
  type BoardEffect as Effect,
} from '@/lib/presentation';
import BoardEffect from '@/components/board-effect';
import BoardFx, {
  type Celebration,
  type InkSplash,
} from '@/components/board-fx';
import {
  cannonScreen,
  dealDelay,
  gallopLeg,
  moveStyle,
  PIECE_MOTION,
  pieceMotion,
  type MoveStyle,
} from '@/lib/motion';

type Frame = {
  sig: string;
  board: Board;
  context: string;
  flipped: boolean;
  /** The piece that just travelled, with its timing in ms. */
  move: {
    id: string;
    key: string;
    from: number;
    to: number;
    style: MoveStyle;
    /** The horse's leg point, or the piece a capturing cannon vaults. */
    leg: number | null;
    screen: number | null;
    timing: ReturnType<typeof pieceMotion>;
    /** Axis the piece tips about as it is set down, leading edge first. */
    lean: { x: number; y: number };
  } | null;
  /** A fresh set laid out on the opening position: the pieces are dealt onto the board. */
  deal: boolean;
  /** Restored by an undo; fades back in once the mover has left its square. */
  revived: string | null;
  ghost: {
    piece: Piece;
    at: number;
    key: string;
    delay: number;
    life: number;
    /** Angle of the cut through the taken piece, across the line of attack. */
    cut: number;
    heavy: boolean;
  } | null;
};
const SHARDS = [0, 1, 2, 3, 4, 5, 6, 7];
const OPENING = boardSignature(initialBoard());
const reducedMotion = () =>
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;
/** The board jumps under a heavy blow; nothing moves for reduced motion. */
function jolt(node: HTMLElement | null, strength: number, delay: number) {
  if (!node || typeof node.animate !== 'function' || reducedMotion()) return;
  const s = strength;
  node.animate(
    [
      { transform: 'none' },
      { transform: `translate(${-s}px, ${s * 0.7}px)` },
      { transform: `translate(${s * 0.8}px, ${-s * 0.5}px)` },
      { transform: `translate(${-s * 0.45}px, ${s * 0.3}px)` },
      { transform: `translate(${s * 0.2}px, 0)` },
      { transform: 'none' },
    ],
    { duration: 340, delay, easing: 'ease-out' },
  );
}
/** A piece set down after travelling tips its leading edge into the board first:
 * rotating about (−dy, dx) on screen sends that edge away from the viewer.
 */
function leanAxis(from: number, to: number, flipped: boolean) {
  const at = (n: number) => (flipped ? 89 - n : n);
  const dx = (at(to) % 9) - (at(from) % 9),
    dy = Math.floor(at(to) / 9) - Math.floor(at(from) / 9),
    length = Math.hypot(dx, dy) || 1;
  return { x: +(-dy / length).toFixed(3), y: +(dx / length).toFixed(3) };
}
/** The blade falls across the line of attack, a little off square, as a cut would. */
function cutAngle(from: number, to: number, flipped: boolean) {
  const at = (n: number) => (flipped ? 89 - n : n);
  const dx = (at(to) % 9) - (at(from) % 9),
    dy = Math.floor(at(to) / 9) - Math.floor(at(from) / 9);
  return Math.round((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 28);
}
/** A jagged line of light between two points, the same every time for the same pair. */
function bolt(x1: number, y1: number, x2: number, y2: number) {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1,
    nx = -(y2 - y1) / length,
    ny = (x2 - x1) / length,
    steps = Math.max(4, Math.round(length / 55)),
    points = [`${x1} ${y1}`];
  for (let i = 1; i < steps; i++) {
    const t = i / steps,
      swing =
        (i % 2 ? 1 : -1) *
        (9 + ((x1 * 7 + y2 * 3 + i * 13) % 13)) *
        Math.sqrt(Math.sin(Math.PI * t));
    points.push(
      `${(x1 + (x2 - x1) * t + nx * swing).toFixed(1)} ${(y1 + (y2 - y1) * t + ny * swing).toFixed(1)}`,
    );
  }
  points.push(`${x2} ${y2}`);
  return `M${points.join('L')}`;
}
/** A move drawn on the board: the engine's choice or the move actually played. */
export type BoardArrow = { from: number; to: number; tone: 'best' | 'played' };
/** A small label pinned to a square, such as a move rating or a hint ring. */
export type BoardMark = { at: number; text: string; tone: string };
const css = (vars: Record<string, string | number>) => vars as CSSProperties;

export default function ChessBoard({
  board,
  flipped = false,
  selected = null,
  targets = [],
  last,
  onSquare,
  checkSide = null,
  effect = null,
  animationContext = 'live',
  animate = true,
  captureEffects = true,
  arrows = [],
  marks = [],
  onDeal,
}: {
  board: Board;
  flipped?: boolean;
  selected?: number | null;
  targets?: number[];
  last?: { from: number; to: number } | null;
  onSquare: (n: number) => void;
  checkSide?: Side | null;
  effect?: Effect | null;
  animationContext?: string;
  animate?: boolean;
  captureEffects?: boolean;
  arrows?: BoardArrow[];
  marks?: BoardMark[];
  /** Called when a new set is dealt onto the board, to sound the pieces landing. */
  onDeal?: () => void;
}) {
  const signature = boardSignature(board);
  const { locale, t } = useLocale();
  const uid = useId().replace(/[^a-z0-9]/gi, ''),
    trail = `trail-${uid}`,
    glow = `glow-${uid}`;
  const boardRef = useRef<HTMLFieldSetElement>(null);
  const [frame, setFrame] = useState<Frame>({
    sig: signature,
    board,
    context: animationContext,
    flipped,
    deal: animate && signature === OPENING,
    move: null,
    revived: null,
    ghost: null,
  });
  // Adjust only when the position really changes, before React paints it.
  // Polling hands us a fresh array every time, so identity is not enough: an
  // identical board must not cut a running capture animation short.
  if (
    frame.sig !== signature ||
    frame.context !== animationContext ||
    frame.flipped !== flipped
  ) {
    const fresh =
      frame.context !== animationContext || frame.flipped !== flipped;
    const transition =
      animate && !fresh ? boardTransition(frame.board, board) : null;
    const style = transition
      ? moveStyle(frame.board, transition.from, transition.to)
      : 'glide';
    const timing = pieceMotion(!!transition?.captured, style);
    const delay = timing.landMs;
    setFrame({
      sig: signature,
      board,
      context: animationContext,
      flipped,
      // Only a newly laid-out board is dealt; undoing back to the opening is not.
      deal: animate && fresh && signature === OPENING,
      move: transition
        ? {
            id: transition.piece.id,
            key: `${transition.piece.id}:${transition.from}:${transition.to}`,
            from: transition.from,
            to: transition.to,
            style,
            leg:
              style === 'gallop'
                ? gallopLeg(transition.from, transition.to)
                : null,
            screen:
              style === 'leap'
                ? cannonScreen(frame.board, transition.from, transition.to)
                : null,
            timing,
            lean: leanAxis(transition.from, transition.to, flipped),
          }
        : null,
      revived: transition?.revived?.id ?? null,
      ghost: transition?.captured
        ? {
            piece: transition.captured,
            at: transition.to,
            key: `${transition.piece.id}:${transition.from}:${transition.to}`,
            delay,
            life: delay + 950,
            cut: cutAngle(transition.from, transition.to, flipped),
            heavy: style === 'leap' || transition.captured.kind === 'r',
          }
        : null,
    });
  }
  const move = frame.move;
  useEffect(() => {
    if (!move) return;
    // Fallback for reduced motion, where CSS emits no animationend event.
    const timer = setTimeout(
      () =>
        setFrame((current) =>
          current.move === move ? { ...current, move: null } : current,
        ),
      move.timing.durationMs + 50,
    );
    return () => clearTimeout(timer);
  }, [move]);
  const shake = useEffectEvent((strength: number, delay: number) => {
    if (captureEffects) jolt(boardRef.current, strength, delay);
  });
  const ghost = frame.ghost;
  useEffect(() => {
    if (!ghost) return;
    shake(ghost.heavy ? 6 : 3, ghost.delay);
    const timer = setTimeout(
      () =>
        setFrame((current) =>
          current.ghost === ghost ? { ...current, ghost: null } : current,
        ),
      ghost.life,
    );
    return () => clearTimeout(timer);
  }, [ghost]);
  const deal = frame.deal;
  const announceDeal = useEffectEvent(() => onDeal?.());
  useEffect(() => {
    if (!deal) return;
    announceDeal();
    const timer = setTimeout(
      () => setFrame((current) => ({ ...current, deal: false })),
      dealDelay(0) + 700,
    );
    return () => clearTimeout(timer);
  }, [deal]);
  const lines = useMemo(
    () => (checkSide ? checkLines(board, checkSide) : null),
    [board, checkSide],
  );
  // Only looked for while in check: finding no legal move is the costly part.
  const mated = useMemo(
    () => !!lines && !!checkSide && !hasLegalMove(board, checkSide),
    [lines, board, checkSide],
  );
  const landMs = frame.move?.timing.landMs ?? 0;
  // A new check (not a re-sent copy of the same position) jolts the board once.
  const checkKey = lines ? `${signature}:${checkSide}` : null;
  const onCheck = useEffectEvent(() => shake(mated ? 4 : 2.5, landMs));
  useEffect(() => {
    if (checkKey) onCheck();
  }, [checkKey]);
  const effectId = effect?.id;
  const onStamp = useEffectEvent(() => {
    if (effect?.kind === 'mate')
      shake(8, stampDelay(landMs) + STAMP_TIMING.enterMs);
  });
  useEffect(() => {
    if (effectId) onStamp();
  }, [effectId]);
  const view = (n: number) => (flipped ? 89 - n : n);
  const point = (n: number) => {
    const v = view(n);
    return [50 + (v % 9) * 100, 50 + Math.floor(v / 9) * 100];
  };
  const position = (n: number) => {
    const pos = view(n);
    return {
      left: `${(((pos % 9) + 0.5) / 9) * 100}%`,
      top: `${((Math.floor(pos / 9) + 0.5) / 10) * 100}%`,
    };
  };
  /** Offset from one square to another in files and ranks, as the viewer sees them. */
  const offset = (from: number, to: number) => ({
    x: (view(from) % 9) - (view(to) % 9),
    y: Math.floor(view(from) / 9) - Math.floor(view(to) / 9),
  });
  const ink: InkSplash | null =
    ghost && captureEffects
      ? {
          key: ghost.key,
          x: ((view(ghost.at) % 9) + 0.5) / 9,
          y: (Math.floor(view(ghost.at) / 9) + 0.5) / 10,
          delay: ghost.delay,
          side: ghost.piece.side,
          heavy: ghost.heavy,
        }
      : null;
  const celebrate: Celebration | null =
    effect && (effect.kind === 'mate' || effect.kind === 'result')
      ? { key: effect.id, side: effect.side, mate: effect.kind === 'mate' }
      : null;
  const king = lines?.king ?? -1;
  return (
    <div className={`board-frame ${effect ? `fx-${effect.kind}` : ''}`}>
      <fieldset
        ref={boardRef}
        className={`chess-board ${captureEffects ? '' : 'tactics-off'} ${mated ? 'mated' : ''}`}
        aria-label={t('board.label')}
        style={css({
          '--slide': `${PIECE_MOTION.slideMs}ms`,
          // The landing halo waits for the drop; jumps without a move show it at once.
          '--land': `${landMs}ms`,
          '--selection-lift': `${PIECE_MOTION.selectionMs}ms`,
        })}
      >
        <svg viewBox="0 0 900 1000" aria-hidden="true" className="board-lines">
          <g fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="50" y="50" width="800" height="900" strokeWidth="3" />
            {Array.from({ length: 10 }, (_, r) => (
              <path key={'r' + r} d={`M50 ${50 + r * 100}H850`} />
            ))}
            {Array.from({ length: 7 }, (_, i) => i + 1).map((c) => (
              <path
                key={'c' + c}
                d={`M${50 + c * 100} 50V450 M${50 + c * 100} 550V950`}
              />
            ))}
            <path d="M350 50L550 250M550 50L350 250M350 750L550 950M550 750L350 950" />
            {[19, 25, 64, 70, 27, 29, 31, 33, 35, 54, 56, 58, 60, 62].map(
              (n) => {
                const x = 50 + (n % 9) * 100,
                  y = 50 + Math.floor(n / 9) * 100;
                return (
                  <g key={n}>
                    {x > 50 && (
                      <path
                        d={`M${x - 10} ${y - 27}v17h-17M${x - 27} ${y + 10}h17v17`}
                      />
                    )}{' '}
                    {x < 850 && (
                      <path
                        d={`M${x + 10} ${y - 27}v17h17M${x + 27} ${y + 10}h-17v17`}
                      />
                    )}
                  </g>
                );
              },
            )}
          </g>
          <g
            className="river-type"
            fill="currentColor"
            fontSize="43"
            textAnchor="middle"
          >
            <text x="240" y="515">
              楚 河
            </text>
            <text x="660" y="515">
              漢 界
            </text>
          </g>
        </svg>
        {/* Light on the wood: the river runs, and the lamp's glow drifts slowly. */}
        <div className="board-ambient" aria-hidden="true">
          <i className="river-flow" />
          <i className="lamp-sheen" />
        </div>
        {mated && <i className="mate-dusk" aria-hidden="true" />}
        {Array.from({ length: 90 }, (_, n) => {
          const p = board[n],
            possible = targets.includes(n);
          return (
            <button
              key={n}
              onClick={() => onSquare(n)}
              style={position(n)}
              className={`intersection ${selected === n ? 'selected' : ''} ${possible ? 'legal-target' : ''} ${last?.to === n ? 'last-to' : ''} ${last?.from === n ? 'last-from' : ''}`}
              aria-label={t('board.square', {
                row: Math.floor(n / 9) + 1,
                col: (n % 9) + 1,
                what: p ? sidePieceName(locale, p) : t('board.empty'),
                move: possible ? t('board.reachable') : '',
              })}
              aria-pressed={selected === n}
            >
              {possible && (
                // Markers open outwards from the lifted piece, nearest first.
                <span
                  className={p ? 'capture-target' : 'move-dot'}
                  style={
                    selected === null
                      ? undefined
                      : css({
                          '--reach': Math.max(
                            Math.abs(
                              Math.floor(n / 9) - Math.floor(selected / 9),
                            ),
                            Math.abs((n % 9) - (selected % 9)),
                          ),
                        })
                  }
                />
              )}
            </button>
          );
        })}
        {lines &&
          captureEffects && (
            // Check: lightning cracks from each attacker to the general, then leaves a
            // marching thread along the line of attack for as long as the check stands.
            <svg
              key={`check:${signature}`}
              className="check-lines"
              viewBox="0 0 900 1000"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" />
                </filter>
              </defs>
              {lines.from.map((from) => {
                const [x1, y1] = point(from),
                  [x2, y2] = point(lines.king),
                  d = bolt(x1, y1, x2, y2);
                return (
                  <g key={from}>
                    <line
                      className="check-thread"
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      pathLength={1}
                    />
                    <path
                      className="check-bolt halo"
                      d={d}
                      pathLength={1}
                      filter={`url(#${glow})`}
                    />
                    <path className="check-bolt core" d={d} pathLength={1} />
                  </g>
                );
              })}
            </svg>
          )}
        {lines && captureEffects && (
          <i
            key={`vignette:${signature}`}
            className={`check-vignette ${mated ? 'final' : ''}`}
            aria-hidden="true"
          />
        )}
        {frame.move && (
          <svg
            key={frame.move.key}
            className={`move-trail trail-${frame.move.style}`}
            viewBox="0 0 900 1000"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={css({ '--slide': `${frame.move.timing.slideMs}ms` })}
          >
            {(() => {
              const [x1, y1] = point(frame.move.from),
                [x2, y2] = point(frame.move.to),
                leg = frame.move.leg === null ? null : point(frame.move.leg),
                d =
                  frame.move.style === 'leap'
                    ? // The cannon's arc, drawn as the viewer sees it rise off the board.
                      `M${x1} ${y1}Q${(x1 + x2) / 2} ${(y1 + y2) / 2 - 150} ${x2} ${y2}`
                    : leg
                      ? `M${x1} ${y1}L${leg[0]} ${leg[1]}L${x2} ${y2}`
                      : `M${x1} ${y1}L${x2} ${y2}`;
              return (
                <>
                  <defs>
                    <linearGradient
                      id={trail}
                      gradientUnits="userSpaceOnUse"
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                    >
                      <stop offset="0" stopOpacity="0" />
                      <stop offset="1" stopOpacity="1" />
                    </linearGradient>
                  </defs>
                  <path d={d} pathLength={1} stroke={`url(#${trail})`} />
                  {frame.move.style === 'charge' &&
                    // Wind torn along the chariot's flanks.
                    [-1, 1].map((flank) => {
                      const length = Math.hypot(x2 - x1, y2 - y1) || 1,
                        nx = (-(y2 - y1) / length) * 30 * flank,
                        ny = ((x2 - x1) / length) * 30 * flank;
                      return (
                        <path
                          key={flank}
                          className="trail-wind"
                          d={d}
                          pathLength={1}
                          transform={`translate(${nx.toFixed(1)} ${ny.toFixed(1)})`}
                        />
                      );
                    })}
                </>
              );
            })()}
          </svg>
        )}
        <div
          className={`pieces-layer ${animate ? 'animate-pieces' : ''} ${frame.deal ? 'dealing' : ''}`}
          key={`${animationContext}:${flipped}`}
          aria-hidden="true"
        >
          {board.map((p, n) => {
            if (!p) return null;
            const travel = frame.move,
              moved = travel?.id === p.id,
              revived = frame.revived === p.id,
              vaulted = travel?.screen === n,
              fallen = mated && n === king;
            const path =
              moved && travel && travel.style !== 'glide'
                ? (() => {
                    const from = offset(travel.from, travel.to),
                      leg =
                        travel.leg === null
                          ? from
                          : offset(travel.leg, travel.to);
                    return css({
                      '--fx': from.x,
                      '--fy': from.y,
                      '--lx': leg.x,
                      '--ly': leg.y,
                      '--slide': `${travel.timing.slideMs}ms`,
                    });
                  })()
                : {};
            return (
              <div
                key={p.id}
                data-piece-id={p.id}
                style={{
                  ...position(n),
                  ...(frame.deal
                    ? css({ '--deal': `${dealDelay(view(n))}ms` })
                    : {}),
                  ...(moved
                    ? css({
                        '--hover': `${travel?.timing.hoverMs}ms`,
                        '--drop': `${travel?.timing.dropMs}ms`,
                        '--settle': `${travel?.timing.settleMs}ms`,
                        '--lean-x': travel?.lean.x ?? 0,
                        '--lean-y': travel?.lean.y ?? 1,
                      })
                    : {}),
                  ...path,
                  ...(vaulted && travel
                    ? css({ '--vault': `${travel.timing.slideMs * 0.42}ms` })
                    : {}),
                }}
                className={`piece-position ${selected === n ? 'selected' : ''} ${last?.to === n ? 'latest-piece' : ''} ${moved ? `moving travel-${travel?.style}` : ''} ${revived ? 'revived' : ''} ${vaulted ? 'vaulted' : ''} ${fallen ? 'fallen' : ''}`}
              >
                <span
                  key={moved ? travel?.key : 'idle'}
                  className={`piece ${p.side} ${p.kind === 'k' && checkSide === p.side ? 'checked' : ''}`}
                  onAnimationEnd={(event) => {
                    if (event.animationName === 'piece-settle')
                      setFrame((current) =>
                        current.move === move
                          ? { ...current, move: null }
                          : current,
                      );
                    if (event.animationName === 'piece-revive')
                      setFrame((current) =>
                        current.revived === p.id
                          ? { ...current, revived: null }
                          : current,
                      );
                  }}
                >
                  <span>{label(p)}</span>
                </span>
                {moved && !ghost && (
                  <i key={`ripple:${travel?.key}`} className="land-ripple" />
                )}
              </div>
            );
          })}
        </div>
        {ghost &&
          captureEffects && (
            // The taken piece waits under the attacker; at the blow a blade crosses it, it
            // falls apart in two halves along the cut, and splinters of wood fly.
            <div
              key={ghost.key}
              className={`capture-ghost piece-position ${ghost.heavy ? 'heavy' : ''}`}
              style={{
                ...position(ghost.at),
                ...css({
                  '--impact-delay': `${ghost.delay}ms`,
                  '--cut': `${ghost.cut}deg`,
                }),
              }}
              aria-hidden="true"
            >
              <span className={`piece ghost-whole ${ghost.piece.side}`}>
                <span>{label(ghost.piece)}</span>
              </span>
              {[0, 1].map((half) => (
                <span key={half} className={`ghost-half half-${half}`}>
                  <span className={`piece ${ghost.piece.side}`}>
                    <span>{label(ghost.piece)}</span>
                  </span>
                </span>
              ))}
              <i className="capture-slash" />
              <i className="capture-impact" />
              {SHARDS.map((i) => (
                <i
                  key={i}
                  className="capture-shard"
                  style={css({ '--a': `${i * 45 + 22}deg`, '--i': i })}
                />
              ))}
            </div>
          )}
        {arrows.length > 0 && (
          <svg
            className="board-arrows"
            viewBox="0 0 900 1000"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {arrows.map((arrow) => {
              const [x1, y1] = point(arrow.from),
                [x2, y2] = point(arrow.to),
                length = Math.hypot(x2 - x1, y2 - y1),
                ux = (x2 - x1) / length,
                uy = (y2 - y1) / length,
                // Stop short of the target so its piece stays readable.
                tipX = x2 - ux * 18,
                tipY = y2 - uy * 18,
                baseX = tipX - ux * 46,
                baseY = tipY - uy * 46;
              return (
                <g
                  key={`${arrow.tone}:${arrow.from}:${arrow.to}`}
                  className={`board-arrow ${arrow.tone}`}
                >
                  <circle cx={x1} cy={y1} r="13" />
                  <line x1={x1} y1={y1} x2={baseX} y2={baseY} />
                  <path
                    d={`M${tipX} ${tipY}L${baseX - uy * 30} ${baseY + ux * 30}L${baseX + uy * 30} ${baseY - ux * 30}Z`}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {marks.map((mark) => (
          <span
            key={`${mark.at}:${mark.tone}`}
            className={`board-mark ${mark.tone}`}
            style={position(mark.at)}
            aria-hidden="true"
          >
            {mark.text && <b>{mark.text}</b>}
          </span>
        ))}
        <BoardFx ink={ink} celebrate={captureEffects ? celebrate : null} />
        <BoardEffect effect={effect} landMs={landMs} />
      </fieldset>
    </div>
  );
}
