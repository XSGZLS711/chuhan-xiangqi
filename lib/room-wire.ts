import { initialBoard, moveBoard, type Board, type Move } from './xiangqi';

/** One move as a room's Durable Object stores and sends it: from, to, its text, whether it
 * checks, both clocks before it and the quiet count before it. The rest of a `Move` (the
 * board before it, the side and the piece taken) comes back from replaying the moves. */
export type WireMove = [number, number, string, 0 | 1, number, number, number];

/** A room without its boards. A position is about 1.6 KB of JSON and every move keeps the one
 * before it, so a long game is a few KB this way instead of a few hundred. `start` and `board`
 * are only there when replaying would not give them, which no room so far needs. */
export type Wire<R extends { board: Board; history: Move[] }> = Omit<
  R,
  'board' | 'history'
> & { moves: WireMove[]; start?: Board; board?: Board };

const same = (a: Board, b: Board) => JSON.stringify(a) === JSON.stringify(b);

function replay(start: Board, moves: WireMove[]) {
  let board = start;
  const history = moves.map(
    ([from, to, text, check, red, black, quietBefore]): Move => {
      const before = board;
      board = moveBoard(before, from, to);
      return {
        from,
        to,
        text,
        side: before[from]!.side,
        captured: before[to],
        check: !!check,
        before,
        clocks: { red, black },
        quietBefore,
      };
    },
  );
  return { board, history };
}

export function pack<R extends { board: Board; history: Move[] }>(
  room: R,
): Wire<R> {
  const { board, history, ...rest } = room;
  const moves = history.map(
    (m): WireMove => [
      m.from,
      m.to,
      m.text,
      m.check ? 1 : 0,
      m.clocks.red,
      m.clocks.black,
      m.quietBefore,
    ],
  );
  const start = history[0]?.before ?? board;
  const wire: Wire<R> = { ...rest, moves };
  if (!same(start, initialBoard())) wire.start = start;
  if (!same(replay(start, moves).board, board)) wire.board = board;
  return wire;
}

export function unpack<R extends { board: Board; history: Move[] }>(
  wire: Wire<R>,
): R {
  const { moves, start, board, ...rest } = wire;
  const played = replay(start ?? initialBoard(), moves);
  return {
    ...rest,
    board: board ?? played.board,
    history: played.history,
  } as unknown as R;
}
