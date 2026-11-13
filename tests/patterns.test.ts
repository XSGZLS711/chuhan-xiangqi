import assert from 'node:assert/strict';
import { CLASSICS } from '../lib/classics';
import { t } from '../lib/i18n';
import { firstSighting, markSeen } from '../lib/patterns-seen';
import { branchFeedback, stampWords } from '../lib/presentation';
import {
  MATE_PATTERNS,
  OPENING_PATTERNS,
  homeSquare,
  movePattern,
} from '../lib/patterns';
import {
  hasLegalMove,
  inCheck,
  initialBoard,
  legalMove,
  moveBoard,
  opposite,
  type Board,
} from '../lib/xiangqi';

// Every classic in the gallery is a legal little game, and the board names it when its
// last move is played, and not before.
const ids = CLASSICS.map((c) => c.id);
assert.deepEqual(
  [...ids].sort(),
  [...OPENING_PATTERNS, ...MATE_PATTERNS].sort(),
  '每个经典着法都有演示',
);
for (const classic of CLASSICS) {
  let board = classic.board,
    turn = classic.turn;
  classic.moves.forEach(([from, to], i) => {
    assert(
      legalMove(board, from, to, turn),
      `${classic.id} 第 ${i + 1} 步合法`,
    );
    const found = movePattern(board, from, to);
    if (i === classic.moves.length - 1) {
      assert.equal(found?.id, classic.id, `${classic.id} 最后一步被认出`);
      assert.equal(found?.side, turn);
      assert(found.focus.length > 0);
    } else
      assert(
        found === null || found.id !== classic.id,
        `${classic.id} 第 ${i + 1} 步还不算`,
      );
    board = moveBoard(board, from, to);
    turn = opposite(turn);
  });
  const mate = (MATE_PATTERNS as readonly string[]).includes(classic.id);
  if (mate) {
    // A named mate is one stamp: its name is the word, with 绝杀 above it.
    const [from, to] = classic.moves[classic.moves.length - 1];
    let before = classic.board,
      side = classic.turn;
    for (const [f, tt] of classic.moves.slice(0, -1)) {
      before = moveBoard(before, f, tt);
      side = opposite(side);
    }
    const { effect } = branchFeedback(before, from, to, side, 'demo');
    assert.equal(effect?.kind, 'mate');
    assert.equal(effect?.text.pattern, classic.id);
    for (const locale of ['zh', 'en', 'vi'] as const) {
      const words = stampWords(locale, effect!);
      assert.equal(words.word, t(locale, `pattern.${classic.id}`));
      assert.equal(words.kicker, t(locale, 'stamp.mate'));
    }
  }
  assert.equal(
    inCheck(board, turn) && !hasLegalMove(board, turn),
    mate,
    `${classic.id} ${mate ? '是' : '不是'}绝杀`,
  );
}
// Every piece of the standard set knows where it started.
initialBoard().forEach((p, n) => p && assert.equal(homeSquare(p), n));
// A central cannon later in the game, or a capture, is not an opening.
const start = initialBoard();
const later = moveBoard(start, 64, 55);
assert.equal(movePattern(moveBoard(later, 27, 36), 70, 67), null);
assert.equal(movePattern(start, 70, 7), null);
// Black's reply in kind names the pair; black's central cannon on its own does not.
assert.equal(movePattern(moveBoard(start, 70, 67), 25, 22)?.id, 'same-cannons');
assert.equal(
  movePattern(moveBoard(start, 70, 67), 19, 22)?.id,
  'opposite-cannons',
);
assert.equal(movePattern(moveBoard(start, 64, 55), 25, 22), null);
// A mate the board has no name for keeps the plain 绝杀 stamp: a lone chariot on the back
// rank; a soldier holds the point in front, the facing red general the centre.
const lone: Board = Array(90).fill(null);
lone[3] = { side: 'black', kind: 'k', id: 'bk' };
lone[27] = { side: 'black', kind: 'p', id: 'bp' };
lone[85] = { side: 'red', kind: 'k', id: 'rk' };
lone[21] = { side: 'red', kind: 'p', id: 'rp' };
lone[53] = { side: 'red', kind: 'r', id: 'rr' };
const plain = branchFeedback(lone, 53, 8, 'red', 'x').effect!;
assert.equal(plain.kind, 'mate');
assert.equal(plain.text.pattern, undefined);
assert.equal(stampWords('zh', plain).word, t('zh', 'stamp.mate'));
assert.equal(stampWords('zh', plain).kicker, '');
// The first sighting of an opening is shown at length, once per device; without storage
// every opening counts as seen, so nothing is shown at length over and over.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
} as Storage;
assert.equal(firstSighting('central-cannon'), true);
markSeen('central-cannon');
markSeen('central-cannon');
assert.equal(firstSighting('central-cannon'), false);
assert.equal(firstSighting('screen-horses'), true);
assert.equal(store.get('chuhan-patterns-seen'), '["central-cannon"]');
globalThis.localStorage = {
  getItem: () => {
    throw new Error('blocked');
  },
} as unknown as Storage;
assert.equal(firstSighting('screen-horses'), false);
console.log(
  `✓ ${CLASSICS.length} 个经典着法：演示合法，最后一步被认出，杀法名写进绝杀印章，初见才详写`,
);
