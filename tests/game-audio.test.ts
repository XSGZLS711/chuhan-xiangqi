import assert from 'node:assert/strict';
import {
  feedbackSounds,
  GameAudio,
  soundDelay,
  soundPan,
} from '../lib/game-audio';
import { initialBoard } from '../lib/xiangqi';
import { pieceMotion } from '../lib/motion';

type Source = {
  frequency: number;
  start: number;
  stops: number[];
};
const sources: Source[] = [];
const pans: number[] = [];
let rooms = 0;
const param = (set: (value: number) => void = () => {}) => ({
  setValueAtTime: set,
  exponentialRampToValueAtTime() {},
});
const connection = { connect() {}, disconnect() {} };
class AudioContextStub {
  state = 'running';
  currentTime = 10;
  sampleRate = 48000;
  destination = {};
  async resume() {}
  async close() {}
  createOscillator() {
    return this.source();
  }
  createBufferSource() {
    return this.source();
  }
  source() {
    const entry: Source = { frequency: 0, start: -1, stops: [] };
    sources.push(entry);
    return {
      ...connection,
      frequency: param((value) => (entry.frequency = value)),
      start(at: number) {
        entry.start = at;
      },
      stop(at = 10) {
        entry.stops.push(at);
      },
      addEventListener() {},
    };
  }
  createGain() {
    return { ...connection, gain: param() };
  }
  createBiquadFilter() {
    return { ...connection, frequency: param(), Q: { value: 0 } };
  }
  createBuffer(_channels: number, length: number) {
    return { getChannelData: () => new Float32Array(length) };
  }
  createDynamicsCompressor() {
    const value = () => ({ value: 0 });
    return {
      ...connection,
      threshold: value(),
      knee: value(),
      ratio: value(),
      attack: value(),
      release: value(),
    };
  }
  createConvolver() {
    rooms++;
    return { ...connection, buffer: null };
  }
  createStereoPanner() {
    const pan = { value: 0 };
    let wired = false;
    return {
      ...connection,
      pan,
      // Record the placement once it is set, on the panner's first connection.
      connect() {
        if (!wired) pans.push(pan.value);
        wired = true;
      },
    };
  }
}
const near = (actual: number, expected: number) =>
  assert(Math.abs(actual - expected) < 0.00001, `${actual} != ${expected}`);
const original = globalThis.AudioContext;
globalThis.AudioContext = AudioContextStub as unknown as typeof AudioContext;
try {
  for (const kind of ['move', 'capture'] as const) {
    const audio = new GameAudio();
    sources.length = 0;
    audio.play(kind, 0.3);
    assert.equal(sources.length, 0, '用户解锁之前保持安静');
    audio.unlock();
    const landing = pieceMotion(kind === 'capture').landMs / 1000;
    near(soundDelay([kind], 0, false), landing);
    near(soundDelay([kind, 'mate'], 1, false), landing + 0.18);
    audio.play(kind, landing);
    const body = sources.find(
      (source) => source.frequency > 200 && source.frequency < 300,
    )!;
    assert(body, '必须有木击主体');
    near(body.start, 10 + landing);
    if (kind === 'capture') {
      assert(sources[0].start < body.start, '呼声必须先于落地重击');
      near(sources[0].stops[0], body.start);
    } else {
      const taps = sources.filter(
        (source) => source.frequency > 200 && source.frequency < 300,
      );
      assert.equal(taps.length, 2);
      near(taps[1].start - taps[0].start, 0.055);
    }
    audio.silence();
    assert(
      sources.every((source) => source.stops.length === 2),
      '静音必须取消所有已调度声源',
    );
    audio.close();

    sources.length = 0;
    const reduced = new GameAudio();
    reduced.unlock();
    const immediate = soundDelay([kind], 0, true);
    assert.equal(immediate, 0);
    reduced.play(kind, immediate);
    assert(sources.every((source) => source.start >= 10));
    near(
      sources.find(
        (source) => source.frequency > 200 && source.frequency < 300,
      )!.start,
      10,
    );
    reduced.close();
  }
  // Placement follows the file as the player sees it, and stays inside the middle half.
  assert.equal(soundPan(4), 0);
  assert.equal(soundPan(null), 0);
  assert.equal(soundPan(9 * 9), -0.45);
  assert.equal(soundPan(9 * 9, true), 0.45);
  assert.equal(soundPan(0, true), 0.45);
  // Every sound shares one room and limiter; a placed one goes through its panner.
  sources.length = 0;
  pans.length = 0;
  rooms = 0;
  const placed = new GameAudio();
  placed.unlock();
  for (const kind of ['select', 'undo', 'check', 'mate', 'result'] as const)
    placed.play(kind, 0, soundPan(80));
  assert.equal(rooms, 1, '整局共用一个房间混响');
  assert.deepEqual(pans, [0.45, 0.45, 0.45, 0.45, 0.45]);
  assert(sources.every((source) => source.start >= 10));
  placed.close();
  // Phones buzz on the beat; muting cancels a buzz that has not come yet.
  const buzzes: unknown[] = [];
  Object.defineProperty(globalThis.navigator, 'vibrate', {
    value: (pattern: unknown) => buzzes.push(pattern),
    configurable: true,
  });
  const felt = new GameAudio();
  felt.unlock();
  felt.play('select');
  felt.play('move');
  felt.play('capture', 0.05);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(buzzes, [10], '选子不震，落子轻震');
  felt.silence();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(buzzes, [10], '静音必须取消未到的震动');
  felt.close();
  // Each way of travelling lands at its own time, and the sound waits for it.
  for (const style of ['gallop', 'leap', 'charge'] as const)
    near(
      soundDelay(['capture'], 0, false, style),
      pieceMotion(true, style).landMs / 1000,
    );
  const opening = initialBoard();
  const vault = feedbackSounds(
    ['capture', 'check'],
    { before: opening, from: 70, to: 7 },
    false,
  );
  assert.deepEqual(
    vault.map(([kind, , pan, style]) => [kind, pan, style]),
    [
      ['capture', 0.338, 'leap'],
      ['check', 0.338, 'leap'],
    ],
  );
  assert(vault[1][1] > vault[0][1], '将军声在落地之后');
  // A cannon's flight starts before its landing; nothing sounds before the move.
  sources.length = 0;
  const flight = new GameAudio();
  flight.unlock();
  flight.play('capture', vault[0][1], 0, 'leap');
  assert(sources.every((source) => source.start >= 10));
  assert(sources.some((source) => source.start < 10 + vault[0][1] - 0.1));
  // The deal knocks once for each of the 32 pieces (synthesized: two voices each).
  sources.length = 0;
  flight.play('deal');
  assert.equal(sources.length, 64);
  flight.close();
  assert.equal(soundDelay(['undo'], 0, false), 0);
  assert.equal(soundDelay(['result'], 0, false), 0);
  console.log(
    '✓ 音效落地调度、双击间隔、减少动态效果、静音取消、声像、混响和震动',
  );
} finally {
  globalThis.AudioContext = original;
}
