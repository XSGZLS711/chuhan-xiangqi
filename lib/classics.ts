import type { PatternId } from './patterns';
import { initialBoard, type Board, type Kind, type Side } from './xiangqi';

/** A classic shown as a short game: the position it starts from, who moves first, and the
 * moves (square to square) that play it out. The last move completes the pattern. Pure data,
 * checked by tests/patterns.test.ts: every move is legal and the board recognises the pattern.
 */
export type Classic = {
  id: PatternId;
  board: Board;
  turn: Side;
  moves: [number, number][];
};

const at = (row: number, col: number) => row * 9 + col;
/** A position from a list of pieces: [side, kind, row, col]. */
function position(pieces: [Side, Kind, number, number][]): Board {
  const board: Board = Array(90).fill(null);
  pieces.forEach(([side, kind, row, col], i) => {
    board[at(row, col)] = { side, kind, id: `${side}-${kind}-x${i}` };
  });
  return board;
}
const opening = (id: PatternId, moves: [number, number][]): Classic => ({
  id,
  board: initialBoard(),
  turn: 'red',
  moves,
});
// Red's cannons start on (7,1) and (7,7), black's on (2,1) and (2,7); horses on the back
// ranks at files 1 and 7, elephants at 2 and 6, soldiers on rows 6 and 3.
const RED_CENTRAL: [number, number] = [at(7, 7), at(7, 4)];

export const CLASSICS: Classic[] = [
  opening('central-cannon', [RED_CENTRAL]),
  opening('corner-cannon', [[at(7, 7), at(7, 5)]]),
  opening('cross-cannon', [[at(7, 7), at(7, 3)]]),
  opening('pawn-opening', [[at(6, 2), at(5, 2)]]),
  opening('elephant-opening', [[at(9, 6), at(7, 4)]]),
  opening('horse-opening', [[at(9, 7), at(7, 6)]]),
  opening('same-cannons', [RED_CENTRAL, [at(2, 7), at(2, 4)]]),
  opening('opposite-cannons', [RED_CENTRAL, [at(2, 1), at(2, 4)]]),
  opening('screen-horses', [
    RED_CENTRAL,
    [at(0, 7), at(2, 6)],
    [at(9, 7), at(7, 6)],
    [at(0, 1), at(2, 2)],
  ]),
  {
    // The cannon takes the centre; the chariot sweeps onto the flank file and bolts the door.
    id: 'iron-bolt',
    turn: 'red',
    board: position([
      ['black', 'k', 0, 3],
      ['black', 'a', 0, 5],
      ['black', 'e', 2, 4],
      ['black', 'p', 3, 8],
      ['black', 'p', 3, 0],
      ['black', 'r', 5, 8],
      ['red', 'k', 9, 4],
      ['red', 'a', 9, 3],
      ['red', 'c', 4, 1],
      ['red', 'r', 3, 6],
      ['red', 'p', 6, 6],
    ]),
    moves: [
      [at(4, 1), at(4, 4)],
      [at(3, 8), at(4, 8)],
      [at(3, 6), at(3, 3)],
    ],
  },
  {
    // The general sits between its own advisor, advisor and horse; one cannon down the
    // bottom rank and there is nowhere to go.
    id: 'smothered',
    turn: 'red',
    board: position([
      ['black', 'k', 0, 4],
      ['black', 'a', 0, 5],
      ['black', 'a', 1, 4],
      ['black', 'h', 0, 3],
      ['black', 'p', 3, 0],
      ['black', 'p', 3, 2],
      ['black', 'r', 6, 0],
      ['red', 'k', 9, 5],
      ['red', 'c', 5, 8],
      ['red', 'r', 8, 0],
      ['red', 'p', 6, 4],
    ]),
    moves: [[at(5, 8), at(0, 8)]],
  },
  {
    // Two cannons on the central file: the rear one fires through the front one.
    id: 'double-cannon',
    turn: 'red',
    board: position([
      ['black', 'k', 0, 4],
      ['black', 'a', 0, 3],
      ['black', 'a', 0, 5],
      ['black', 'p', 3, 0],
      ['black', 'p', 3, 8],
      ['red', 'k', 9, 3],
      ['red', 'c', 3, 4],
      ['red', 'c', 7, 1],
      ['red', 'r', 9, 8],
    ]),
    moves: [[at(7, 1), at(7, 4)]],
  },
  {
    // The horse leaps in front of the general and becomes the cannon's screen.
    id: 'horse-cannon',
    turn: 'red',
    board: position([
      ['black', 'k', 0, 4],
      ['black', 'p', 3, 0],
      ['black', 'p', 3, 8],
      ['black', 'r', 8, 8],
      ['red', 'k', 9, 3],
      ['red', 'c', 5, 4],
      ['red', 'h', 3, 2],
      ['red', 'a', 9, 5],
    ]),
    moves: [[at(3, 2), at(2, 4)]],
  },
  {
    // One chariot holds the second rank; the other rushes to the bottom rank.
    id: 'double-chariot',
    turn: 'red',
    board: position([
      ['black', 'k', 0, 4],
      ['black', 'p', 3, 2],
      ['black', 'p', 3, 6],
      ['red', 'k', 9, 3],
      ['red', 'r', 1, 8],
      ['red', 'r', 5, 0],
      ['red', 'p', 6, 4],
    ]),
    moves: [[at(5, 0), at(0, 0)]],
  },
  {
    // The chariot seals the general's rank; the horse lands in the trough beside it.
    id: 'crouching-horse',
    turn: 'red',
    board: position([
      ['black', 'k', 0, 4],
      ['black', 'a', 0, 3],
      ['black', 'a', 0, 5],
      ['black', 'p', 3, 0],
      ['black', 'p', 3, 8],
      ['red', 'k', 9, 3],
      ['red', 'r', 1, 8],
      ['red', 'h', 3, 3],
      ['red', 'p', 6, 4],
    ]),
    moves: [[at(3, 3), at(1, 2)]],
  },
  {
    // The advisors box the general in, a soldier holds the palace centre, and the horse
    // hangs on the advisor's corner.
    id: 'corner-horse',
    turn: 'red',
    board: position([
      ['black', 'k', 0, 4],
      ['black', 'a', 0, 3],
      ['black', 'a', 0, 5],
      ['black', 'p', 3, 0],
      ['black', 'p', 3, 8],
      ['red', 'k', 9, 3],
      ['red', 'p', 2, 4],
      ['red', 'h', 4, 2],
      ['red', 'r', 9, 8],
    ]),
    moves: [[at(4, 2), at(2, 3)]],
  },
];
