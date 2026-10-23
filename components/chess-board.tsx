'use client';
import { useEffect, useState, type CSSProperties } from 'react';
import { Board, label, Side, type Piece } from '@/lib/xiangqi';
import {
  boardSignature,
  boardTransition,
  type BoardEffect as Effect,
} from '@/lib/presentation';
import BoardEffect from '@/components/board-effect';

type Frame = {
  sig: string;
  board: Board;
  context: string;
  flipped: boolean;
  /** The piece that just travelled, with its slide time in ms. */
  move: { id: string; key: string; ms: number } | null;
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
}) {
  const signature = boardSignature(board);
  const [frame, setFrame] = useState<Frame>({
    sig: signature,
    board,
    context: animationContext,
    flipped,
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
    const transition =
      animate && frame.context === animationContext && frame.flipped === flipped
        ? boardTransition(frame.board, board)
        : null;
    const distance = transition
      ? Math.hypot(
          (transition.to % 9) - (transition.from % 9),
          Math.floor(transition.to / 9) - Math.floor(transition.from / 9),
        )
      : 0;
    const ms = Math.round(Math.min(440, 190 + 48 * distance));
    const delay = Math.round(ms * 0.78);
    setFrame({
      sig: signature,
      board,
      context: animationContext,
      flipped,
      move: transition
        ? {
            id: transition.piece.id,
            key: `${transition.piece.id}:${transition.from}:${transition.to}`,
            ms,
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
  const view = (n: number) => (flipped ? 89 - n : n);
  const position = (n: number) => {
    const pos = view(n);
    return {
      left: `${(((pos % 9) + 0.5) / 9) * 100}%`,
      top: `${((Math.floor(pos / 9) + 0.5) / 10) * 100}%`,
    };
  };
  return (
    <div className={`board-frame ${effect ? `fx-${effect.kind}` : ''}`}>
      <fieldset className="chess-board" aria-label="中国象棋棋盘">
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
              aria-label={`${Math.floor(n / 9) + 1}行${(n % 9) + 1}列${p ? `${p.side === 'red' ? '红' : '黑'}${label(p)}` : '空位'}${possible ? '，可走' : ''}`}
              aria-pressed={selected === n}
            >
              {possible &&
                (p ? (
                  <span className="capture-target" />
                ) : (
                  <span className="move-dot" />
                ))}
            </button>
          );
        })}
        <div
          className={`pieces-layer ${animate ? 'animate-pieces' : ''}`}
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
                  ...(moved || revived
                    ? css({
                        '--slide': `${frame.move?.ms ?? 240}ms`,
                        ...(moved
                          ? { transitionDuration: `${frame.move?.ms}ms` }
                          : {}),
                      })
                    : {}),
                }}
                className={`piece-position ${selected === n ? 'selected' : ''} ${last?.to === n ? 'latest-piece' : ''} ${moved ? 'moving' : ''} ${revived ? 'revived' : ''}`}
              >
                <span
                  key={moved ? frame.move?.key : 'idle'}
                  className={`piece ${p.side} ${p.kind === 'k' && checkSide === p.side ? 'checked' : ''}`}
                >
                  <span>{label(p)}</span>
                </span>
              </div>
            );
          })}
        </div>
        {ghost && (
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
        <BoardEffect effect={effect} />
      </fieldset>
    </div>
  );
}
