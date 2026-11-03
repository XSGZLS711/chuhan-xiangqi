import { seated, type PublicRoom } from './game';
import { t, type Locale } from './i18n';
import type { Side } from './xiangqi';

export function canPlayLive(room: PublicRoom | null, busy: boolean): boolean {
  return (
    !!room?.you &&
    seated(room) &&
    !room.result &&
    room.you === room.turn &&
    !busy
  );
}

export function rematchControl(
  room: PublicRoom,
  busy: boolean,
  locale: Locale = 'zh',
) {
  const invited =
    room.offer?.kind === 'rematch' && room.offer.side !== room.you;
  const waiting =
    room.offer?.kind === 'rematch' && room.offer.side === room.you;
  return {
    label: t(
      locale,
      invited && room.you
        ? 'room.offer.acceptRematch'
        : waiting
          ? 'room.rematch.waiting'
          : 'room.rematch.again',
    ),
    intent: invited ? ('accept' as const) : ('offer' as const),
    disabled:
      busy ||
      !room.you ||
      !seated(room) ||
      waiting ||
      room.offer?.kind === 'draw',
  };
}

export const CHAT_BUBBLE_MS = 12_000;
export function recentChat(room: PublicRoom | null, side: Side, now: number) {
  const message = room?.chat.findLast((item) => item.side === side);
  if (!message || now - message.at >= CHAT_BUBBLE_MS || now < message.at - 1000)
    return null;
  return message;
}

export { displayNotation } from './xiangqi';
