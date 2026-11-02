import type { SoundKind } from './presentation';
import { pieceMotion } from './motion';

/** Delay to impact, in seconds. Follow-up feedback comes after the landing. */
export function soundDelay(
  sounds: SoundKind[],
  index: number,
  reducedMotion = typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches,
): number {
  const moving = sounds[0] === 'move' || sounds[0] === 'capture';
  if (!moving) return 0;
  const landing = reducedMotion
    ? 0
    : pieceMotion(sounds[0] === 'capture').landMs / 1000;
  return landing + (index ? 0.18 : 0);
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
  }
  private track(source: AudioScheduledSourceNode) {
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
    };
  }
  play(kind: SoundKind, delay = 0): void {
    const c = this.context;
    if (!c || c.state !== 'running') return;
    // Capture's air leads into impact; `delay` always denotes the landing.
    const lead = kind === 'capture' ? Math.min(0.15, delay) : 0;
    const start = c.currentTime + delay - lead;
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
      gain.connect(c.destination);
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
      gain.connect(c.destination);
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
      gain.connect(c.destination);
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
    // Levels follow recordings of a wooden set: about half the energy in the
    // body below 300 Hz, a third in the 3–8 kHz click, the rest in the wood.
    switch (kind) {
      case 'move':
        if (this.knock) {
          recorded(0, 1, 1);
          break;
        }
        // 咚: the piece meets the board; 嗒: it settles 55 ms later.
        tone(221, 0.25, 0.08, 0, 205, 0.1);
        tone(63, 0.12, 0.06, 0, 55, 0.05);
        tone(582, 0.14, 0.05, 0, 540, 0.08);
        noise(1700, 1500, 0.08, 0.8, 0, false, 0.055);
        noise(3700, 3400, 0.05, 0.7, 0, false, 0.035);
        tone(225, 0.19, 0.04, 0.055, 210, 0.08);
        noise(3900, 3600, 0.04, 0.24, 0.055, false, 0.025);
        break;
      case 'capture':
        // 呼—啪: air rushes in, the piece slams down, splinters settle; 「吃」.
        this.say('吃', delay);
        if (lead) noise(900, 4000, lead, 0.4, 0, true);
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
        tone(260, 0.1, 0.05, 0, 380);
        break;
      case 'check':
        // 梆梆 and a called 「将军」, as players announce it over a real board.
        this.say('将军', delay);
        for (const at of [0, 0.09]) {
          tone(1250, 0.12, 0.05, at, 1180, 0.05);
          noise(2600, 2300, 0.05, 0.4, at, false, 0.03);
        }
        tone(118, 0.4, 0.12, 0, 82, 0.2);
        break;
      case 'mate':
        // A low swell, a big drum, then a gong ring and shimmer that fade with the stamp.
        noise(140, 90, 0.08, 0.25, 0, true);
        tone(67, 1.7, 0.24, 0.07, 45, 1.1);
        tone(93, 1.3, 0.1, 0.07, 50, 0.8);
        tone(136, 0.8, 0.05, 0.07, 70, 0.4);
        noise(220, 160, 0.09, 0.3, 0.07, false, 0.06);
        tone(1090, 1.4, 0.014, 0.09, 1085, 1.2);
        tone(1520, 1.3, 0.011, 0.09, 1515, 1.1);
        noise(12000, 10000, 1.3, 0.1, 0.1, false, 1);
        break;
      case 'result':
        tone(392, 0.32, 0.04);
        tone(523, 0.45, 0.035, 0.15);
        break;
    }
  }
}
