import assert from 'node:assert/strict';
import { CLASSICS } from '../lib/classics';
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
console.log(`✓ ${CLASSICS.length} 个经典着法：演示合法，最后一步被认出`);
