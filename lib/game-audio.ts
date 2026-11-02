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

/** Synthesized wood, air and drum sounds; no downloaded audio or autoplay. */
export class GameAudio {
  private context: AudioContext | null = null;
  private active = new Set<AudioScheduledSourceNode>();
  unlock(): void {
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      /* Browsers without Web Audio keep the game silent. */
    }
  }
  silence(): void {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {}
    }
    this.active.clear();
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
    const lead = kind === 'capture' ? Math.min(0.12, delay) : 0;
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
    const noise = (
      frequency: number,
      endFrequency: number,
      duration: number,
      volume: number,
      at = 0,
      rise = false,
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
      gain.gain.setValueAtTime(rise ? 0.0001 : volume, start + at);
      if (rise)
        gain.gain.exponentialRampToValueAtTime(
          volume,
          start + at + duration * 0.85,
        );
      else
        gain.gain.exponentialRampToValueAtTime(
          volume * 0.1,
          start + at + Math.min(0.1, duration * 0.8),
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
    switch (kind) {
      case 'move':
        tone(221, 0.25, 0.12, 0, 205, 0.1);
        tone(582, 0.15, 0.025, 0, 540, 0.1);
        noise(3700, 3500, 0.12, 0.12);
        tone(225, 0.195, 0.055, 0.055, 210, 0.1);
        noise(3900, 3600, 0.1, 0.05, 0.055);
        break;
      case 'capture':
        if (lead) noise(800, 6000, lead, 0.13, 0, true);
        tone(248, 0.33, 0.19, lead, 110, 0.1);
        tone(501, 0.16, 0.065, lead, 380, 0.08);
        noise(6000, 4800, 0.11, 0.26, lead);
        for (const [at, volume] of [
          [0.055, 0.07],
          [0.095, 0.045],
          [0.14, 0.025],
        ])
          noise(6200, 4000, 0.07, volume, lead + at);
        break;
      case 'undo':
        tone(260, 0.1, 0.05, 0, 380);
        break;
      case 'check':
        tone(740, 0.3, 0.065);
        tone(560, 0.24, 0.045, 0.08);
        break;
      case 'mate':
        tone(67, 1.2, 0.22, 0, 45, 0.5);
        tone(93, 0.95, 0.09, 0, 45, 0.4);
        tone(136, 0.65, 0.045, 0, 60, 0.3);
        tone(1100, 1.15, 0.009, 0.02);
        tone(1520, 1.1, 0.006, 0.02);
        noise(12000, 10000, 0.9, 0.025, 0.03);
        break;
      case 'result':
        tone(392, 0.32, 0.04);
        tone(523, 0.45, 0.035, 0.15);
        break;
    }
  }
}
