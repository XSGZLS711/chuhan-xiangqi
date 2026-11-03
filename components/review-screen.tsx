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
import { ratingLabel } from '@/lib/game-analysis';
import { errorText } from '@/lib/errors';
import { playerName, reasonText, sideName } from '@/lib/i18n';
import type { useGameAnalysis } from '@/lib/use-game-analysis';
import { useLocale } from '@/lib/use-locale';
import {
  gamePhases,
  moveComparison,
  moveNumber,
  phaseLabel,
  playedScore,
  reviewReport,
  reviewSeries,
  scoreAt,
  scoreText,
  type LineStep,
  type Phase,
} from '@/lib/review';
import { explainMove, type Commentary } from '@/lib/explain';
import { historyMoveText } from '@/lib/notation';
import {
  legalMove,
  legalTargets,
  type Board,
  type Move,
  type Side,
} from '@/lib/xiangqi';

type Tab = 'chart' | 'analysis' | 'report' | 'practice';
const TABS: Tab[] = ['chart', 'analysis', 'report', 'practice'];
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
  exitTo,
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
  /** Where leaving the review goes, for the back button's label. */
  exitTo: 'club' | 'game';
}) {
  const { locale, t, notation } = useLocale();
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
    () => reviewReport(history, data, phases, notation),
    [history, data, phases, notation],
  );
  const compared = useMemo(
    () => moveComparison(history, data, ply, notation),
    [history, data, ply, notation],
  );
  // Commentary only for rated moves: a good move needs no excuse.
  const commentary = useMemo(
    () =>
      compared?.result?.rating
        ? explainMove(compared.played, compared.result, locale, notation)
        : null,
    [compared, locale, notation],
  );
  const drill = useMemo(
    () =>
      practice ? moveComparison(history, data, practice.ply, notation) : null,
    [history, data, practice, notation],
  );
  const drillCommentary = useMemo(
    () =>
      drill?.result?.rating
        ? explainMove(drill.played, drill.result, locale, notation)
        : null,
    [drill, locale, notation],
  );
  const done = data?.moves.filter((m) => m.status === 'complete').length ?? 0;

  // The review opens straight into analysis, like a coach who has already watched.
  useEffect(() => {
    if (analysis.enabled && analysis.status === 'idle') analysis.start();
  }, [analysis]);
  // Lines step through the drill's position while practising, else the game's.
  const lines = practice ? drill : compared;
  const steps: LineStep[] =
    line && lines ? (line.kind === 'best' ? lines.best : lines.actual) : [];
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
      if (tab !== 'chart' && tab !== 'analysis') return;
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
    if (line) {
      const shown = line.step
          ? steps[Math.min(line.step, steps.length) - 1]
          : null,
        next = steps[line.step];
      board = shown?.board ?? move.before;
      last = shown ?? (practice.ply > 1 ? history[practice.ply - 2] : null);
      if (next)
        arrows.push({
          from: next.from,
          to: next.to,
          tone: line.kind === 'best' ? 'best' : 'played',
        });
    } else if (
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
        text: ratingLabel(locale, compared.result.rating),
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

  const label = archiveLabel(game, locale);
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
          aria-label={t(active?.playing ? 'line.pause' : 'line.play')}
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
          aria-label={t('line.prev')}
          disabled={!active || step === 0}
          onClick={() => setLine({ kind, step: step - 1, playing: false })}
        >
          <ChevronLeft />
        </button>
        <button
          aria-label={t('line.next')}
          disabled={!moves.length || step >= moves.length}
          onClick={() => setLine({ kind, step: step + 1, playing: false })}
        >
          <ChevronRight />
        </button>
      </div>
    );
  }

  function lineMoves(exit = true) {
    if (!line) return null;
    return (
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
        {exit && (
          <button className="line-exit" onClick={() => setLine(null)}>
            {t('line.back')}
          </button>
        )}
      </div>
    );
  }

  /** Why the game move fell short and why the engine's move works. Demos live in the
   * comparison rows (analysis) or the action bar (practice), never in the card. */
  function commentaryCard(commentary: Commentary, best: string) {
    return (
      <article className="commentary-card" aria-live="polite">
        <h4>{t('review.problem')}</h4>
        <ul>
          {commentary.problem.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        <h4>{t('review.why', { move: best })}</h4>
        <ul>
          {commentary.reason.map((text) => (
            <li key={text}>{text}</li>
          ))}
        </ul>
        {!commentary.certain && <small>{t('review.uncertain')}</small>}
      </article>
    );
  }

  function analysisTab() {
    if (!ply) return <p className="review-empty">{t('review.empty.start')}</p>;
    if (!compared) return null;
    const { played, result, best, actual } = compared;
    if (!result)
      return <p className="review-empty">{t('review.empty.pending')}</p>;
    const same =
      best[0] && best[0].from === played.from && best[0].to === played.to;
    return (
      <div className="review-compare">
        <div
          className={`compare-row played ${line?.kind === 'actual' ? 'active' : ''}`}
        >
          <span className={`compare-who ${played.side}`}>
            {t('review.played')}
          </span>
          <div className="compare-move">
            <strong>
              {moveNumber(ply, played.side)} {historyMoveText(played, notation)}
            </strong>
            {result.rating && (
              <span className={`move-rating rating-${result.rating}`}>
                {ratingLabel(locale, result.rating)}
              </span>
            )}
            <small>{scoreText(playedScore(result), locale)}</small>
          </div>
          {lineControls('actual', actual)}
        </div>
        <div
          className={`compare-row best ${line?.kind === 'best' ? 'active' : ''}`}
        >
          <span className="compare-who engine">{t('review.best')}</span>
          <div className="compare-move">
            <strong>
              {moveNumber(ply, played.side)} {best[0]?.text ?? '—'}
            </strong>
            <span className="best-star" aria-label={t('review.engineChoice')}>
              ★
            </span>
            <small>
              {same ? t('review.same') : scoreText(result.before.score, locale)}
            </small>
          </div>
          {lineControls('best', best)}
        </div>
        {commentary && commentaryCard(commentary, best[0]?.text ?? '')}
        {lineMoves()}
      </div>
    );
  }

  function reportTab() {
    // A phase the game never reached is not a missing score.
    const cell = (v: number | null) =>
      v !== null
        ? t('report.points', { v })
        : done < total
          ? '—'
          : t('report.notReached');
    const side = (s: Side) => (
      <div className={`report-side ${s}`}>
        <span>{playerName(locale, game.players[s])}</span>
        <strong>{report[s].overall ?? '—'}</strong>
        <small>{t('report.overall')}</small>
      </div>
    );
    const rows: [string, (s: Side) => string][] = [
      ...PHASES.map(
        (p) =>
          [
            t('report.phaseScore', { phase: phaseLabel(locale, p) }),
            (s: Side) => cell(report[s].phases[p]),
          ] as [string, (s: Side) => string],
      ),
      [
        t('report.counts'),
        (s) => {
          const c = report[s].counts;
          return `${c.blunder + c['allowed-mate']} / ${c.mistake} / ${c.inaccuracy}`;
        },
      ],
      [t('report.missedMates'), (s) => String(report[s].counts['missed-mate'])],
    ];
    return (
      <div className="review-report">
        <div className="report-sides">
          {side('red')}
          <div className="report-result">
            <b>{label.result}</b>
            <small>{reasonText(locale, game.result.reason)}</small>
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
            <section
              key={s}
              aria-label={t('report.mistakes', { side: sideName(locale, s) })}
            >
              <h4>{t('report.mistakes', { side: sideName(locale, s) })}</h4>
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
                          {ratingLabel(locale, m.rating)}
                        </i>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  {t(done < total ? 'report.afterAnalysis' : 'report.none')}
                </p>
              )}
            </section>
          ))}
        </div>
        <small className="review-note">{t('report.note')}</small>
      </div>
    );
  }

  function practiceTab() {
    const best = drill?.best[0];
    const finished =
      practice?.state === 'solved' || practice?.state === 'revealed';
    const message = !practice
      ? t('practice.pick')
      : practice.state === 'solved'
        ? t('practice.solved', { move: best?.text ?? '' })
        : practice.state === 'revealed'
          ? t('practice.revealed', { move: best?.text ?? '—' })
          : practice.state === 'wrong'
            ? t('practice.wrong')
            : t('practice.turn', {
                side: drillSide ? sideName(locale, drillSide) : '',
              });
    return (
      <div className="review-practice">
        <div className="practice-picker">
          <select
            id="practice-side"
            aria-label={t('practice.side')}
            value={practiceSide}
            onChange={(event) => {
              const side = event.target.value as Side,
                first = report[side].mistakes[0];
              setPracticeSide(side);
              if (first) startDrill(first.ply);
              else {
                setLine(null);
                setPractice(null);
              }
            }}
          >
            {(['red', 'black'] as Side[]).map((s) => (
              <option key={s} value={s}>
                {t('practice.sideOption', {
                  side: sideName(locale, s),
                  n: report[s].mistakes.length,
                })}
              </option>
            ))}
          </select>
          {mistakes.length > 0 && (
            <select
              id="practice-question"
              aria-label={t('practice.choose')}
              value={practice?.ply ?? ''}
              onChange={(event) => startDrill(Number(event.target.value))}
            >
              {!practice && (
                <option value="" disabled>
                  {t('practice.choose')}
                </option>
              )}
              {mistakes.map((m, i) => (
                <option key={m.ply} value={m.ply}>
                  {t('practice.question', {
                    i: i + 1,
                    total: mistakes.length,
                    num: moveNumber(m.ply, m.side),
                    move: m.text,
                    rating: ratingLabel(locale, m.rating, true),
                  })}
                </option>
              ))}
            </select>
          )}
        </div>
        {mistakes.length ? (
          <p
            className={`practice-message ${practice?.state ?? ''}`}
            aria-live="polite"
          >
            {message}
          </p>
        ) : (
          <p className="review-empty">
            {done < total
              ? t('practice.afterAnalysis')
              : t('practice.noMistakes', {
                  side: sideName(locale, practiceSide),
                })}
          </p>
        )}
        {/* The explanation waits until the player has tried: no spoilers. */}
        {finished &&
          drillCommentary &&
          commentaryCard(drillCommentary, best?.text ?? '')}
        {lineMoves(false)}
      </div>
    );
  }

  /** One bar under the panel, holding only what the current view can do. */
  function actionBar() {
    if (tab === 'report') return null;
    if (tab === 'practice') {
      if (!practice)
        return mistakes.length ? (
          <footer className="review-nav">
            <button
              className="primary"
              onClick={() => startDrill(mistakes[0].ply)}
            >
              {t('practice.start')}
            </button>
          </footer>
        ) : null;
      if (line) {
        const step = line.step;
        return (
          <footer className="review-nav">
            <button
              className="icon"
              aria-label={t('practice.prev')}
              disabled={!step}
              onClick={() =>
                setLine({ ...line, step: step - 1, playing: false })
              }
            >
              <ChevronLeft />
            </button>
            <button
              onClick={() =>
                setLine(
                  playing
                    ? { ...line, playing: false }
                    : {
                        ...line,
                        step: step >= steps.length ? 0 : step,
                        playing: true,
                      },
                )
              }
            >
              {playing ? <Pause /> : <Play />}{' '}
              {t(playing ? 'practice.pause' : 'practice.play')}
            </button>
            <button
              className="icon"
              aria-label={t('practice.next')}
              disabled={step >= steps.length}
              onClick={() =>
                setLine({ ...line, step: step + 1, playing: false })
              }
            >
              <ChevronRight />
            </button>
            <button onClick={() => setLine(null)}>
              {t('practice.endDemo')}
            </button>
          </footer>
        );
      }
      const finished =
          practice.state === 'solved' || practice.state === 'revealed',
        next =
          drillIndex >= 0 && drillIndex < mistakes.length - 1
            ? mistakes[drillIndex + 1]
            : null;
      return (
        <footer className="review-nav">
          {finished ? (
            <>
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
                <RotateCcw /> {t('practice.again')}
              </button>
              <button
                disabled={!drill?.best.length}
                onClick={() =>
                  setLine({ kind: 'best', step: 0, playing: true })
                }
              >
                <Play /> {t('practice.demo')}
              </button>
            </>
          ) : (
            <>
              <button
                disabled={practice.hint}
                onClick={() => setPractice({ ...practice, hint: true })}
              >
                <Lightbulb /> {t('practice.hint')}
              </button>
              <button
                onClick={() =>
                  setPractice({
                    ...practice,
                    state: 'revealed',
                    selected: null,
                  })
                }
              >
                <Eye /> {t('practice.answer')}
              </button>
            </>
          )}
          <button
            className={finished ? 'primary' : ''}
            disabled={!next}
            onClick={() => next && startDrill(next.ply)}
          >
            <SkipForward />{' '}
            {t(next ? 'practice.nextPuzzle' : 'practice.lastPuzzle')}
          </button>
        </footer>
      );
    }
    return (
      <footer className="review-nav">
        <button
          className="icon"
          onClick={() => go(0)}
          disabled={!ply}
          aria-label={t('review.nav.start')}
        >
          <ChevronFirst />
        </button>
        <button onClick={() => go(ply - 1)} disabled={!ply}>
          <ChevronLeft /> {t('review.nav.prev')}
        </button>
        <button onClick={() => go(ply + 1)} disabled={ply >= total}>
          {t('review.nav.next')} <ChevronRight />
        </button>
        <button
          className="icon"
          onClick={() => go(total)}
          disabled={ply >= total}
          aria-label={t('review.nav.end')}
        >
          <ChevronLast />
        </button>
      </footer>
    );
  }

  return (
    <main className="review-screen">
      <header className="review-header">
        <button
          className="review-icon"
          onClick={onExit}
          aria-label={t(
            exitTo === 'club' ? 'review.exit.club' : 'play.backToGame',
          )}
        >
          <ArrowLeft />
        </button>
        <div>
          <strong>{t('review.title')}</strong>
          <span>
            {playerName(locale, game.players.red)} ·{' '}
            {playerName(locale, game.players.black)} · {label.result}
          </span>
        </div>
        <span className="review-ply">
          {ply} / {total}
        </span>
        {(tab === 'chart' || tab === 'analysis') && (
          <button
            className="review-icon"
            onClick={onExplore}
            aria-label={t('review.explore')}
            title={t('review.explore')}
          >
            <GitBranch />
          </button>
        )}
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
        {(analysis.busy || analysis.status === 'error' || done < total) && (
          <div className="review-progress" aria-live="polite">
            {analysis.status === 'error' ? (
              <>
                <span>
                  {analysis.error
                    ? errorText(locale, analysis.error)
                    : t('review.interrupted')}
                </span>
                <button onClick={analysis.start}>{t('review.retry')}</button>
              </>
            ) : (
              <>
                <span>
                  {!analysis.enabled
                    ? t('review.preparing')
                    : t('review.analyzing', { done, total })}
                </span>
                <progress max={Math.max(1, total)} value={done} />
              </>
            )}
          </div>
        )}
        <div
          className="review-tabs"
          role="tablist"
          aria-label={t('review.tabs')}
        >
          {TABS.map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key);
                setLine(null);
                if (key !== 'practice') setPractice(null);
                else if (!practice && mistakes[0]) startDrill(mistakes[0].ply);
              }}
            >
              {t(`review.tab.${key}`)}
            </button>
          ))}
        </div>
        <section className="review-panel" role="tabpanel">
          {tab === 'chart' && (
            <>
              <EvalChart series={series} ply={ply} phases={phases} onPly={go} />
              <p className="chart-caption">
                {ply
                  ? `${moveNumber(ply, history[ply - 1].side)} ${historyMoveText(history[ply - 1], notation)} · ${scoreText(scoreAt(data, ply), locale)}`
                  : t('review.start', {
                      score: scoreText(scoreAt(data, 0), locale),
                    })}
                {compared?.result?.rating && (
                  <span
                    className={`move-rating rating-${compared.result.rating}`}
                  >
                    {ratingLabel(locale, compared.result.rating)}
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
      {actionBar()}
    </main>
  );
}
