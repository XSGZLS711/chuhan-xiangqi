import type { Room } from './game';
import { sideName, t, type Locale } from './i18n';
import { moveText, type NotationStyle } from './notation';

/** The room's last event as a sentence in `locale`. A room saved before notes became data
 * holds the Chinese sentence itself; that is returned as written.
 */
export function noteText(
  locale: Locale,
  room: Pick<Room, 'note' | 'board' | 'history'>,
  style: NotationStyle,
): string {
  const { note } = room;
  if (typeof note === 'string') return note;
  const side = (value: 'red' | 'black') => sideName(locale, value);
  switch (note.key) {
    case 'table-ready':
      return t(locale, 'note.tableReady');
    case 'friend-joined':
      return t(locale, 'note.friendJoined');
    case 'draw-agreed':
      return t(locale, 'note.drawAgreed');
    case 'swapped':
      return t(locale, 'note.swapped');
    case 'undo-ended':
      return t(locale, 'note.undoEnded', { side: side(note.side) });
    case 'rematch-invited':
      return t(locale, 'note.rematchInvited', { side: side(note.side) });
    case 'resigned':
      return t(locale, 'note.resigned', { side: side(note.side) });
    case 'declined':
      return t(
        locale,
        note.offer === 'draw' ? 'note.declinedDraw' : 'note.declinedRematch',
        { side: side(note.side) },
      );
    case 'undone':
      // The room's board is the position the taken-back move was played from.
      return t(locale, 'note.undone', {
        side: side(note.side),
        move: room.board[note.from]
          ? moveText(room.board, note.from, note.to, style)
          : note.text,
      });
    case 'move': {
      const last = room.history.at(-1);
      const move =
        last && last.from === note.from && last.to === note.to
          ? moveText(last.before, note.from, note.to, style)
          : note.text;
      return t(locale, note.check ? 'note.moveCheck' : 'note.move', { move });
    }
  }
}
