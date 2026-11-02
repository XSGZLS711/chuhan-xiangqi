import { useId, type CSSProperties } from 'react';
import { RATING_LABELS, type AnalysisScore } from '@/lib/game-analysis';
import {
  redShare,
  scoreText,
  type GamePhases,
  type ReviewPoint,
} from '@/lib/review';

const W = 1000,
  H = 400;
const css = (vars: Record<string, string | number>) => vars as CSSProperties;
// The axis grows in steps people can read, never tighter than ±200.
const SCALES = [200, 300, 500, 800, 1000];

/** Advantage over the game: red above the line, black below; tap or drag to jump. */
export function EvalChart({
  series,
  ply,
  phases,
  onPly,
}: {
  series: ReviewPoint[];
  ply: number;
  phases: GamePhases;
  onPly: (ply: number) => void;
}) {
  const id = useId();
  const plies = Math.max(1, series.length - 1);
  const peak = Math.max(0, ...series.map((p) => Math.abs(p.value ?? 0)));
  const scale = SCALES.find((s) => s >= peak * 1.1) ?? 1000;
  const x = (p: number) => (p / plies) * W,
    y = (v: number) => H / 2 - (v / scale) * (H / 2) * 0.9;
  const pct = (p: number, v: number) =>
    css({ '--x': `${(x(p) / W) * 100}%`, '--y': `${(y(v) / H) * 100}%` });
  let path = '',
    pen = false;
  for (const point of series) {
    if (point.value === null) {
      pen = false;
      continue;
    }
    path += `${pen ? 'L' : 'M'}${x(point.ply)} ${y(point.value)}`;
    pen = true;
  }
  const current = series[Math.min(ply, series.length - 1)];
  return (
    <div className="eval-chart">
      <div className="eval-chart-area">
        <span
          className="chart-scale red"
          style={css({ '--y': `${(y(scale) / H) * 100}%` })}
        >
          红优 {scale}
        </span>
        <span
          className="chart-scale"
          style={css({ '--y': `${(y(-scale) / H) * 100}%` })}
        >
          黑优 {scale}
        </span>
        {/* Inset so the first and last moves are not clipped by the frame. */}
        <div className="eval-chart-plot">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <clipPath id={`${id}-red`}>
                <rect x="0" y="0" width={W} height={H / 2} />
              </clipPath>
              <clipPath id={`${id}-black`}>
                <rect x="0" y={H / 2} width={W} height={H / 2} />
              </clipPath>
            </defs>
            {[-1, -0.5, 0.5, 1].map((f) => (
              <line
                key={f}
                className="chart-grid"
                x1="0"
                x2={W}
                y1={y(f * scale)}
                y2={y(f * scale)}
              />
            ))}
            <line className="chart-zero" x1="0" x2={W} y1={H / 2} y2={H / 2} />
            {[phases.middle, phases.end].map(
              (at) =>
                at !== null && (
                  <line
                    key={at}
                    className="chart-phase"
                    x1={x(at)}
                    x2={x(at)}
                    y1="0"
                    y2={H}
                  />
                ),
            )}
            <line
              className="chart-cursor"
              x1={x(ply)}
              x2={x(ply)}
              y1="0"
              y2={H}
            />
            {path && (
              <>
                <path
                  className="chart-line red"
                  d={path}
                  clipPath={`url(#${id}-red)`}
                />
                <path
                  className="chart-line black"
                  d={path}
                  clipPath={`url(#${id}-black)`}
                />
              </>
            )}
          </svg>
          {phases.middle !== null && (
            <span className="chart-phase-tag" style={pct(phases.middle, scale)}>
              中局
            </span>
          )}
          {phases.end !== null && (
            <span
              className="chart-phase-tag end"
              style={pct(phases.end, scale)}
            >
              残局
            </span>
          )}
          {series.map(
            (p) =>
              p.rating &&
              p.value !== null && (
                <i
                  key={p.ply}
                  className={`chart-dot rating-${p.rating}`}
                  style={pct(p.ply, p.value)}
                  title={`第 ${p.ply} 步 · ${RATING_LABELS[p.rating]}`}
                />
              ),
          )}
          {current && current.value !== null && (
            <i
              className="chart-dot current"
              style={pct(current.ply, current.value)}
            />
          )}
          {/* A native range covers the chart: click, drag and arrow keys all jump. */}
          <input
            className="chart-range"
            type="range"
            min={0}
            max={series.length - 1}
            step={1}
            value={ply}
            aria-label="局势图：选择步数"
            aria-valuetext={`第 ${ply} 步 · ${!current || current.value === null ? '分析中' : scoreText({ kind: 'cp', value: current.value })}`}
            onChange={(event) => onPly(Number(event.target.value))}
          />
        </div>
      </div>
      <div className="eval-chart-ticks" aria-hidden="true">
        <span>开局</span>
        <span>
          第 {ply} / {series.length - 1} 步
        </span>
      </div>
    </div>
  );
}

/** Vertical advantage bar beside the board; red's share faces red's side. */
export function EvalBar({
  score,
  flipped,
}: {
  score: AnalysisScore | null;
  flipped: boolean;
}) {
  const share = redShare(score);
  const [side, value = ''] = scoreText(score).split(' ');
  return (
    <div className={`eval-bar ${flipped ? 'flipped' : ''}`}>
      <div className="eval-bar-track" aria-hidden="true">
        <span style={css({ '--share': `${share * 100}%` })} />
      </div>
      <output aria-label={`局势：${scoreText(score)}`}>
        <b>{side}</b>
        {value && <small>{value}</small>}
      </output>
    </div>
  );
}
