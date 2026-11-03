/** Strings that are stored, not shown. They stay Chinese for good: archives in IndexedDB
 * and D1, room JSON and `lib/archive.ts` compare against them, and games saved before
 * the English interface must still load. Translate them only when displaying (see
 * `reasonText` and `playerName` in `lib/i18n.ts`); an unknown token is shown as it is.
 */
export const REASON = {
  mate: '将死',
  stalemate: '困毙',
  timeout: '超时',
  perpetual: '长将判负',
  agreed: '双方同意和棋',
  repetition: '三次重复局面',
  quiet: '连续 60 回合未吃子',
  resigned: { red: '红方认输', black: '黑方认输' },
} as const;

/** Names written when a player gave none, and the two seats of a game against the AI. */
export const NAME = {
  player: '棋友',
  me: '我方',
  ai: '象棋 AI',
} as const;
