'use client';
import { useEffect, useEffectEvent, useRef } from 'react';
import confetti from 'canvas-confetti';
import type { Side } from '@/lib/xiangqi';

/** Where a piece was taken, in fractions of the board, and when the blow lands. */
export type InkSplash = {
  key: string;
  x: number;
  y: number;
  delay: number;
  /** The taken piece's side: red pieces bleed cinnabar, black ones ink. */
  side: Side;
  heavy?: boolean;
};
/** The end of a game: who won (none for a draw) and whether by mate. */
export type Celebration = { key: string; side?: Side; mate: boolean };

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

type Lobe = { dx: number; dy: number; r: number; wait: number };
type Drop = { angle: number; reach: number; size: number; wait: number };
type Blot = {
  x: number;
  y: number;
  born: number;
  life: number;
  color: [number, number, number];
  lobes: Lobe[];
  drops: Drop[];
};
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

/** Ink dropped on oiled wood: a blot that blooms out of a few overlapping lobes with a
 * darker rim where the ink pools, and drops flung out in tapering streaks. It soaks in
 * and fades over two seconds. One canvas per board; it only draws while ink is wet.
 */
class InkLayer {
  private blots: Blot[] = [];
  private frame = 0;
  private context: CanvasRenderingContext2D | null;
  constructor(private canvas: HTMLCanvasElement) {
    this.context = canvas.getContext('2d');
  }
  splash(x: number, y: number, side: Side, heavy = false) {
    if (!this.context) return;
    const scale = heavy ? 1.35 : 1,
      random = (low: number, high: number) =>
        low + Math.random() * (high - low);
    this.blots.push({
      x,
      y,
      born: performance.now(),
      life: heavy ? 2600 : 2100,
      color: side === 'red' ? [150, 32, 22] : [24, 16, 11],
      lobes: Array.from({ length: heavy ? 13 : 9 }, (_, i) => ({
        dx: i ? random(-0.22, 0.22) * scale : 0,
        dy: i ? random(-0.22, 0.22) * scale : 0,
        r: (i ? random(0.16, 0.34) : 0.42) * scale,
        wait: i ? random(0, 140) : 0,
      })),
      drops: Array.from({ length: heavy ? 20 : 12 }, () => ({
        angle: random(0, Math.PI * 2),
        reach: random(0.45, 1.15) * scale,
        size: random(0.025, 0.07),
        wait: random(0, 60),
      })),
    });
    if (!this.frame) this.frame = requestAnimationFrame(this.draw);
  }
  stop() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.blots = [];
  }
  private draw = (now: number) => {
    const c = this.context!,
      canvas = this.canvas,
      ratio = Math.min(2, devicePixelRatio || 1),
      width = Math.round(canvas.clientWidth * ratio),
      height = Math.round(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    c.clearRect(0, 0, width, height);
    this.blots = this.blots.filter((blot) => now - blot.born < blot.life);
    // One file of the board: every size in a blot is measured in it.
    const unit = width / 9;
    c.globalCompositeOperation = 'multiply';
    for (const blot of this.blots) {
      const age = now - blot.born,
        soak = 1 - easeOut((age - blot.life * 0.4) / (blot.life * 0.6)),
        [red, green, blue] = blot.color,
        ink = (alpha: number) => `rgba(${red},${green},${blue},${alpha})`,
        cx = blot.x * width,
        cy = blot.y * height;
      for (const lobe of blot.lobes) {
        const grow = easeOut((age - lobe.wait) / 650);
        if (grow <= 0) continue;
        const r = lobe.r * unit * (0.35 + 0.65 * grow),
          x = cx + lobe.dx * unit * grow,
          y = cy + lobe.dy * unit * grow,
          alpha = 0.34 * soak,
          gradient = c.createRadialGradient(x, y, 0, x, y, r);
        gradient.addColorStop(0, ink(alpha * 0.7));
        gradient.addColorStop(0.72, ink(alpha));
        gradient.addColorStop(0.88, ink(alpha * 0.75));
        gradient.addColorStop(1, ink(0));
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
      }
      for (const drop of blot.drops) {
        const fly = easeOut((age - drop.wait) / 240);
        if (fly <= 0) continue;
        // A drop in flight is a teardrop pointing the way it goes; once it lands it is a
        // round spot that spreads a little into the grain.
        const dx = Math.cos(drop.angle),
          dy = Math.sin(drop.angle),
          head = (0.4 + drop.reach * fly) * unit,
          size = drop.size * unit * (1 + 0.35 * easeOut((age - 240) / 500)),
          stretch = 1 + 1.8 * (1 - fly),
          x = cx + dx * head,
          y = cy + dy * head;
        c.fillStyle = ink(0.55 * soak);
        c.beginPath();
        c.ellipse(x, y, size * stretch, size, drop.angle, 0, Math.PI * 2);
        c.fill();
      }
    }
    this.frame = this.blots.length ? requestAnimationFrame(this.draw) : 0;
    if (!this.frame) c.clearRect(0, 0, width, height);
  };
}

const PETAL = 'M10 0C16 5 16 13 10 20C4 13 4 5 10 0Z';
/** Winners are showered with what fits their colour: plum blossom and gold leaf for red,
 * pear blossom and gold leaf for black; a draw gets the gold leaf alone. */
const PALETTES: Record<Side | 'draw', string[]> = {
  red: ['#e2566c', '#f39aac', '#c42a43', '#ffd0d8'],
  black: ['#fbf8f0', '#e9e3d4', '#d6cfbd', '#ffffff'],
  draw: [],
};
const GOLD = ['#f6d27a', '#e0a93b', '#fff1c1', '#c98a26'];

/** The board's paint layers: ink that soaks into the wood at a capture and the shower
 * at the end of a game. Both stay still for anyone who asks for reduced motion. */
export default function BoardFx({
  ink,
  celebrate,
}: {
  ink: InkSplash | null;
  celebrate: Celebration | null;
}) {
  const inkCanvas = useRef<HTMLCanvasElement>(null),
    showerCanvas = useRef<HTMLCanvasElement>(null),
    layer = useRef<InkLayer | null>(null);
  // Each splash belongs to one capture (its key); re-renders of it must not repeat it.
  const inkKey = ink?.key;
  const startInk = useEffectEvent(() => {
    if (!ink || !inkCanvas.current || reducedMotion()) return;
    layer.current ??= new InkLayer(inkCanvas.current);
    return setTimeout(
      () => layer.current?.splash(ink.x, ink.y, ink.side, ink.heavy),
      ink.delay,
    );
  });
  useEffect(() => {
    if (!inkKey) return;
    const timer = startInk();
    return () => clearTimeout(timer);
  }, [inkKey]);
  useEffect(() => () => layer.current?.stop(), []);
  const showerKey = celebrate?.key;
  const startShower = useEffectEvent(() => {
    if (!celebrate || !showerCanvas.current || reducedMotion()) return;
    const fire = confetti.create(showerCanvas.current, {
      resize: true,
      disableForReducedMotion: true,
    });
    const petal = confetti.shapeFromPath({ path: PETAL }),
      petals = PALETTES[celebrate.side ?? 'draw'],
      timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, run: () => void) =>
      timers.push(setTimeout(run, ms));
    // The stamp lands first; then gold bursts from the lower corners...
    // The shower runs by itself; nothing waits for it to finish.
    const burst = (x: number, angle: number) =>
      void fire({
        particleCount: celebrate.mate ? 70 : 45,
        angle,
        spread: 52,
        startVelocity: celebrate.mate ? 52 : 44,
        origin: { x, y: 1.02 },
        colors: GOLD,
        shapes: ['square'],
        scalar: 1.15,
        gravity: 0.9,
        ticks: 260,
      });
    at(420, () => {
      burst(0, 62);
      burst(1, 118);
    });
    // ...and petals drift down from above for a while, turning as they fall.
    for (let i = 0; i < (celebrate.mate ? 14 : 10); i++)
      at(
        620 + i * 170,
        () =>
          void fire({
            particleCount: 6,
            angle: 270,
            spread: 70,
            startVelocity: 6,
            origin: { x: Math.random(), y: -0.06 },
            colors: petals.length ? petals : GOLD,
            shapes: petals.length ? [petal] : ['square'],
            scalar: petals.length ? 1.6 : 1,
            gravity: 0.35,
            drift: Math.random() - 0.3,
            ticks: 520,
            flat: false,
          }),
      );
    return () => {
      timers.forEach(clearTimeout);
      fire.reset();
    };
  });
  useEffect(() => (showerKey ? startShower() : undefined), [showerKey]);
  return (
    <>
      <canvas ref={inkCanvas} className="board-ink" aria-hidden="true" />
      <canvas ref={showerCanvas} className="board-shower" aria-hidden="true" />
    </>
  );
}
