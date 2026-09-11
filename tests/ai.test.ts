import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createAiMatch,
  playAiMove,
  undoAiTurn,
  resignAiMatch,
  squareToEngine,
  engineMove,
  boardFen,
  historyPosition,
  parseEngineInfo,
  describeLine,
} from '../lib/ai-game';
import { initialBoard } from '../lib/xiangqi';
import { BrowserEngine } from '../lib/ai-engine';

test('Fairy coordinates round-trip all squares, including rank 10', () => {
  for (let i = 0; i < 90; i++)
    assert.deepEqual(engineMove(squareToEngine(i) + squareToEngine(89 - i)), {
      from: i,
      to: 89 - i,
    });
  assert.equal(squareToEngine(0), 'a10');
  assert.equal(squareToEngine(89), 'i1');
  for (const token of ['a0a1', 'a11a1', 'j1a1', '0000', '(none)', 'a1a2q'])
    assert.equal(engineMove(token), null);
});
test('FEN and full move history preserve engine position and side', () => {
  let match = createAiMatch('black', 'hard');
  assert.equal(
    boardFen(match.room.board, 'red'),
    'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1',
  );
  match = playAiMove(playAiMove(match, 54, 45), 27, 36);
  assert.equal(
    historyPosition(match.room),
    'position startpos moves a4a5 a7a6',
  );
  assert.equal(historyPosition(match.room, 1), 'position startpos moves a4a5');
  assert.equal(historyPosition(match.room, 0), 'position startpos');
  assert.match(boardFen(match.room.board, 'black'), / b - - 0 1$/);
});
test('Red undo restores a human decision with or without a completed AI reply', () => {
  const start = createAiMatch('red', 'medium');
  const pending = playAiMove(start, 54, 45);
  for (const match of [pending, playAiMove(pending, 27, 36)]) {
    const undo = undoAiTurn(match);
    assert.deepEqual(undo.room.board, initialBoard());
    assert.equal(undo.room.turn, 'red');
    assert.equal(undo.room.history.length, 0);
    assert(undo.revision > match.revision);
  }
  assert.equal(start.room.history.length, 0);
  assert.equal(pending.room.history.length, 1);
});
test('Black undo keeps the initial AI move and returns control to black', () => {
  const opening = playAiMove(createAiMatch('black', 'easy'), 54, 45);
  const pending = playAiMove(opening, 27, 36);
  for (const match of [pending, playAiMove(pending, 56, 47)]) {
    const undo = undoAiTurn(match);
    assert.equal(undo.room.turn, 'black');
    assert.equal(undo.room.history.length, 1);
    assert.deepEqual(undo.room.board, opening.room.board);
  }
});
test('Undo reopens a resigned game, including resignation before the first move', () => {
  for (const human of ['red', 'black'] as const) {
    const match = resignAiMatch(createAiMatch(human, 'medium'));
    assert(match.room.result);
    assert.equal(undoAiTurn(match).room.result, null);
  }
});
test('Evaluation always uses red perspective, discards bounds, and validates the PV', () => {
  const line = 'info depth 8 multipv 1 score cp 120 nodes 500 pv a4a5 a7a6';
  assert.equal(parseEngineInfo(line, 'red')?.cp, 120);
  assert.equal(parseEngineInfo(line, 'black')?.cp, -120);
  assert.equal(
    parseEngineInfo(line.replace('cp 120', 'mate -3'), 'black')?.mate,
    3,
  );
  assert.equal(
    parseEngineInfo(line.replace('cp 120', 'cp 120 lowerbound'), 'red'),
    null,
  );
  assert.equal(
    parseEngineInfo(line.replace('multipv 1', 'multipv 2'), 'red'),
    null,
  );
  assert.equal(
    describeLine(initialBoard(), 'red', ['a4a5', 'a7a6', 'a5a10']).length,
    2,
  );
});

class FakeWorker {
  static latest: FakeWorker;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  commands: string[] = [];
  terminated = false;
  constructor() {
    FakeWorker.latest = this;
  }
  postMessage(command: string) {
    this.commands.push(command);
  }
  terminate() {
    this.terminated = true;
  }
  emit(line: string) {
    this.onmessage?.({ data: { type: 'line', line } });
  }
}
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
test('Cancelled search drains bestmove before starting next position and suppresses stale analysis', async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const oldWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
  Object.defineProperty(globalThis, 'window', {
    value: { location: { href: 'https://example.com/ai/' } },
    configurable: true,
  });
  Object.defineProperty(globalThis, 'Worker', {
    value: FakeWorker,
    configurable: true,
  });
  const engine = new BrowserEngine();
  try {
    const worker = FakeWorker.latest;
    worker.onmessage?.({ data: { type: 'loaded' } });
    assert.equal(worker.commands[0], 'uci');
    worker.emit('uciok');
    assert(
      worker.commands.includes('setoption name UCI_Variant value xiangqi'),
    );
    worker.emit('readyok');
    await engine.ready;
    const one = new AbortController(),
      two = new AbortController(),
      three = new AbortController();
    let updates = 0;
    const options = { turn: 'red' as const, time: 100, depth: 4, skill: 0 };
    const first = engine.search({
      ...options,
      position: 'position startpos',
      signal: one.signal,
      onInfo: () => updates++,
    });
    const rejection = assert.rejects(first, { name: 'AbortError' });
    await tick();
    one.abort();
    const skipped = engine.search({
      ...options,
      position: 'position never-send',
      signal: two.signal,
    });
    const skippedRejection = assert.rejects(skipped, { name: 'AbortError' });
    two.abort();
    const third = engine.search({
      ...options,
      position: 'position startpos moves a4a5',
      signal: three.signal,
    });
    await tick();
    assert.equal(worker.commands.filter((c) => c.startsWith('go ')).length, 1);
    assert.equal(worker.commands.at(-1), 'stop');
    worker.emit('info depth 4 score cp 500 pv a4a5');
    assert.equal(updates, 0);
    worker.emit('bestmove a4a5');
    await rejection;
    await skippedRejection;
    await tick();
    assert(!worker.commands.includes('position never-send'));
    assert.equal(worker.commands.filter((c) => c.startsWith('go ')).length, 2);
    worker.emit('bestmove a7a6');
    assert.equal(await third, 'a7a6');
    const pending = engine.search({
      ...options,
      position: 'position startpos',
      signal: new AbortController().signal,
    });
    const pendingRejection = assert.rejects(pending, { name: 'AbortError' });
    await tick();
    engine.dispose();
    await pendingRejection;
    assert(worker.terminated);
  } finally {
    engine.dispose();
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow);
    else Reflect.deleteProperty(globalThis, 'window');
    if (oldWorker) Object.defineProperty(globalThis, 'Worker', oldWorker);
    else Reflect.deleteProperty(globalThis, 'Worker');
  }
});
