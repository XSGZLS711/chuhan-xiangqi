import type { SoundKind } from './presentation';
import {
  DEAL,
  dealDelay,
  moveStyle,
  pieceMotion,
  type MoveStyle,
} from './motion';
import { initialBoard, type Board } from './xiangqi';

/** Delay to impact, in seconds. Follow-up feedback comes after the landing. */
export function soundDelay(
  sounds: SoundKind[],
  index: number,
  reducedMotion = typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches,
  style: MoveStyle = 'glide',
): number {
  const moving = sounds[0] === 'move' || sounds[0] === 'capture';
  if (!moving) return 0;
  const landing = reducedMotion
    ? 0
    : pieceMotion(sounds[0] === 'capture', style).landMs / 1000;
  return landing + (index ? 0.18 : 0);
}

/** Where on the stereo stage a move lands: the destination's file as the player sees
 * it, kept inside the middle half so neither ear is left alone with it.
 */
export function soundPan(square: number | null | undefined, flipped = false) {
  if (square === null || square === undefined) return 0;
  const file = (flipped ? 89 - square : square) % 9;
  return +(((file - 4) / 4) * 0.45).toFixed(3);
}

/** A move's feedback, each sound timed to the landing, placed where the piece lands and
 * carrying how it travelled: [kind, delay, pan, style] for GameAudio.play. */
export function feedbackSounds(
  sounds: SoundKind[],
  move: { before: Board; from: number; to: number } | null | undefined,
  flipped = false,
): [SoundKind, number, number, MoveStyle][] {
  const style = move ? moveStyle(move.before, move.from, move.to) : 'glide',
    pan = soundPan(move?.to, flipped);
  return sounds.map((kind, index) => [
    kind,
    soundDelay(sounds, index, undefined, style),
    pan,
    style,
  ]);
}

/** Phones that can buzz feel the same beats the ear hears (Android; iOS has no API). */
const HAPTICS: Partial<Record<SoundKind, number | number[]>> = {
  move: 10,
  capture: [16, 45, 24],
  check: [12, 70, 12],
  mate: [28, 60, 70],
  result: 20,
};
/** How much of each sound reaches the room: a knock stays close, the end rings out. */
const ROOM: Record<SoundKind, number> = {
  select: 0.05,
  deal: 0.1,
  move: 0.12,
  capture: 0.2,
  undo: 0.18,
  check: 0.24,
  mate: 0.5,
  result: 0.42,
};

/** The five-note scale on G, two octaves and a step: the strings a glissando sweeps. */
const PENTATONIC = [
  196, 220, 246.94, 293.66, 329.63, 392, 440, 493.88, 587.33, 659.25, 783.99,
];

/** Every voice runs through one small wooden room (a generated impulse, no file) and a
 * gentle limiter, so stacked sounds blend instead of clipping on loud phone speakers.
 */
function roomImpulse(c: BaseAudioContext) {
  const seconds = 1.2,
    length = Math.ceil(c.sampleRate * seconds),
    impulse = c.createBuffer(2, length, c.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    // Fixed seeds keep the room the same on every load; each ear hears its own walls.
    let seed = 7 + channel * 101,
      low = 0;
    const random = () =>
      ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let i = 0; i < length; i++) {
      const t = i / c.sampleRate;
      // Wood and paper swallow the highs first: a one-pole low-pass that closes as it decays.
      const warmth = 0.55 - 0.4 * Math.min(1, t / seconds);
      low += (random() - low) * warmth;
      const early = t < 0.035 && i % (211 + channel * 37) < 3 ? 0.6 : 0;
      data[i] = (low + early) * Math.exp(-t * 5.2) * Math.min(1, t * 400);
    }
  }
  return impulse;
}

/** A recorded wooden knock (CC0, see public/sounds/SOURCE.md) with synthesized
 * air, drum and woodblock around it; the synthesized knock stands in until the
 * recording has loaded. Nothing plays before a tap unlocks audio.
 */
export const MOVE_SAMPLE_URL = '/sounds/move.mp3';
export class GameAudio {
  private context: AudioContext | null = null;
  private active = new Set<AudioScheduledSourceNode>();
  private speech: ReturnType<typeof setTimeout> | null = null;
  private spoken = false;
  private knock: { buffer: AudioBuffer; offset: number } | null = null;
  private loading = false;
  private bus: { dry: AudioNode; wet: AudioNode | null } | null = null;
  private buzz = new Set<ReturnType<typeof setTimeout>>();
  unlock(): void {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
      this.load(this.context);
    } catch {
      /* Browsers without Web Audio keep the game silent. */
    }
    // iOS only lets speech start from a tap, so speak nothing once while we have one.
    if (typeof speechSynthesis !== 'undefined' && !this.spoken) {
      this.spoken = true;
      speechSynthesis.getVoices();
      speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    }
  }
  silence(): void {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {}
    }
    this.active.clear();
    for (const timer of this.buzz) clearTimeout(timer);
    this.buzz.clear();
    if (this.speech) clearTimeout(this.speech);
    this.speech = null;
    if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
  }
  private load(c: AudioContext) {
    if (this.loading || typeof location === 'undefined') return;
    this.loading = true;
    void fetch(new URL(MOVE_SAMPLE_URL, location.origin))
      .then((response) =>
        response.ok
          ? response.arrayBuffer()
          : Promise.reject(new Error(response.statusText)),
      )
      .then((data) => c.decodeAudioData(data))
      .then((buffer) => {
        // Encoders pad the start; begin 3 ms before the actual impact.
        const samples = buffer.getChannelData(0);
        let peak = 0;
        for (const v of samples) peak = Math.max(peak, Math.abs(v));
        const onset = samples.findIndex((v) => Math.abs(v) > peak * 0.1);
        this.knock = {
          buffer,
          offset: Math.max(0, onset / buffer.sampleRate - 0.003),
        };
      })
      .catch(() => {
        this.loading = false;
      });
  }
  /** Calls a word in the device's own Chinese voice; devices without one stay with the woodblock. */
  private say(text: string, delay: number) {
    if (typeof speechSynthesis === 'undefined') return;
    const voices = speechSynthesis.getVoices(),
      voice =
        voices.find((v) => /^zh[-_]CN/i.test(v.lang)) ??
        voices.find((v) => /^zh/i.test(v.lang));
    if (!voice) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 1.1;
    utterance.pitch = 0.8;
    if (this.speech) clearTimeout(this.speech);
    this.speech = setTimeout(() => {
      this.speech = null;
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }, delay * 1000);
  }
  close(): void {
    this.silence();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.bus = null;
  }
  private output(c: AudioContext) {
    if (this.bus) return this.bus;
    let out: AudioNode = c.destination;
    if (typeof c.createDynamicsCompressor === 'function') {
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -9;
      limiter.knee.value = 8;
      limiter.ratio.value = 5;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.2;
      limiter.connect(out);
      out = limiter;
    }
    const dry = c.createGain();
    dry.connect(out);
    let wet: AudioNode | null = null;
    if (typeof c.createConvolver === 'function') {
      const room = c.createConvolver(),
        level = c.createGain();
      room.buffer = roomImpulse(c);
      level.gain.value = 0.9;
      room.connect(level);
      level.connect(out);
      wet = room;
    }
    return (this.bus = { dry, wet });
  }
  /** One sound's channel strip: placed left or right, with a send to the room. */
  private voice(c: AudioContext, kind: SoundKind, pan: number, until: number) {
    const bus = this.output(c),
      input = c.createGain(),
      nodes: AudioNode[] = [input];
    let tail: AudioNode = input;
    if (pan && typeof c.createStereoPanner === 'function') {
      const panner = c.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      input.connect(panner);
      nodes.push(panner);
      tail = panner;
    }
    tail.connect(bus.dry);
    if (bus.wet) {
      const send = c.createGain();
      send.gain.value = ROOM[kind];
      tail.connect(send);
      send.connect(bus.wet);
      nodes.push(send);
    }
    // Leave the strip up until the room has rung out, then take it down.
    setTimeout(
      () => nodes.forEach((node) => node.disconnect()),
      (until - c.currentTime + 1.5) * 1000,
    );
    return input;
  }
  private haptic(kind: SoundKind, delay: number) {
    const pattern = HAPTICS[kind];
    if (
      pattern === undefined ||
      typeof navigator === 'undefined' ||
      typeof navigator.vibrate !== 'function'
    )
      return;
    const timer = setTimeout(() => {
      this.buzz.delete(timer);
      try {
        navigator.vibrate(pattern);
      } catch {}
    }, delay * 1000);
    this.buzz.add(timer);
  }
  private track(source: AudioScheduledSourceNode) {
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
    };
  }
  /** `pan` places the sound from -1 (left) to 1 (right); see soundPan. `style` is how
   * the piece travelled (lib/motion.ts), which adds its flight to the knock. */
  play(kind: SoundKind, delay = 0, pan = 0, style: MoveStyle = 'glide'): void {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    this.haptic(kind, delay);
    const motion = pieceMotion(kind === 'capture', style);
    // Sounds of the flight start this long before the landing, when the move began.
    const flight = Math.min(delay, motion.landMs / 1000);
    // Capture's air leads into impact; `delay` always denotes the landing.
    const lead =
      kind === 'capture'
        ? Math.min(style === 'glide' ? 0.15 : 0.4, delay)
        : kind === 'move' && style !== 'glide'
          ? flight
          : 0;
    const start = c.currentTime + delay - lead;
    const out = this.voice(c, kind, pan, start + 2.4);
    const tone = (
      frequency: number,
      duration: number,
      volume: number,
      at = 0,
      endFrequency = frequency,
      decayAt = duration,
    ) => {
      const oscillator = c.createOscillator(),
        gain = c.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start + at);
      oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        start + at + duration,
      );
      gain.gain.setValueAtTime(0.001, start + at);
      gain.gain.exponentialRampToValueAtTime(volume, start + at + 0.008);
      gain.gain.exponentialRampToValueAtTime(
        volume * 0.1,
        start + at + decayAt,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + duration);
      oscillator.connect(gain);
      gain.connect(out);
      this.track(oscillator);
      oscillator.start(start + at);
      oscillator.stop(start + at + duration + 0.02);
      oscillator.addEventListener('ended', () => gain.disconnect(), {
        once: true,
      });
    };
    // No two real moves sound the same: vary force and pitch a little.
    const recorded = (at: number, volume: number, rate: number) => {
      const knock = this.knock!,
        source = c.createBufferSource(),
        gain = c.createGain();
      source.buffer = knock.buffer;
      source.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
      gain.gain.value = volume * (0.88 + Math.random() * 0.12);
      source.connect(gain);
      gain.connect(out);
      this.track(source);
      source.start(start + at, knock.offset);
      source.addEventListener('ended', () => gain.disconnect(), { once: true });
    };
    const noise = (
      frequency: number,
      endFrequency: number,
      duration: number,
      volume: number,
      at = 0,
      rise = false,
      decayAt = Math.min(0.1, duration * 0.8),
    ) => {
      const buffer = c.createBuffer(
        1,
        Math.ceil(c.sampleRate * duration),
        c.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] = Math.random() * 2 - 1;
      const source = c.createBufferSource(),
        filter = c.createBiquadFilter(),
        gain = c.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(frequency, start + at);
      filter.frequency.exponentialRampToValueAtTime(
        endFrequency,
        start + at + duration,
      );
      filter.Q.value = 1.2;
      gain.gain.setValueAtTime(rise ? volume * 0.04 : volume, start + at);
      if (rise)
        gain.gain.exponentialRampToValueAtTime(
          volume,
          start + at + duration * 0.85,
        );
      else
        gain.gain.exponentialRampToValueAtTime(
          volume * 0.1,
          start + at + decayAt,
        );
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(out);
      this.track(source);
      source.start(start + at);
      source.stop(start + at + duration);
      source.addEventListener(
        'ended',
        () => {
          filter.disconnect();
          gain.disconnect();
        },
        { once: true },
      );
    };
    // A plucked silk string, after the guqin: a bright attack that bends onto pitch, with
    // overtones that die first, so the note thins into its fundamental as it rings.
    const pluck = (
      frequency: number,
      at: number,
      volume: number,
      ring = 1.6,
    ) => {
      [1, 2, 3, 4.02].forEach((partial, i) =>
        tone(
          frequency * partial * 1.005,
          ring / (1 + i * 0.9),
          volume / (1 + i * 1.6),
          at,
          frequency * partial,
          0.12 / (1 + i),
        ),
      );
      noise(frequency * 6, frequency * 4, 0.04, volume * 2.2, at, false, 0.02);
    };
    // A war drum: a skin struck hard, its pitch falling as it rings, with the slap on top.
    const taiko = (at: number, volume: number) => {
      tone(150, 0.55, 0.26 * volume, at, 50, 0.14);
      tone(240, 0.14, 0.07 * volume, at, 110, 0.05);
      noise(220, 90, 0.1, 0.7 * volume, at, false, 0.05);
    };
    // A guzheng glissando: a finger sweeping the pentatonic strings in one breath.
    const sweep = (at: number, up: boolean, volume: number) =>
      (up ? PENTATONIC : [...PENTATONIC].reverse()).forEach((frequency, i) =>
        pluck(frequency, at + i * 0.032, volume * (0.7 + 0.03 * i), 1.2),
      );
    // The sound of the flight, ending at the landing: a rising rush of air.
    const rush = (low: number, high: number, volume: number) => {
      if (flight > 0.05) noise(low, high, flight, volume, lead - flight, true);
    };
    // A steel edge passing through: a quick hiss, then a thin ring that does not quite
    // agree with itself.
    const blade = (at: number) => {
      if (at >= 0.08) noise(1800, 7800, 0.08, 0.2, at - 0.08, true);
      for (const [frequency, volume] of [
        [2350, 0.016],
        [3170, 0.011],
        [4410, 0.008],
        [5930, 0.006],
      ])
        tone(frequency, 0.5, volume, at, frequency * 0.995, 0.06);
      noise(7200, 6400, 0.14, 0.2, at, false, 0.05);
    };
    // The horse's leg touches the board halfway through its 日.
    const hoof = () => {
      const leg = lead - (motion.landMs - motion.slideMs / 2) / 1000;
      if (style === 'gallop' && this.knock && leg >= 0)
        recorded(leg, 0.45, 1.2);
    };
    // Levels follow recordings of a wooden set: about half the energy in the
    // body below 300 Hz, a third in the 3–8 kHz click, the rest in the wood.
    switch (kind) {
      case 'select':
        // The fingertip lifts a piece: felt brushing wood, a faint high tick.
        noise(5200, 4600, 0.035, 0.26, 0, false, 0.018);
        tone(1320, 0.05, 0.02, 0, 1480, 0.02);
        break;
      case 'deal':
        // The set laid out: one light knock for each piece as it lies down.
        initialBoard().forEach((piece, square) => {
          if (!piece) return;
          const at =
            (dealDelay(square) + DEAL.durationMs * DEAL.knockAt) / 1000;
          if (this.knock) recorded(at, 0.1, 1.18 + (square % 9) * 0.015);
          else {
            tone(560 + (square % 9) * 12, 0.06, 0.018, at, 520, 0.03);
            noise(3600, 3300, 0.03, 0.18, at, false, 0.02);
          }
        });
        break;
      case 'move':
        if (style === 'charge') rush(300, 1900, 0.2);
        hoof();
        if (this.knock) {
          recorded(lead, 1, style === 'charge' ? 0.92 : 1);
          break;
        }
        // 咚: the piece meets the board; 嗒: it settles 55 ms later.
        tone(221, 0.25, 0.08, lead, 205, 0.1);
        tone(63, 0.12, 0.06, lead, 55, 0.05);
        tone(582, 0.14, 0.05, lead, 540, 0.08);
        noise(1700, 1500, 0.08, 0.8, lead, false, 0.055);
        noise(3700, 3400, 0.05, 0.7, lead, false, 0.035);
        tone(225, 0.19, 0.04, lead + 0.055, 210, 0.08);
        noise(3900, 3600, 0.04, 0.24, lead + 0.055, false, 0.025);
        break;
      case 'capture':
        // 呼—啪: air rushes in, the piece slams down, splinters settle; 「吃」.
        this.say('吃', delay);
        if (style === 'leap') {
          // The cannon's flight: air rising to the top of the arc and falling onto the
          // target, then the blast of its landing.
          noise(500, 2600, lead * 0.55, 0.22, 0, true);
          noise(2600, 700, lead * 0.45, 0.26, lead * 0.55, true);
          tone(58, 0.7, 0.24, lead, 34, 0.2);
          noise(260, 80, 0.4, 0.55, lead, false, 0.12);
        } else if (style === 'charge') rush(300, 2400, 0.3);
        else if (lead) noise(900, 4000, lead, 0.4, 0, true);
        hoof();
        blade(lead + 0.01);
        if (this.knock) {
          // The same wood, struck harder and a little lower, over a short drum.
          recorded(lead, 0.75, 0.86);
          tone(120, 0.22, 0.12, lead, 80, 0.08);
        } else {
          tone(248, 0.33, 0.15, lead, 110, 0.1);
          tone(501, 0.18, 0.09, lead, 380, 0.09);
          noise(2000, 1700, 0.08, 0.6, lead, false, 0.06);
        }
        noise(4800, 4000, 0.11, this.knock ? 0.45 : 0.65, lead, false, 0.07);
        for (const [at, volume] of [
          [0.055, 0.18],
          [0.1, 0.14],
          [0.16, 0.13],
          [0.19, 0.11],
          [0.22, 0.09],
          [0.26, 0.07],
        ])
          noise(4300, 3600, 0.05, volume, lead + at, false, 0.03);
        break;
      case 'undo':
        // Time drawn backwards: a breath sucked in, and the piece lifting off the board.
        noise(700, 2600, 0.16, 0.14, 0, true);
        tone(260, 0.1, 0.05, 0.1, 380);
        break;
      case 'check':
        // 梆梆 and a called 「将军」, as players announce it over a real board.
        this.say('将军', delay);
        taiko(0, 1);
        for (const at of [0, 0.09]) {
          tone(1250, 0.12, 0.05, at, 1180, 0.05);
          noise(2600, 2300, 0.05, 0.4, at, false, 0.03);
        }
        tone(118, 0.4, 0.12, 0, 82, 0.2);
        break;
      case 'mate':
        // Two war drums, a low swell, a big drum, then a gong ring and shimmer that fade
        // with the stamp, and the strings swept down as the general falls.
        taiko(0, 0.8);
        taiko(0.16, 1);
        sweep(0.5, false, 0.05);
        noise(140, 90, 0.08, 0.25, 0, true);
        tone(67, 1.7, 0.24, 0.07, 45, 1.1);
        tone(93, 1.3, 0.1, 0.07, 50, 0.8);
        tone(136, 0.8, 0.05, 0.07, 70, 0.4);
        noise(220, 160, 0.09, 0.3, 0.07, false, 0.06);
        tone(1090, 1.4, 0.014, 0.09, 1085, 1.2);
        tone(1520, 1.3, 0.011, 0.09, 1515, 1.1);
        noise(12000, 10000, 1.3, 0.1, 0.1, false, 1);
        // An open bass string under the gong, left to ring with the stamp.
        pluck(98, 0.12, 0.05, 2.4);
        break;
      case 'result':
        // The strings swept upwards, then the tonic struck in three octaves over a drum.
        sweep(0, true, 0.05);
        taiko(0.36, 0.7);
        pluck(392, 0.36, 0.07, 2);
        pluck(783.99, 0.36, 0.045, 2);
        pluck(196, 0.36, 0.07, 2.6);
        pluck(98, 0.36, 0.05, 2.6);
        break;
    }
  }
}
