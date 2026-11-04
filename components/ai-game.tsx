'use client';
/* oxlint-disable next/no-html-link-for-pages -- AI isolation requires full document navigation; this component is also a standalone Pages entry. */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  ChevronLeft,
  ChevronRight,
  Flag,
  GitBranch,
  Menu,
  RotateCcw,
  ScrollText,
  Settings2,
  Sparkles,
  Undo2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import ChessBoard from './chess-board';
import CapturedTray from './captured-tray';
import GameRecord from './game-record';
import GameAnalysisControls from './game-analysis-controls';
import { useGameAnalysis } from '@/lib/use-game-analysis';
import { ratingReviewSelection } from '@/lib/analysis-review';
import GameSheet from './game-sheet';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from './ui/dropdown-menu';
import {
  AI_LEVELS,
  aiMovePause,
  createAiMatch,
  describeLine,
  engineMove,
  evaluationLabel,
  historyPosition,
  levelName,
  pauseLeft,
  playAiMove,
  resignAiMatch,
  squareToEngine,
  undoAiTurn,
  type AiLevel,
  type EngineInfo,
} from '@/lib/ai-game';
import { errorInfo, errorText, type ErrorInfo } from '@/lib/errors';
import { playerName, reasonText, sideName } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';
import { BrowserEngine, aiBase, prepareAiPage } from '@/lib/ai-engine';
import { reportClientError } from '@/lib/telemetry';
import { useAutoArchive } from '@/lib/use-auto-archive';
import { findArchivedGame } from '@/lib/archive-sync';
import ReviewScreen from '@/components/review-screen';
import {
  replayArchive,
  archiveGame,
  archiveLabel,
  type ArchivedGame,
} from '@/lib/archive';
import AccountMenu from '@/components/account-menu';
import { useAccount } from '@/lib/use-account';
import EffectSettings, { EffectMenuItems } from '@/components/effect-settings';
import { useEffectSettings } from '@/lib/use-effect-settings';
import { visibleEffect, type SettingKey } from '@/lib/effect-settings';
import { GameAudio, soundDelay } from '@/lib/game-audio';
import {
  branchFeedback,
  effectDuration,
  updateFeedback,
  type BoardEffect,
  type FeedbackRoom,
  type SoundKind,
} from '@/lib/presentation';
import {
  hasLegalMove,
  inCheck,
  legalMove,
  legalTargets,
  moveBoard,
  opposite,
  type Board,
  type Side,
} from '@/lib/xiangqi';
import { useGameViewport } from '@/lib/use-game-viewport';

type Branch = { boards: Board[]; turns: Side[]; base: string; moves: string[] };
type AnalysisResult = { key: string; info: EngineInfo };

export default function AiGame() {
  const { locale, t, tn, notation } = useLocale();
  const { settings, setSetting } = useEffectSettings();
  const account = useAccount();
  const sound = settings.sound;
  const [sessionId] = useState(() => crypto.randomUUID());
  const [archiveId, setArchiveId] = useState(() =>
    new URLSearchParams(location.search).get('game'),
  );
  const [archived, setArchived] = useState<ArchivedGame | null>(null);
  const [archiveLoadError, setArchiveLoadError] = useState<ErrorInfo | null>(
    null,
  );
  const [match, setMatch] = useState(() => createAiMatch('red', 'medium'));
  const [started, setStarted] = useState(false);
  const [setup, setSetup] = useState(!archiveId);
  const [human, setHuman] = useState<Side>('red');
  const [level, setLevel] = useState<AiLevel>('medium');
  const [engineState, setEngineState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [review, setReview] = useState<number | null>(null);
  const [branch, setBranch] = useState<Branch | null>(null);
  const [analysisOn, setAnalysisOn] = useState(true);
  const [evaluation, setEvaluation] = useState<AnalysisResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [sheet, setSheet] = useState<'record' | 'analysis' | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const [visible, setVisible] = useState(true);
  const [boardEffect, setBoardEffect] = useState<BoardEffect | null>(null);
  const [assetBase, setAssetBase] = useState('./');
  const engineRef = useRef<BrowserEngine | null>(null);
  const [analysisEngine, setAnalysisEngine] = useState<BrowserEngine | null>(
    null,
  );
  const [ratedPly, setRatedPly] = useState<number | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const soundRef = useRef(sound);
  const feedbackRef = useRef<FeedbackRoom | null>(null);
  const viewRef = useRef({ live: true, branch: false });
  const viewport = useGameViewport(started);
  const { room } = match;
  const reviewing = review !== null;
  const analysisGame = useMemo(
    () =>
      archived ??
      (started && reviewing && room.result
        ? archiveGame(room, {
            id: `ai:${sessionId}:${room.round}`,
            date: new Date(room.createdAt).toISOString(),
            mode: { kind: 'ai', level: match.level },
            viewerSide: match.human,
          })
        : null),
    [archived, started, reviewing, room, sessionId, match.level, match.human],
  );
  const whole = useGameAnalysis(
    analysisGame,
    room,
    analysisEngine,
    reviewing && !branch && !setup && visible && engineState === 'ready',
  );
  const ratedSelection = ratingReviewSelection(
    room.history,
    whole.analysis,
    ratedPly ?? 0,
  );
  const archiveFailed = useAutoArchive(
    room,
    started && !archived && !archiveId ? `ai:${sessionId}:${room.round}` : null,
    { kind: 'ai', level: match.level },
    match.human,
    !!account.user,
  );
  useEffect(() => {
    if (!archiveId) return;
    let active = true;
    void findArchivedGame(archiveId)
      .then((game) => {
        const restored = replayArchive(game);
        if (!active) return;
        setArchived(game);
        setMatch({
          room: restored,
          human: game.viewerSide ?? 'red',
          level: game.mode.kind === 'ai' ? game.mode.level : 'medium',
          revision: 0,
        });
        setReview(0);
        setStarted(true);
        setSetup(false);
        setSelected(null);
        setBranch(null);
      })
      .catch((error: unknown) => {
        if (active)
          setArchiveLoadError(errorInfo(error, 'archive-load-failed'));
      });
    return () => {
      active = false;
    };
  }, [archiveId]);
  const index =
    review === null
      ? room.history.length
      : Math.min(review, room.history.length);
  const board = branch
    ? branch.boards[branch.boards.length - 1]
    : index < room.history.length
      ? room.history[index].before
      : room.board;
  const turn = branch
    ? branch.turns[branch.turns.length - 1]
    : index < room.history.length
      ? room.history[index].side
      : room.turn;
  const position = branch
    ? branch.base +
      (branch.moves.length
        ? (branch.base.includes(' moves ') ? ' ' : ' moves ') +
          branch.moves.join(' ')
        : '')
    : historyPosition(room, index);
  const evaluationKey = `${match.revision}:${position}`;
  const info = evaluation?.key === evaluationKey ? evaluation.info : null;
  const best = info ? describeLine(board, turn, info.pv, 1, notation)[0] : null;
  const live = review === null && !branch && !archived;
  const aiTurn = started && live && !room.result && room.turn !== match.human;
  const canMove =
    started &&
    !setup &&
    (!!branch || (live && !room.result && room.turn === match.human));
  const targets = selected === null ? [] : legalTargets(board, selected);
  const canUndo =
    !archived &&
    (room.history.some((m) => m.side === match.human) || !!room.result);
  const ended = live && !!room.result;

  function unlockSound() {
    if (!soundRef.current) return;
    audioRef.current ??= new GameAudio();
    audioRef.current.unlock();
  }
  function playSound(kind: SoundKind, delay = 0) {
    if (soundRef.current) audioRef.current?.play(kind, delay);
  }
  function changeSetting(key: SettingKey, value: boolean) {
    setSetting(key, value);
    if (key === 'sound') {
      soundRef.current = value;
      if (value) unlockSound();
      else audioRef.current?.silence();
    }
  }
  function toggleSound() {
    changeSetting('sound', !sound);
  }

  useEffect(() => {
    viewRef.current = {
      live: review === null && !branch && !archived,
      branch: !!branch,
    };
  }, [review, branch, archived]);
  useEffect(() => {
    soundRef.current = sound;
    if (!sound) audioRef.current?.silence();
  }, [sound]);
  useEffect(() => () => audioRef.current?.close(), []);
  useEffect(() => {
    if (!boardEffect) return;
    const timer = setTimeout(
      () => setBoardEffect(null),
      effectDuration(boardEffect.kind),
    );
    return () => clearTimeout(timer);
  }, [boardEffect]);
  // Both sides' moves, undo and results share the friend room's sounds and overlays.
  useEffect(() => {
    const { room: next } = match;
    const current: FeedbackRoom = {
      id: next.id,
      round: next.round,
      version: match.revision,
      history: next.history,
      result: next.result,
      turn: next.turn,
    };
    const previous = feedbackRef.current;
    feedbackRef.current = current;
    if (!previous) return;
    const feedback = updateFeedback(previous, current);
    feedback.sounds.forEach((kind, order) =>
      playSound(kind, soundDelay(feedback.sounds, order)),
    );
    if (feedback.reset) setBoardEffect(null);
    if (feedback.effect && viewRef.current.live)
      setBoardEffect(feedback.effect);
  }, [match]);

  useEffect(() => {
    let disposed = false;
    let engine: BrowserEngine | undefined;
    void (async () => {
      try {
        await prepareAiPage();
        if (disposed) return;
        setAssetBase(aiBase().href);
        engine = new BrowserEngine();
        engineRef.current = engine;
        await engine.ready;
        if (!disposed) {
          setAnalysisEngine(engine);
          setEngineState('ready');
        }
      } catch (e) {
        if (!disposed) {
          setEngineState('error');
          setError(errorInfo(e, 'engine-prepare-failed'));
          reportClientError('engine', e);
        }
      }
    })();
    return () => {
      disposed = true;
      engine?.dispose();
      if (engineRef.current === engine) engineRef.current = null;
    };
  }, [engineAttempt]);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  // Synchronize loading feedback with the lifetime of the external engine search.
  /* oxlint-disable react/react-compiler */
  useEffect(() => {
    const engine = engineRef.current;
    if (
      !engine ||
      engineState !== 'ready' ||
      whole.busy ||
      !started ||
      setup ||
      !visible ||
      ended ||
      (!aiTurn && !analysisOn) ||
      !hasLegalMove(board, turn)
    ) {
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    const config = aiTurn
      ? AI_LEVELS[match.level]
      : { time: 900, depth: 14, skill: 20 };
    // The AI's move waits for a human pace; the analysis of our own turn does not.
    const since = performance.now();
    const pause = aiTurn ? aiMovePause(match.room.history.length) : 0;
    let reply: ReturnType<typeof setTimeout> | undefined;
    setSearching(true);
    setError(null);
    void engine
      .search({
        position,
        turn,
        ...config,
        signal: controller.signal,
        onInfo: (next) => setEvaluation({ key: evaluationKey, info: next }),
      })
      .then((token) => {
        if (controller.signal.aborted) return;
        if (!aiTurn) {
          setSearching(false);
          return;
        }
        const move = token && engineMove(token);
        if (!move || !legalMove(board, move.from, move.to, turn)) {
          setSearching(false);
          setEngineState('error');
          setError(errorInfo(null, 'engine-no-move'));
          return;
        }
        reply = setTimeout(
          () => {
            if (controller.signal.aborted) return;
            setSearching(false);
            // A result belongs to this exact match object, never a later undo/restart.
            setMatch((current) =>
              current === match
                ? playAiMove(current, move.from, move.to)
                : current,
            );
            setSelected(null);
          },
          pauseLeft(pause, performance.now() - since),
        );
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setSearching(false);
        setEngineState('error');
        setError(errorInfo(e, 'search-failed'));
      });
    return () => {
      controller.abort();
      clearTimeout(reply);
    };
  }, [
    match,
    started,
    setup,
    visible,
    engineState,
    position,
    turn,
    aiTurn,
    ended,
    analysisOn,
    evaluationKey,
    board,
    whole.busy,
  ]);

  /* oxlint-enable react/react-compiler */
  function retryEngine() {
    setEngineState('loading');
    setError(null);
    setEngineAttempt((n) => n + 1);
  }
  function closeSetup() {
    if (started) setSetup(false);
    else window.location.assign('../');
  }
  function start() {
    setRatedPly(null);
    setArchived(null);
    setArchiveId(null);
    setArchiveLoadError(null);
    window.history.replaceState(null, '', location.pathname);
    setMatch((current) =>
      createAiMatch(human, level, started ? current.room.round + 1 : 1),
    );
    setStarted(true);
    setSetup(false);
    setReview(null);
    setBranch(null);
    setSelected(null);
    setEvaluation(null);
    setSheet(null);
  }
  function backToLive() {
    setRatedPly(null);
    setBoardEffect(null);
    setReview(archived ? room.history.length : null);
    setBranch(null);
    setSelected(null);
    setSheet(null);
  }
  function undo() {
    setMatch(undoAiTurn);
    backToLive();
  }
  function navigate(next: number) {
    setRatedPly(null);
    setBoardEffect(null);
    setReview(Math.max(0, Math.min(room.history.length, next)));
    setBranch(null);
    setSelected(null);
    setSheet(null);
  }
  function showRating(ply: number) {
    const selected = ratingReviewSelection(room.history, whole.analysis, ply);
    if (!selected) return;
    navigate(selected.index);
    setRatedPly(ply);
  }
  function explore() {
    setRatedPly(null);
    setBoardEffect(null);
    setBranch({ boards: [board], turns: [turn], base: position, moves: [] });
    setSelected(null);
    setSheet(null);
  }
  function square(n: number) {
    if (!canMove) return;
    if (selected !== null && legalMove(board, selected, n, turn)) {
      if (branch) {
        setBranch({
          ...branch,
          boards: [...branch.boards, moveBoard(board, selected, n)],
          turns: [...branch.turns, opposite(turn)],
          moves: [
            ...branch.moves,
            squareToEngine(selected) + squareToEngine(n),
          ],
        });
        const feedback = branchFeedback(
          board,
          selected,
          n,
          turn,
          `branch:${branch.moves.length}:${Date.now()}`,
        );
        setBoardEffect(feedback.effect);
        feedback.sounds.forEach((kind, index) =>
          playSound(kind, soundDelay(feedback.sounds, index)),
        );
      } else setMatch((current) => playAiMove(current, selected, n));
      setSelected(null);
    } else if (board[n]?.side === turn) setSelected(n === selected ? null : n);
  }
  const redShare =
    info?.mate !== undefined
      ? info.mate > 0
        ? 96
        : info.mate < 0
          ? 4
          : 50
      : 50 + 44 * Math.tanh((info?.cp ?? 0) / 500);
  const status = branch
    ? t('room.status.exploring')
    : review !== null
      ? t('play.replay', { n: index })
      : room.result
        ? t('ai.status.result', {
            outcome:
              room.result.winner === 'draw'
                ? t('result.draw')
                : t('result.sideWon', {
                    side: sideName(locale, room.result.winner),
                  }),
            reason: reasonText(locale, room.result.reason),
          })
        : aiTurn
          ? t('ai.thinking')
          : inCheck(board, turn)
            ? t('room.status.checkYou')
            : t('room.status.yourTurn');

  // One title (the sheet's, or the card's on wide screens), the verdict in words over the bar,
  // and the move to play. During the AI's own turn its search is not advice for us.
  function analysisPanel(inSheet = false) {
    const advice = ended
      ? t('ai.best.ended')
      : aiTurn
        ? t('ai.thinking')
        : best
          ? t('ai.best.recommended', { move: best })
          : searching
            ? t('ai.best.searching')
            : t('ai.best.idle');
    return (
      <div className="ai-analysis-panel">
        {!inSheet && (
          <div className="ai-analysis-title">
            <Sparkles size={18} />
            <strong>{t('ai.panel.title')}</strong>
          </div>
        )}
        {analysisOn ? (
          <>
            <strong className="ai-verdict">
              {ended ? status : evaluationLabel(info, locale)}
            </strong>
            {!ended && (
              <>
                <div
                  className="ai-score-track"
                  aria-label={t('ai.eval.label', {
                    label: evaluationLabel(info, locale),
                  })}
                  title={t('ai.disclaimer')}
                >
                  <span style={{ width: `${redShare}%` }} />
                </div>
                <div className="ai-score-labels" aria-hidden="true">
                  <span>{t('side.red')}</span>
                  <span>{t('side.black')}</span>
                </div>
              </>
            )}
            <p
              className={`ai-best-move ${best && !ended && !aiTurn ? '' : 'pending'}`}
            >
              {advice}
            </p>
          </>
        ) : (
          <p className="ai-muted">{t('ai.panel.hint')}</p>
        )}
        <button
          className="ai-toggle"
          aria-pressed={analysisOn}
          onClick={() => setAnalysisOn(!analysisOn)}
        >
          {t(analysisOn ? 'ai.dock.analysisOn' : 'ai.dock.analysisOff')}
        </button>
      </div>
    );
  }
  const engineCredit = (
    <p className="ai-engine-credit">
      {t('ai.engineCredit')}{' '}
      <a
        href="https://github.com/fairy-stockfish/fairy-stockfish.wasm"
        target="_blank"
        rel="noreferrer"
      >
        Fairy-Stockfish
      </a>{' '}
      ·{' '}
      <a href={`${assetBase}engine/SOURCE.md`} target="_blank" rel="noreferrer">
        {t('ai.license')}
      </a>
    </p>
  );
  const statusLine = (
    <>
      {engineState === 'loading' ? t('ai.engineLoading') : status}
      {engineState !== 'loading' && aiTurn && visible && (
        <span className="thinking-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      )}
    </>
  );
  function player(side: Side) {
    const me = side === match.human;
    return (
      <div className={`player-seat seat-${side}`}>
        <div
          className={`player-bar ${live && !room.result && turn === side ? 'active-player' : ''}`}
        >
          <div className="player-avatar">
            <span className={`avatar ${side}`}>
              {side === 'red' ? '帅' : '将'}
            </span>
          </div>
          <div className="player-name-block">
            <strong>
              <span className="player-name">
                {playerName(
                  locale,
                  archived
                    ? archived.players[side]
                    : me
                      ? t('name.me')
                      : t('name.ai'),
                )}
              </span>
              {!me && (!archived || archived.mode.kind === 'ai') && (
                <em className="player-tag">{levelName(locale, match.level)}</em>
              )}
            </strong>
          </div>
          <CapturedTray board={board} side={side} />
          {!me && !archived && (
            <span className="bar-status" aria-hidden="true">
              {statusLine}
            </span>
          )}
          {!me && (!archived || archived.mode.kind === 'ai') && (
            <Bot size={20} aria-label={t('ai.player.computer')} />
          )}
        </div>
      </div>
    );
  }

  if (archiveId && !archived)
    return (
      <main className="app-shell">
        <a href="../">{t('ai.back')}</a>
        <p role={archiveLoadError ? 'alert' : 'status'}>
          {archiveLoadError
            ? errorText(locale, archiveLoadError)
            : t('ai.loadingGame')}
        </p>
        {archiveLoadError && (
          <button
            onClick={() => {
              setArchiveId(null);
              setSetup(true);
              window.history.replaceState(null, '', location.pathname);
            }}
          >
            {t('ai.startPlaying')}
          </button>
        )}
      </main>
    );
  // A friend game reviewed straight after it ended returns to its room for a rematch;
  // opened from the lobby's list, the room may be long gone, so it returns there.
  const backToRoom =
    archived?.mode.kind === 'friend' &&
    new URLSearchParams(location.search).get('back') === 'room'
      ? archived.id.split(':')[1]
      : null;
  // A finished game opens in the full review screen; unfinished games keep the inline replay.
  if (reviewing && analysisGame && !branch && !setup)
    return (
      <ReviewScreen
        game={analysisGame}
        history={room.history}
        finalBoard={room.board}
        flipped={match.human === 'black'}
        ply={index}
        onPly={navigate}
        analysis={whole}
        onExplore={explore}
        onExit={
          archived
            ? () =>
                window.location.assign(
                  backToRoom
                    ? `../?room=${encodeURIComponent(backToRoom)}`
                    : '../',
                )
            : backToLive
        }
        exitTo={archived && !backToRoom ? 'club' : 'game'}
      />
    );
  return (
    <main
      className={`app-shell table-view ai-room ${started ? 'in-room' : ''} ${ended ? 'game-ended' : ''}`}
      style={viewport}
      onPointerDown={unlockSound}
      onKeyDownCapture={unlockSound}
    >
      <header className="site-header">
        <a className="brand" href="../">
          <span className="brand-seal">楚</span>
          <span>{t('brand.name')}</span>
        </a>
        <div className="header-tools">
          <button
            className="text-button"
            aria-label={t('ai.newGame.label')}
            onClick={() => setSetup(true)}
          >
            <Settings2 size={17} />
            <span className="tool-label">{t('ai.newGame')}</span>
          </button>
          <AccountMenu account={account} />
        </div>
      </header>
      <div className="ai-mobile-nav">
        <a href="../" aria-label={t('ai.back')}>
          <ArrowLeft size={20} />
        </a>
        <strong>{t(archived ? 'ai.review' : 'ai.practice')}</strong>
        <span>
          {t('ai.mobileSub', {
            mode:
              archived?.mode.kind === 'friend'
                ? t('room.friendGame')
                : levelName(locale, match.level),
            n: room.round,
          })}
        </span>
        <button
          onClick={() => setSetup(true)}
          aria-label={t('ai.newGame.label')}
        >
          <Settings2 size={20} />
        </button>
      </div>
      <output className="ai-status-line">
        <span>{statusLine}</span>
      </output>
      {(archived || (ratedSelection && !branch)) && (
        <div className="ai-review-details">
          {ratedSelection && !branch && (
            <output className="rated-recommendation" aria-live="polite">
              {t('ai.rated', {
                n: ratedPly ?? 0,
                move: ratedSelection.recommendation ?? t('ai.rated.none'),
              })}
            </output>
          )}
          {archived && (
            <p className="archive-banner">
              {t('ai.banner', {
                red: playerName(locale, archived.players.red),
                black: playerName(locale, archived.players.black),
                result: archiveLabel(archived, locale).result,
                reason: reasonText(locale, archived.result.reason),
              })}
            </p>
          )}
        </div>
      )}
      {account.notice && (
        <output className="notice">
          <span>{account.notice}</span>
          <button
            aria-label={t('notice.dismiss')}
            onClick={account.clearNotice}
          >
            <X size={15} />
          </button>
        </output>
      )}
      {archiveFailed && (
        <p className="ai-error" role="alert">
          {t('archive.saveFailed')}
        </p>
      )}
      {error && (
        <div className="ai-error" role="alert">
          <span>{errorText(locale, error)}</span>
          <button onClick={retryEngine}>{t('ai.retry')}</button>
        </div>
      )}
      <div className="workspace">
        <section className="play-column">
          {player(opposite(match.human))}
          <div className="board-stage">
            <EffectSettings settings={settings} onChange={changeSetting} />
            <ChessBoard
              board={board}
              flipped={match.human === 'black'}
              selected={selected}
              targets={settings.hints ? targets : []}
              last={branch ? null : room.history[index - 1]}
              onSquare={square}
              checkSide={inCheck(board, turn) ? turn : null}
              effect={visibleEffect(boardEffect, settings)}
              captureEffects={settings.moveEffects}
              animationContext={
                branch
                  ? 'ai-branch'
                  : review !== null
                    ? 'ai-review'
                    : `ai-live-${room.round}`
              }
            />
          </div>
          {player(match.human)}
          {(branch || review !== null) && (
            <div className="analysis-controls">
              <span>
                {branch
                  ? tn('play.exploring', branch.boards.length - 1)
                  : t('ai.replay', { index, total: room.history.length })}
              </span>
              {branch ? (
                <button
                  disabled={branch.boards.length < 2}
                  onClick={() => {
                    setBoardEffect(null);
                    setBranch({
                      ...branch,
                      boards: branch.boards.slice(0, -1),
                      turns: branch.turns.slice(0, -1),
                      moves: branch.moves.slice(0, -1),
                    });
                    setSelected(null);
                  }}
                >
                  <Undo2 size={16} />
                  {t('play.backOne')}
                </button>
              ) : (
                <>
                  <button
                    aria-label={t('play.replay.prev')}
                    disabled={index === 0}
                    onClick={() => navigate(index - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    aria-label={t('play.replay.next')}
                    disabled={index === room.history.length}
                    onClick={() => navigate(index + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
              <button onClick={backToLive}>
                {t(archived ? 'ai.backToReview' : 'play.backToGame')}
              </button>
            </div>
          )}
          {ended && (
            <div className="endgame-panel">
              <div className="endgame-buttons">
                <button
                  className="primary-button"
                  onClick={() => setSetup(true)}
                >
                  {t('room.rematch.again')}
                </button>
                <button className="secondary-button" onClick={undo}>
                  {t('play.steam.small')}
                </button>
                <button
                  className="secondary-button"
                  disabled={!room.history.length}
                  onClick={() => navigate(0)}
                >
                  {t('play.review')}
                </button>
              </div>
            </div>
          )}
          <div className="ai-desktop-actions">
            <button disabled={!canUndo} onClick={undo}>
              <Undo2 size={18} />
              {t('play.undo')}
            </button>
            <button onClick={branch ? backToLive : explore}>
              <GitBranch size={18} />
              {branch
                ? t(archived ? 'ai.backToReview' : 'play.backToGame')
                : t('play.explore')}
            </button>
            <button
              disabled={!!room.result}
              onClick={() => setConfirmResign(true)}
            >
              <Flag size={18} />
              {t('play.resign')}
            </button>
            <button
              className="ai-sound-toggle"
              aria-label={t(
                sound ? 'room.sound.off.label' : 'room.sound.on.label',
              )}
              title={t(sound ? 'room.sound.off' : 'room.sound.on')}
              onClick={toggleSound}
            >
              {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>
        </section>
        <aside
          className={`room-column ${analysisGame ? 'whole-analysis-column' : ''}`}
        >
          {analysisPanel()}
          <section className="panel ai-record-panel">
            <div className="panel-heading">
              <strong>{t('record.title')}</strong>
              <span>{tn('recent.moves', room.history.length)}</span>
            </div>
            {analysisGame && <GameAnalysisControls analysis={whole} />}
            <GameRecord
              analysis={analysisGame ? whole.analysis : null}
              ratedPly={ratedPly}
              onRatingSelect={showRating}
              history={room.history}
              index={index}
              onNavigate={navigate}
              onLive={backToLive}
            />
          </section>
          {engineCredit}
        </aside>
      </div>
      <button
        className="ai-mobile-evaluation"
        onClick={() => setSheet('analysis')}
        aria-label={t('ai.mobile.eval')}
      >
        <Sparkles size={17} />
        <strong>
          {analysisOn
            ? ended
              ? t('ai.mobile.over')
              : evaluationLabel(info, locale)
            : t('ai.mobile.off')}
        </strong>
        <span>
          {analysisOn && !ended
            ? aiTurn
              ? t('ai.thinking')
              : best
                ? t('ai.mobile.best', { move: best })
                : searching
                  ? t('ai.mobile.analyzing')
                  : '—'
            : t('ai.mobile.details')}
        </span>
        <ChevronRight size={16} />
      </button>
      <nav className="mobile-dock ai-dock" aria-label={t('ai.dock.toolbar')}>
        <DropdownMenu>
          <DropdownMenuTrigger
            className="dock-button dock-menu"
            aria-label={t('play.actions')}
          >
            <Menu size={23} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={10}
            className="game-menu-popover"
          >
            <DropdownMenuItem onClick={() => setSetup(true)}>
              <RotateCcw />
              <span>{t('ai.newGame')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!!room.result}
              onClick={() => setConfirmResign(true)}
            >
              <Flag />
              <span>{t('play.resign')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleSound}>
              {sound ? <Volume2 /> : <VolumeX />}
              <span>{t(sound ? 'room.sound.off' : 'room.sound.on')}</span>
            </DropdownMenuItem>
            <EffectMenuItems settings={settings} onChange={changeSetting} />
            <DropdownMenuItem onClick={() => location.assign('../')}>
              <ArrowLeft />
              <span>{t('ai.back')}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          className="dock-button"
          onClick={() => setSheet('record')}
          aria-label={t('dock.openMoves')}
        >
          <ScrollText size={21} />
          <span>{t('dock.moves')}</span>
        </button>
        <button
          className={`dock-chat ai-analysis-toggle ${analysisOn ? 'active' : ''}`}
          aria-pressed={analysisOn}
          onClick={() => setAnalysisOn(!analysisOn)}
        >
          <Sparkles size={16} />
          <span>
            {t(analysisOn ? 'ai.dock.analysisOn' : 'ai.dock.analysisOff')}
          </span>
        </button>
        <button className="dock-button" disabled={!canUndo} onClick={undo}>
          <Undo2 size={21} />
          <span>{t('play.undo')}</span>
        </button>
        <button
          className={`dock-button dock-analysis ${branch ? 'active' : ''}`}
          onClick={branch ? backToLive : explore}
        >
          <GitBranch size={21} />
          <span>{t(branch ? 'dock.back' : 'play.explore')}</span>
        </button>
      </nav>
      <GameSheet
        open={sheet === 'record'}
        onOpenChange={(open) => setSheet(open ? 'record' : null)}
        title={t('record.title')}
        description={t('ai.sheet.moves.description')}
      >
        {analysisGame && <GameAnalysisControls analysis={whole} />}
        <GameRecord
          analysis={analysisGame ? whole.analysis : null}
          ratedPly={ratedPly}
          onRatingSelect={showRating}
          history={room.history}
          index={index}
          onNavigate={navigate}
          onLive={backToLive}
        />
      </GameSheet>
      <GameSheet
        open={sheet === 'analysis'}
        onOpenChange={(open) => setSheet(open ? 'analysis' : null)}
        title={t('ai.sheet.eval.title')}
        hideDescription
        description={t(
          branch
            ? 'ai.sheet.eval.branch'
            : review !== null
              ? 'ai.sheet.eval.review'
              : 'ai.sheet.eval.live',
        )}
      >
        {analysisPanel(true)}
      </GameSheet>
      <Dialog
        open={setup}
        onOpenChange={(open) => {
          if (!open) closeSetup();
        }}
      >
        <DialogContent className="ai-setup" showCloseButton={false}>
          <button
            className="ai-setup-close"
            aria-label={t(
              started ? 'ai.setup.close.started' : 'ai.setup.close',
            )}
            onClick={closeSetup}
          >
            <X size={20} />
          </button>
          <DialogTitle>{t('ai.setup.title')}</DialogTitle>
          {started && (
            <DialogDescription>{t('ai.setup.replaces')}</DialogDescription>
          )}
          <fieldset>
            <legend>{t('ai.setup.side')}</legend>
            <div className="ai-choice-row">
              {(['red', 'black'] as Side[]).map((side) => (
                <button
                  key={side}
                  aria-pressed={human === side}
                  className={human === side ? 'selected' : ''}
                  onClick={() => setHuman(side)}
                >
                  {t(side === 'red' ? 'ai.setup.red' : 'ai.setup.black')}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{t('ai.setup.level')}</legend>
            <div className="ai-choice-row">
              {(Object.keys(AI_LEVELS) as AiLevel[]).map((key) => (
                <button
                  key={key}
                  aria-pressed={level === key}
                  className={level === key ? 'selected' : ''}
                  onClick={() => setLevel(key)}
                >
                  {levelName(locale, key)}
                </button>
              ))}
            </div>
          </fieldset>
          {error && (
            <p className="ai-setup-error" role="alert">
              {errorText(locale, error)}
            </p>
          )}
          {engineState === 'error' ? (
            <button className="primary-button" onClick={retryEngine}>
              {t('ai.setup.reload')}
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={engineState !== 'ready'}
              onClick={start}
            >
              <Bot size={18} />
              {t(
                engineState === 'ready' ? 'ai.setup.start' : 'ai.engineLoading',
              )}
            </button>
          )}
          {started && (
            <button className="ai-cancel" onClick={() => setSetup(false)}>
              {t('ai.setup.continue')}
            </button>
          )}
          {engineCredit}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmResign} onOpenChange={setConfirmResign}>
        <DialogContent className="ai-setup">
          <DialogTitle>{t('dialog.resign.title')}</DialogTitle>
          <DialogDescription>{t('ai.resign.body')}</DialogDescription>
          <button
            className="primary-button"
            onClick={() => {
              setMatch(resignAiMatch);
              setConfirmResign(false);
              backToLive();
            }}
          >
            {t('dialog.resign.confirm')}
          </button>
          <button className="ai-cancel" onClick={() => setConfirmResign(false)}>
            {t('ai.resign.keep')}
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
