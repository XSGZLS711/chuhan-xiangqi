import type { BoardEffect as Effect } from '@/lib/presentation';
export default function BoardEffect({ effect }: { effect: Effect | null }) {
  if (!effect) return null;
  return (
    <output
      key={effect.id}
      className={`board-effect effect-${effect.kind} ${effect.side ?? ''}`}
      aria-live="polite"
    >
      <div className="effect-inscription">
        <span className="effect-overline">
          {effect.analysis
            ? '独立推演'
            : effect.kind === 'check'
              ? '楚河汉界'
              : '胜负已定'}
        </span>
        <strong>{effect.title}</strong>
        <span className="effect-detail">{effect.detail}</span>
      </div>
    </output>
  );
}
