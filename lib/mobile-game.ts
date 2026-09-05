import type { PublicRoom } from './game';
import type { Side } from './xiangqi';

export function canPlayLive(room: PublicRoom | null, busy: boolean): boolean {
  return (
    !!room?.you &&
    !!room.players.black &&
    !room.result &&
    room.you === room.turn &&
    !busy
  );
}

export function rematchControl(room: PublicRoom, busy: boolean) {
  const invited =
    room.offer?.kind === 'rematch' && room.offer.side !== room.you;
  const waiting =
    room.offer?.kind === 'rematch' && room.offer.side === room.you;
  return {
    label: invited && room.you ? '应邀出战' : waiting ? '等待应战' : '再来一局',
    intent: invited ? ('accept' as const) : ('offer' as const),
    disabled:
      busy ||
      !room.you ||
      !room.players.black ||
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

export const displayNotation = (text: string) => text.replaceAll('车', '車');
