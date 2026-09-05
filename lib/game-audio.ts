import type { SoundKind } from './presentation';

/** Small synthesized wood and bell sounds; no downloaded audio or autoplay. */
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
    const start = c.currentTime + delay;
    const tone = (
      frequency: number,
      duration: number,
      volume: number,
      at = 0,
      endFrequency = frequency,
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
      gain.gain.exponentialRampToValueAtTime(0.001, start + at + duration);
      oscillator.connect(gain);
      gain.connect(c.destination);
      this.track(oscillator);
      oscillator.start(start + at);
      oscillator.stop(start + at + duration + 0.02);
      oscillator.addEventListener('ended', () => gain.disconnect(), {
        once: true,
      });
    };
    const knock = (volume: number, at = 0) => {
      const duration = 0.095,
        buffer = c.createBuffer(
          1,
          Math.ceil(c.sampleRate * duration),
          c.sampleRate,
        );
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] =
          (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 3);
      const source = c.createBufferSource(),
        filter = c.createBiquadFilter(),
        gain = c.createGain();
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.frequency.value = 1400;
      filter.Q.value = 0.85;
      gain.gain.setValueAtTime(volume, start + at);
      gain.gain.exponentialRampToValueAtTime(0.001, start + at + duration);
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
        knock(0.16);
        tone(360, 0.09, 0.075, 0, 190);
        break;
      case 'capture':
        knock(0.35);
        tone(230, 0.17, 0.14, 0, 85);
        knock(0.11, 0.06);
        break;
      case 'undo':
        tone(260, 0.1, 0.05, 0, 380);
        break;
      case 'check':
        tone(740, 0.3, 0.065);
        tone(560, 0.24, 0.045, 0.08);
        break;
      case 'mate':
        tone(196, 0.7, 0.07);
        tone(392, 0.5, 0.055, 0.09);
        tone(587, 0.65, 0.04, 0.2);
        break;
      case 'result':
        tone(392, 0.32, 0.04);
        tone(523, 0.45, 0.035, 0.15);
        break;
    }
  }
}
