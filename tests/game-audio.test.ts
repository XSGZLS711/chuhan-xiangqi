import assert from 'node:assert/strict';
import { GameAudio, soundDelay } from '../lib/game-audio';
import { pieceMotion } from '../lib/motion';

type Source = {
  frequency: number;
  start: number;
  stops: number[];
};
const sources: Source[] = [];
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
  assert.equal(soundDelay(['undo'], 0, false), 0);
  assert.equal(soundDelay(['result'], 0, false), 0);
  console.log('✓ 音效落地调度、双击间隔、减少动态效果和静音取消');
} finally {
  globalThis.AudioContext = original;
}
