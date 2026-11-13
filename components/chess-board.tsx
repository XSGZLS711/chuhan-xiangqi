'use client';
import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Board, initialBoard, label, Side, type Piece } from '@/lib/xiangqi';
import { sidePieceName } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';
import {
  boardSignature,
  boardTransition,
  type BoardEffect as Effect,
} from '@/lib/presentation';
import BoardEffect from '@/components/board-effect';
import { PIECE_MOTION, pieceMotion } from '@/lib/motion';

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
  } | null;
};
const SHARDS = [0, 1, 2, 3, 4, 5, 6, 7];
const OPENING = boardSignature(initialBoard());
/** The deal runs from the river outwards, soldiers first and the back rank last, each rank
 * from the middle file to the edges: the order a player sets up a real board.
 */
function dealDelay(view: number) {
  const row = Math.floor(view / 9),
    rank = row < 5 ? 4 - row : row - 5;
  return rank * 55 + Math.abs((view % 9) - 4) * 24;
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
}) {
  const signature = boardSignature(board);
  const { locale, t } = useLocale();
  const trail = `trail-${useId().replace(/[^a-z0-9]/gi, '')}`;
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
    const timing = pieceMotion(!!transition?.captured);
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
            life: delay + 620,
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
  const ghost = frame.ghost;
  useEffect(() => {
    if (!ghost) return;
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
  useEffect(() => {
    if (!deal) return;
    const timer = setTimeout(
      () => setFrame((current) => ({ ...current, deal: false })),
      dealDelay(0) + 700,
    );
    return () => clearTimeout(timer);
  }, [deal]);
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
  return (
    <div className={`board-frame ${effect ? `fx-${effect.kind}` : ''}`}>
      <fieldset
        className={`chess-board ${captureEffects ? '' : 'tactics-off'}`}
        aria-label={t('board.label')}
        style={css({
          '--slide': `${PIECE_MOTION.slideMs}ms`,
          // The landing halo waits for the drop; jumps without a move show it at once.
          '--land': `${frame.move?.timing.landMs ?? 0}ms`,
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
        {frame.move && (
          <svg
            key={frame.move.key}
            className="move-trail"
            viewBox="0 0 900 1000"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {(() => {
              const [x1, y1] = point(frame.move.from),
                [x2, y2] = point(frame.move.to);
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
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    pathLength={1}
                    stroke={`url(#${trail})`}
                  />
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
            const moved = frame.move?.id === p.id,
              revived = frame.revived === p.id;
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
                        '--hover': `${frame.move?.timing.hoverMs}ms`,
                        '--drop': `${frame.move?.timing.dropMs}ms`,
                        '--settle': `${frame.move?.timing.settleMs}ms`,
                        '--lean-x': frame.move?.lean.x ?? 0,
                        '--lean-y': frame.move?.lean.y ?? 1,
                      })
                    : {}),
                }}
                className={`piece-position ${selected === n ? 'selected' : ''} ${last?.to === n ? 'latest-piece' : ''} ${moved ? 'moving' : ''} ${revived ? 'revived' : ''}`}
              >
                <span
                  key={moved ? frame.move?.key : 'idle'}
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
                  <i
                    key={`ripple:${frame.move?.key}`}
                    className="land-ripple"
                  />
                )}
              </div>
            );
          })}
        </div>
        {ghost && captureEffects && (
          <div
            key={ghost.key}
            className="capture-ghost piece-position"
            style={{
              ...position(ghost.at),
              ...css({ '--impact-delay': `${ghost.delay}ms` }),
            }}
            aria-hidden="true"
          >
            <span className={`piece ${ghost.piece.side}`}>
              <span>{label(ghost.piece)}</span>
            </span>
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
        <BoardEffect effect={effect} />
      </fieldset>
    </div>
  );
}
