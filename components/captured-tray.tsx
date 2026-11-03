import { capturedBy } from '@/lib/presentation';
import { pieceName, sideName } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';
import { label, type Board, type Side } from '@/lib/xiangqi';

export default function CapturedTray({
  board,
  side,
}: {
  board: Board;
  side: Side;
}) {
  const { locale, t, tn } = useLocale();
  const groups = capturedBy(board, side);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  return (
    <div
      className="captured-tray"
      role="img"
      aria-label={tn('tray.label', total, { side: sideName(locale, side) })}
    >
      {groups.map(({ piece, count }) => (
        <span
          className={`capture-chip ${piece.side}`}
          key={`${piece.kind}-${count}`}
          title={t('tray.piece', {
            piece: pieceName(locale, piece),
            n: count,
          })}
        >
          <span className="mini-piece">{label(piece)}</span>
          {count > 1 && <small>×{count}</small>}
        </span>
      ))}
    </div>
  );
}
