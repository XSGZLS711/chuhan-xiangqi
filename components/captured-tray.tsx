import { capturedBy } from '@/lib/presentation';
import { label, sideLabel, type Board, type Side } from '@/lib/xiangqi';

export default function CapturedTray({
  board,
  side,
}: {
  board: Board;
  side: Side;
}) {
  const groups = capturedBy(board, side);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return (
    <div
      className="captured-tray"
      aria-label={`${sideLabel(side)}已吃对方 ${total} 子`}
    >
      <span className="captured-label">
        已吃{total ? <b>{total}</b> : null}
      </span>
      {groups.length ? (
        <div className="captured-pieces">
          {groups.map(({ piece, count }) => (
            <span
              className={`capture-chip ${piece.side}`}
              key={`${piece.kind}-${count}`}
              title={`${label(piece)} ${count} 枚`}
              aria-label={`${label(piece)} ${count} 枚`}
            >
              <span className="mini-piece">{label(piece)}</span>
              {count > 1 && <small>×{count}</small>}
            </span>
          ))}
        </div>
      ) : (
        <span className="captured-empty">暂无吃子</span>
      )}
    </div>
  );
}
