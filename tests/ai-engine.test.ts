import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createAiMatch,
  playAiMove,
  engineMove,
  historyPosition,
  describeLine,
  parseEngineInfo,
} from '../lib/ai-game';
import { legalMove } from '../lib/xiangqi';

// Exercise the exact vendored WASM, not a mock or a JavaScript substitute.
const factory = createRequire(import.meta.url)(
  resolve('public/ai/engine/stockfish.js'),
);
const engine = await factory({
  wasmBinary: readFileSync('public/ai/engine/stockfish.wasm'),
});
const timeout = setTimeout(() => {
  console.error('Real engine timed out');
  process.exit(1);
}, 15000);
let match = createAiMatch('red', 'medium');
let positions = 0;
let scores = 0;
engine.addMessageListener((line: string) => {
  try {
    if (line === 'uciok')
      [
        'setoption name UCI_Variant value xiangqi',
        'setoption name Use NNUE value false',
        'setoption name Threads value 1',
        'isready',
      ].forEach((c) => engine.postMessage(c));
    if (line === 'readyok') {
      engine.postMessage(historyPosition(match.room));
      engine.postMessage('go movetime 100 depth 6');
    }
    const info = parseEngineInfo(line, match.room.turn);
    if (info) {
      assert(
        describeLine(match.room.board, match.room.turn, info.pv).length > 0,
      );
      scores++;
    }
    if (line.startsWith('bestmove ')) {
      const move = engineMove(line.split(' ')[1]);
      assert(move);
      assert(legalMove(match.room.board, move.from, move.to, match.room.turn));
      match = playAiMove(match, move.from, move.to);
      positions++;
      if (positions < 6) {
        engine.postMessage(historyPosition(match.room));
        engine.postMessage('go movetime 100 depth 6');
      } else {
        assert(scores > 0);
        console.log(
          `Real WASM: ${positions} legal plies and ${scores} valid analysis updates`,
        );
        clearTimeout(timeout);
        engine.postMessage('quit');
        setTimeout(() => process.exit(0), 50);
      }
    }
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});
engine.postMessage('uci');
