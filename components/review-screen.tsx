'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Eye,
  GitBranch,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
} from 'lucide-react';
import ChessBoard, {
  type BoardArrow,
  type BoardMark,
} from '@/components/chess-board';
import { EvalBar, EvalChart } from '@/components/eval-chart';
import { archiveLabel, type ArchivedGame } from '@/lib/archive';
import { RATING_LABELS } from '@/lib/game-analysis';
import type { useGameAnalysis } from '@/lib/use-game-analysis';
import {
  PHASE_LABELS,
  gamePhases,
  moveComparison,
  moveNumber,
  playedScore,
  reviewReport,
  reviewSeries,
  scoreAt,
  scoreText,
  type LineStep,
  type Phase,
} from '@/lib/review';
import {
  legalMove,
  legalTargets,
  sideLabel,
  type Board,
  type Move,
  type Side,
} from '@/lib/xiangqi';

type Tab = 'chart' | 'analysis' | 'report' | 'practice';
const TABS: [Tab, string][] = [
  ['chart', '局势图'],
  ['analysis', '分析'],
  ['report', '报告'],
  ['practice', '练习'],
];
type Line = { kind: 'best' | 'actual'; step: number; playing: boolean };
type Practice = {
  ply: number;
  selected: number | null;
  state: 'trying' | 'wrong' | 'solved' | 'revealed';
  hint: boolean;
};
const PHASES: Phase[] = ['opening', 'middle', 'end'];

/** Whole-game review: advantage graph, move-by-move comparison, report and drills. */
export default function ReviewScreen({
  game,
  history,
  finalBoard,
  flipped,
  ply,
  onPly,
  analysis,
  onExplore,
  onExit,
  exitLabel,
}: {
  game: ArchivedGame;
  history: readonly Move[];
  finalBoard: Board;
  flipped: boolean;
  /** The position after this many moves. */
  ply: number;
  onPly: (ply: number) => void;
  analysis: ReturnType<typeof useGameAnalysis>;
  onExplore: () => void;
  onExit: () => void;
  exitLabel: string;
}) {
  const [tab, setTab] = useState<Tab>('chart');
  const [line, setLine] = useState<Line | null>(null);
  const [practice, setPractice] = useState<Practice | null>(null);
  const [practiceSide, setPracticeSide] = useState<Side>(
    game.viewerSide ?? 'red',
  );
  const total = history.length;
  const data = analysis.analysis;
  const series = useMemo(() => reviewSeries(data, total), [data, total]);
  const phases = useMemo(
    () => gamePhases(history, finalBoard),
    [history, finalBoard],
  );
  const report = useMemo(
    () => reviewReport(history, data, phases),
    [history, data, phases],
  );
  const compared = useMemo(
    () => moveComparison(history, data, ply),
    [history, data, ply],
  );
  const drill = useMemo(
    () => (practice ? moveComparison(history, data, practice.ply) : null),
    [history, data, practice],
  );
  const done = data?.moves.filter((m) => m.status === 'complete').length ?? 0;

  // The review opens straight into analysis, like a coach who has already watched.
  useEffect(() => {
    if (analysis.enabled && analysis.status === 'idle') analysis.start();
  }, [analysis]);
  const steps: LineStep[] =
    line && compared
      ? line.kind === 'best'
        ? compared.best
        : compared.actual
      : [];
  const playing = !!line?.playing && line.step < steps.length;
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(
      () => setLine((l) => l && { ...l, step: l.step + 1 }),
      line?.step ? 900 : 350,
    );
    return () => clearTimeout(timer);
  }, [playing, line?.step]);

  function go(next: number) {
    setLine(null);
    setPractice(null);
    onPly(Math.max(0, Math.min(total, next)));
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input, [role="slider"]')
      )
        return;
      if (event.key === 'ArrowLeft') go(ply - 1);
      if (event.key === 'ArrowRight') go(ply + 1);
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  // What the board shows: a drill, a variation, or the game itself.
  let board = ply < total ? history[ply].before : finalBoard,
    last: { from: number; to: number } | null = ply ? history[ply - 1] : null,
    boardFlipped = flipped,
    score = scoreAt(data, ply);
  const arrows: BoardArrow[] = [],
    marks: BoardMark[] = [];
  if (practice && drill) {
    const best = drill.best[0],
      move = drill.played;
    boardFlipped = move.side === 'black';
    score = scoreAt(data, practice.ply - 1);
    if (
      (practice.state === 'solved' || practice.state === 'revealed') &&
      best
    ) {
      board = best.board;
      last = best;
      arrows.push({ from: best.from, to: best.to, tone: 'best' });
      marks.push({ at: best.to, text: '★', tone: 'best' });
    } else {
      board = move.before;
      last = practice.ply > 1 ? history[practice.ply - 2] : null;
      arrows.push({ from: move.from, to: move.to, tone: 'played' });
      if (practice.hint && best)
        marks.push({ at: best.from, text: '', tone: 'hint' });
    }
  } else if (line && compared) {
    const shown = line.step
        ? steps[Math.min(line.step, steps.length) - 1]
        : null,
      next = steps[line.step];
    board = shown?.board ?? compared.played.before;
    last = shown ?? (ply > 1 ? history[ply - 2] : null);
    if (next)
      arrows.push({
        from: next.from,
        to: next.to,
        tone: line.kind === 'best' ? 'best' : 'played',
      });
  } else if (compared?.result) {
    const best = compared.best[0],
      move = compared.played;
    if (compared.result.rating)
      marks.push({
        at: move.to,
        text: RATING_LABELS[compared.result.rating],
        tone: `rating-${compared.result.rating}`,
      });
    if (best && (best.from !== move.from || best.to !== move.to))
      arrows.push({ from: best.from, to: best.to, tone: 'best' });
    else if (best && !compared.result.rating)
      marks.push({ at: move.to, text: '★', tone: 'best' });
  }
  const drillSide = drill?.played.side ?? null;
  const targets =
    practice?.selected != null && drill
      ? legalTargets(drill.played.before, practice.selected)
      : [];
  function square(n: number) {
    if (
      !practice ||
      !drill ||
      practice.state === 'solved' ||
      practice.state === 'revealed'
    )
      return;
    const { before, side } = drill.played,
      best = drill.best[0];
    if (
      practice.selected !== null &&
      legalMove(before, practice.selected, n, side)
    ) {
      const correct =
        !!best && best.from === practice.selected && best.to === n;
      setPractice({
        ...practice,
        selected: null,
        state: correct ? 'solved' : 'wrong',
      });
      return;
    }
    setPractice({
      ...practice,
      selected: before[n]?.side === side && n !== practice.selected ? n : null,
    });
  }
  function startDrill(at: number) {
    setLine(null);
    onPly(at - 1);
    setPractice({ ply: at, selected: null, state: 'trying', hint: false });
  }

  const label = archiveLabel(game);
  const mistakes = report[practiceSide].mistakes;
  const drillIndex = practice
    ? mistakes.findIndex((m) => m.ply === practice.ply)
    : -1;

  function lineControls(kind: Line['kind'], moves: LineStep[]) {
    const active = line?.kind === kind ? line : null;
    const step = active?.step ?? 0;
    return (
      <div className="line-controls">
        <button
          aria-label={active?.playing ? '暂停变化' : '播放变化'}
          disabled={!moves.length}
          onClick={() =>
            setLine(
              active?.playing && step < moves.length
                ? { ...active, playing: false }
                : { kind, step: step < moves.length ? step : 0, playing: true },
            )
          }
        >
          {active?.playing && step < moves.length ? <Pause /> : <Play />}
        </button>
        <button
          aria-label="变化上一着"
          disabled={!active || step === 0}
          onClick={() => setLine({ kind, step: step - 1, playing: false })}
        >
          <ChevronLeft />
        </button>
        <button
          aria-label="变化下一着"
          disabled={!moves.length || step >= moves.length}
          onClick={() => setLine({ kind, step: step + 1, playing: false })}
        >
          <ChevronRight />
        </button>
      </div>
    );
  }

  function analysisTab() {
    if (!ply)
      return (
        <p className="review-empty">
          在局势图上点一步，或按「下一步」开始逐步分析。
        </p>
      );
    if (!compared) return null;
    const { played, result, best, actual } = compared;
    if (!result)
      return <p className="review-empty">这一步还在分析，稍等片刻。</p>;
    const same =
      best[0] && best[0].from === played.from && best[0].to === played.to;
    return (
      <div className="review-compare">
        <div
          className={`compare-row played ${line?.kind === 'actual' ? 'active' : ''}`}
        >
          <span className={`compare-who ${played.side}`}>实战</span>
          <div className="compare-move">
            <strong>
              {moveNumber(ply, played.side)} {played.text}
            </strong>
            {result.rating && (
              <span className={`move-rating rating-${result.rating}`}>
                {RATING_LABELS[result.rating]}
              </span>
            )}
            <small>{scoreText(playedScore(result))}</small>
          </div>
          {lineControls('actual', actual)}
        </div>
        <div
          className={`compare-row best ${line?.kind === 'best' ? 'active' : ''}`}
        >
          <span className="compare-who engine">推荐</span>
          <div className="compare-move">
            <strong>
              {moveNumber(ply, played.side)} {best[0]?.text ?? '—'}
            </strong>
            <span className="best-star" aria-label="引擎首选">
              ★
            </span>
            <small>
              {same ? '与实战相同' : scoreText(result.before.score)}
            </small>
          </div>
          {lineControls('best', best)}
        </div>
        {line && (
          <div className="line-moves">
            <ol>
              {steps.map((s, i) => (
                <li
                  key={i}
                  className={
                    i < line.step ? 'played' : i === line.step ? 'next' : ''
                  }
                >
                  <button
                    onClick={() =>
                      setLine({ ...line, step: i + 1, playing: false })
                    }
                  >
                    {s.text}
                  </button>
                </li>
              ))}
            </ol>
            <button className="line-exit" onClick={() => setLine(null)}>
              回到实战局面
            </button>
          </div>
        )}
      </div>
    );
  }

  function reportTab() {
    const cell = (v: number | null) => (v === null ? '—' : `${v}分`);
    const side = (s: Side) => (
      <div className={`report-side ${s}`}>
        <span>{game.players[s]}</span>
        <strong>{report[s].overall ?? '—'}</strong>
        <small>综合表现</small>
      </div>
    );
    const rows: [string, (s: Side) => string][] = [
      ...PHASES.map(
        (p) =>
          [
            `${PHASE_LABELS[p]}评分`,
            (s: Side) => cell(report[s].phases[p]),
          ] as [string, (s: Side) => string],
      ),
      [
        '错 / 差 / 中',
        (s) => {
          const c = report[s].counts;
          return `${c.blunder + c['allowed-mate']} / ${c.mistake} / ${c.inaccuracy}`;
        },
      ],
      ['漏杀', (s) => String(report[s].counts['missed-mate'])],
    ];
    return (
      <div className="review-report">
        <div className="report-sides">
          {side('red')}
          <div className="report-result">
            <b>{label.result}</b>
            <small>{game.result.reason}</small>
          </div>
          {side('black')}
        </div>
        <table className="report-table">
          <tbody>
            {rows.map(([name, value]) => (
              <tr key={name}>
                <td>{value('red')}</td>
                <th scope="row">{name}</th>
                <td>{value('black')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="report-mistakes">
          {(['red', 'black'] as Side[]).map((s) => (
            <section key={s} aria-label={`${sideLabel(s)}失误`}>
              <h4>{sideLabel(s)}失误</h4>
              {report[s].mistakes.length ? (
                <ul>
                  {report[s].mistakes.map((m) => (
                    <li key={m.ply}>
                      <button
                        onClick={() => {
                          go(m.ply);
                          setTab('analysis');
                        }}
                      >
                        <span>{moveNumber(m.ply, m.side)}</span> {m.text}
                        <i className={`move-rating rating-${m.rating}`}>
                          {RATING_LABELS[m.rating]}
                        </i>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>{done < total ? '分析完成后显示' : '没有明显失误'}</p>
              )}
            </section>
          ))}
        </div>
        <small className="review-note">
          分数为引擎估计，不同设备和搜索时间会略有差异。
        </small>
      </div>
    );
  }

  function practiceTab() {
    const best = drill?.best[0];
    const message = !practice
      ? '选一处失误，回到当时的局面重新走。'
      : practice.state === 'solved'
        ? `正确！${best?.text ?? ''} 正是引擎首选。`
        : practice.state === 'revealed'
          ? `答案：${best?.text ?? '—'}`
          : practice.state === 'wrong'
            ? '这步不是引擎首选，再想想。'
            : `轮到${drillSide ? sideLabel(drillSide) : ''}走：找出比实战更好的一步。`;
    return (
      <div className="review-practice">
        <div className="practice-head">
          <div className="practice-sides">
            {(['red', 'black'] as Side[]).map((s) => (
              <button
                key={s}
                aria-pressed={practiceSide === s}
                onClick={() => {
                  setPracticeSide(s);
                  setPractice(null);
                }}
              >
                {sideLabel(s)}失误 {report[s].mistakes.length}
              </button>
            ))}
          </div>
          <p
            className={`practice-message ${practice?.state ?? ''}`}
            aria-live="polite"
          >
            {message}
          </p>
        </div>
        {mistakes.length ? (
          <ul className="practice-list">
            {mistakes.map((m) => (
              <li key={m.ply}>
                <button
                  aria-current={practice?.ply === m.ply}
                  onClick={() => startDrill(m.ply)}
                >
                  <span>{moveNumber(m.ply, m.side)}</span> {m.text}
                  <i className={`move-rating rating-${m.rating}`}>
                    {RATING_LABELS[m.rating]}
                  </i>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="review-empty">
            {done < total
              ? '分析完成后列出失误。'
              : `${sideLabel(practiceSide)}没有明显失误。`}
          </p>
        )}
        {practice && (
          <div className="practice-actions">
            <button
              onClick={() => setPractice({ ...practice, hint: true })}
              disabled={
                practice.hint ||
                practice.state === 'solved' ||
                practice.state === 'revealed'
              }
            >
              <Lightbulb /> 提示
            </button>
            <button
              onClick={() =>
                setPractice({ ...practice, state: 'revealed', selected: null })
              }
              disabled={
                practice.state === 'solved' || practice.state === 'revealed'
              }
            >
              <Eye /> 答案
            </button>
            <button
              onClick={() =>
                setPractice({
                  ...practice,
                  state: 'trying',
                  hint: false,
                  selected: null,
                })
              }
            >
              <RotateCcw /> 重走
            </button>
            <button
              disabled={drillIndex < 0 || drillIndex >= mistakes.length - 1}
              onClick={() => startDrill(mistakes[drillIndex + 1].ply)}
            >
              <SkipForward /> 下一个
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <main className="review-screen">
      <header className="review-header">
        <button className="review-icon" onClick={onExit} aria-label={exitLabel}>
          <ArrowLeft />
        </button>
        <div>
          <strong>复盘分析</strong>
          <span>
            {game.players.red} · {game.players.black} · {label.result}
          </span>
        </div>
        <span className="review-ply">
          {ply} / {total}
        </span>
      </header>
      <div className="review-stage">
        <div className="review-board">
          <ChessBoard
            board={board}
            flipped={boardFlipped}
            selected={practice?.selected ?? null}
            targets={targets}
            last={last}
            onSquare={square}
            arrows={arrows}
            marks={marks}
            captureEffects={false}
            animationContext={
              practice
                ? `review-drill-${practice.ply}`
                : line
                  ? `review-line-${line.kind}`
                  : 'review'
            }
          />
        </div>
        <EvalBar score={score} flipped={boardFlipped} />
      </div>
      <div className="review-body">
        {(analysis.busy ||
          analysis.status === 'error' ||
          !analysis.enabled ||
          done < total) && (
          <div className="review-progress" aria-live="polite">
            {analysis.status === 'error' ? (
              <>
                <span>{analysis.error || '分析中断'}</span>
                <button onClick={analysis.start}>重试</button>
              </>
            ) : (
              <>
                <span>
                  {!analysis.enabled
                    ? '正在准备引擎…'
                    : `引擎分析中 ${done} / ${total}`}
                </span>
                <progress max={Math.max(1, total)} value={done} />
              </>
            )}
          </div>
        )}
        <div className="review-tabs" role="tablist" aria-label="复盘内容">
          {TABS.map(([key, name]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                if (key !== 'practice') setPractice(null);
                if (key !== 'analysis') setLine(null);
              }}
            >
              {name}
            </button>
          ))}
        </div>
        <section className="review-panel" role="tabpanel">
          {tab === 'chart' && (
            <>
              <EvalChart series={series} ply={ply} phases={phases} onPly={go} />
              <p className="chart-caption">
                {ply
                  ? `${moveNumber(ply, history[ply - 1].side)} ${history[ply - 1].text} · ${scoreText(scoreAt(data, ply))}`
                  : `开局 · ${scoreText(scoreAt(data, 0))}`}
                {compared?.result?.rating && (
                  <span
                    className={`move-rating rating-${compared.result.rating}`}
                  >
                    {RATING_LABELS[compared.result.rating]}
                  </span>
                )}
              </p>
            </>
          )}
          {tab === 'analysis' && analysisTab()}
          {tab === 'report' && reportTab()}
          {tab === 'practice' && practiceTab()}
        </section>
      </div>
      <footer className="review-nav">
        <button onClick={() => go(0)} disabled={!ply} aria-label="回到开局">
          <ChevronFirst />
        </button>
        <button onClick={() => go(ply - 1)} disabled={!ply}>
          <ChevronLeft /> 上一步
        </button>
        <button onClick={() => go(ply + 1)} disabled={ply >= total}>
          下一步 <ChevronRight />
        </button>
        <button
          onClick={() => go(total)}
          disabled={ply >= total}
          aria-label="到终局"
        >
          <ChevronLast />
        </button>
        <button
          onClick={onExplore}
          disabled={!!practice}
          aria-label="从这里推演"
        >
          <GitBranch /> 推演
        </button>
      </footer>
    </main>
  );
}
