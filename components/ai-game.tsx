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
  createAiMatch,
  describeLine,
  engineMove,
  evaluationLabel,
  historyPosition,
  playAiMove,
  resignAiMatch,
  squareToEngine,
  undoAiTurn,
  type AiLevel,
  type EngineInfo,
} from '@/lib/ai-game';
import { BrowserEngine, aiBase, prepareAiPage } from '@/lib/ai-engine';
import { useAutoArchive } from '@/lib/use-auto-archive';
import { getArchivedGame } from '@/lib/archive-storage';
import ReviewScreen from '@/components/review-screen';
import {
  replayArchive,
  archiveGame,
  archiveLabel,
  type ArchivedGame,
} from '@/lib/archive';
import AccountMenu from '@/components/account-menu';
import { useAccount } from '@/lib/use-account';
import EffectSettings from '@/components/effect-settings';
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
  sideLabel,
  type Board,
  type Side,
} from '@/lib/xiangqi';
import { useGameViewport } from '@/lib/use-game-viewport';

type Branch = { boards: Board[]; turns: Side[]; base: string; moves: string[] };
type AnalysisResult = { key: string; info: EngineInfo };

export default function AiGame() {
  const { settings, setSetting } = useEffectSettings();
  const account = useAccount();
  const sound = settings.sound;
  const [sessionId] = useState(() => crypto.randomUUID());
  const [archiveId, setArchiveId] = useState(() =>
    new URLSearchParams(location.search).get('game'),
  );
  const [archived, setArchived] = useState<ArchivedGame | null>(null);
  const [archiveLoadError, setArchiveLoadError] = useState('');
  const [match, setMatch] = useState(() => createAiMatch('red', 'medium'));
  const [started, setStarted] = useState(false);
  const [setup, setSetup] = useState(!archiveId);
  const [human, setHuman] = useState<Side>('red');
  const [level, setLevel] = useState<AiLevel>('medium');
  const [engineState, setEngineState] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [error, setError] = useState('');
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
  const archiveError = useAutoArchive(
    room,
    started && !archived && !archiveId ? `ai:${sessionId}:${room.round}` : null,
    { kind: 'ai', level: match.level },
    match.human,
  );
  useEffect(() => {
    if (!archiveId) return;
    let active = true;
    void getArchivedGame(archiveId)
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
          setArchiveLoadError(
            error instanceof Error ? error.message : '无法读取这盘对局',
          );
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
  const line = info ? describeLine(board, turn, info.pv) : [];
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
          setError(e instanceof Error ? e.message : '棋手准备失败，请重试。');
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
    setSearching(true);
    setError('');
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
        setSearching(false);
        if (!aiTurn) return;
        const move = token && engineMove(token);
        if (!move || !legalMove(board, move.from, move.to, turn)) {
          setEngineState('error');
          setError('棋手未返回可用走法，棋局已保留，请重试。');
          return;
        }
        // A result belongs to this exact match object, never a later undo/restart.
        setMatch((current) =>
          current === match ? playAiMove(current, move.from, move.to) : current,
        );
        setSelected(null);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setSearching(false);
        setEngineState('error');
        setError(e instanceof Error ? e.message : '计算失败，请重试。');
      });
    return () => controller.abort();
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
    setError('');
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
    setArchiveLoadError('');
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
  const scoreText =
    info?.mate !== undefined
      ? `杀棋 ${Math.abs(info.mate)}`
      : info?.cp !== undefined
        ? `${info.cp > 0 ? '+' : ''}${(info.cp / 100).toFixed(2)}`
        : '—';
  const redShare =
    info?.mate !== undefined
      ? info.mate > 0
        ? 96
        : info.mate < 0
          ? 4
          : 50
      : 50 + 44 * Math.tanh((info?.cp ?? 0) / 500);
  const status = branch
    ? '独立推演'
    : review !== null
      ? `复盘 · 第 ${index} 步`
      : room.result
        ? `${room.result.winner === 'draw' ? '和棋' : sideLabel(room.result.winner) + '胜'} · ${room.result.reason}`
        : aiTurn
          ? 'AI 思考中'
          : inCheck(board, turn)
            ? '将军 · 请应将'
            : '轮到你走';

  function analysisPanel() {
    return (
      <div className="ai-analysis-panel">
        <div className="ai-analysis-title">
          <Sparkles size={18} />
          <strong>局势分析</strong>
          <button
            className="ai-toggle"
            aria-pressed={analysisOn}
            onClick={() => setAnalysisOn(!analysisOn)}
          >
            {analysisOn ? '已开启' : '已关闭'}
          </button>
        </div>
        {analysisOn ? (
          <>
            <div className="ai-score">
              <strong>{ended ? status : evaluationLabel(info)}</strong>
              <span>{ended ? '' : scoreText}</span>
            </div>
            <div
              className="ai-score-track"
              aria-label={`局势评分：${evaluationLabel(info)}`}
            >
              <span style={{ width: `${redShare}%` }} />
            </div>
            <div className="ai-score-labels">
              <span>红方</span>
              <span>黑方</span>
            </div>
            <p className="ai-best-move">
              {ended
                ? '本局已结束，可打开棋谱逐步复盘。'
                : line.length
                  ? `推荐：${line[0]}`
                  : searching
                    ? '正在计算推荐走法…'
                    : '落子后自动更新分析'}
            </p>
            {!ended && line.length > 1 && (
              <ol className="ai-variation">
                {line.map((text, i) => (
                  <li key={i}>
                    <span>{i + 1}</span>
                    {text}
                  </li>
                ))}
              </ol>
            )}
            <small>
              {!ended && info
                ? `搜索深度 ${info.depth}${searching ? ' · 计算中' : ''} · `
                : ''}
              评分为引擎估计，不代表胜率。
            </small>
          </>
        ) : (
          <p className="ai-muted">开启后显示局势评分和推荐走法。</p>
        )}
      </div>
    );
  }
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
                {archived ? archived.players[side] : me ? '我方' : '象棋 AI'}
              </span>
              {!me && (!archived || archived.mode.kind === 'ai') && (
                <em className="player-tag">{AI_LEVELS[match.level].label}</em>
              )}
            </strong>
          </div>
          <CapturedTray board={board} side={side} />
          {!me && (!archived || archived.mode.kind === 'ai') && (
            <Bot size={20} aria-label="电脑棋手" />
          )}
        </div>
      </div>
    );
  }

  if (archiveId && !archived)
    return (
      <main className="app-shell">
        <a href="../">返回棋社</a>
        <p role={archiveLoadError ? 'alert' : 'status'}>
          {archiveLoadError || '正在读取本地对局…'}
        </p>
        {archiveLoadError && (
          <button
            onClick={() => {
              setArchiveId(null);
              setSetup(true);
              window.history.replaceState(null, '', location.pathname);
            }}
          >
            开始人机对弈
          </button>
        )}
      </main>
    );
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
        onExit={archived ? () => window.location.assign('../') : backToLive}
        exitLabel={archived ? '返回棋社' : '返回对局'}
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
          <span>楚汉棋社</span>
        </a>
        <div className="header-tools">
          <button className="text-button" onClick={() => setSetup(true)}>
            <Settings2 size={17} />
            新的一局
          </button>
          <AccountMenu account={account} />
        </div>
      </header>
      <div className="ai-mobile-nav">
        <a href="../" aria-label="返回棋社">
          <ArrowLeft size={20} />
        </a>
        <strong>{archived ? '对局复盘' : '人机练习'}</strong>
        <span>
          {archived?.mode.kind === 'friend'
            ? '好友对弈'
            : AI_LEVELS[match.level].label}{' '}
          · 第 {room.round} 局
        </span>
        <button onClick={() => setSetup(true)} aria-label="设置新的一局">
          <Settings2 size={20} />
        </button>
      </div>
      <output className="ai-status-line">
        <span>
          {engineState === 'loading' ? '正在准备棋手…' : status}
          {engineState !== 'loading' && aiTurn && visible && (
            <span className="thinking-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </span>
      </output>
      {(archived || (ratedSelection && !branch)) && (
        <div className="ai-review-details">
          {ratedSelection && !branch && (
            <output className="rated-recommendation" aria-live="polite">
              第 {ratedPly} 步走前 · 推荐：
              {ratedSelection.recommendation ?? '本次推荐着不可用'}
            </output>
          )}
          {archived && (
            <p className="archive-banner">
              本地复盘 · {archived.players.red} / {archived.players.black} ·{' '}
              {archiveLabel(archived).result} · {archived.result.reason}
            </p>
          )}
        </div>
      )}
      {account.notice && (
        <output className="notice">
          <span>{account.notice}</span>
          <button aria-label="关闭提示" onClick={account.clearNotice}>
            <X size={15} />
          </button>
        </output>
      )}
      {archiveError && (
        <p className="ai-error" role="alert">
          {archiveError}
        </p>
      )}
      {error && (
        <div className="ai-error" role="alert">
          <span>{error}</span>
          <button onClick={retryEngine}>重试</button>
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
                  ? `推演 ${branch.boards.length - 1} 步`
                  : `复盘 ${index}/${room.history.length}`}
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
                  退一步
                </button>
              ) : (
                <>
                  <button
                    aria-label="复盘上一步"
                    disabled={index === 0}
                    onClick={() => navigate(index - 1)}
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    aria-label="复盘下一步"
                    disabled={index === room.history.length}
                    onClick={() => navigate(index + 1)}
                  >
                    <ChevronRight size={18} />
                  </button>
                </>
              )}
              <button onClick={backToLive}>
                {archived ? '返回复盘' : '返回对局'}
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
                  再来一局
                </button>
                <button className="secondary-button" onClick={undo}>
                  悔棋继续
                </button>
                <button
                  className="secondary-button"
                  disabled={!room.history.length}
                  onClick={() => navigate(0)}
                >
                  复盘
                </button>
              </div>
            </div>
          )}
          <div className="ai-desktop-actions">
            <button disabled={!canUndo} onClick={undo}>
              <Undo2 size={18} />
              悔棋
            </button>
            <button onClick={branch ? backToLive : explore}>
              <GitBranch size={18} />
              {branch ? (archived ? '返回复盘' : '返回对局') : '推演'}
            </button>
            <button
              disabled={!!room.result}
              onClick={() => setConfirmResign(true)}
            >
              <Flag size={18} />
              认输
            </button>
            <button
              className="ai-sound-toggle"
              aria-label={sound ? '关闭对局音效' : '开启对局音效'}
              title={sound ? '关闭音效' : '开启音效'}
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
              <strong>对局棋谱</strong>
              <span>{room.history.length} 步</span>
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
          <p className="ai-engine-credit">
            本地引擎{' '}
            <a
              href="https://github.com/fairy-stockfish/fairy-stockfish.wasm"
              target="_blank"
              rel="noreferrer"
            >
              Fairy-Stockfish
            </a>{' '}
            ·{' '}
            <a
              href={`${assetBase}engine/SOURCE.md`}
              target="_blank"
              rel="noreferrer"
            >
              源码与许可
            </a>
          </p>
        </aside>
      </div>
      <button
        className="ai-mobile-evaluation"
        onClick={() => setSheet('analysis')}
        aria-label="查看局势分析详情"
      >
        <Sparkles size={17} />
        <strong>
          {analysisOn
            ? ended
              ? '本局结束'
              : evaluationLabel(info)
            : '局势分析已关闭'}
        </strong>
        <span>
          {analysisOn && !ended
            ? line[0]
              ? `推荐 ${line[0]}`
              : searching
                ? '分析中…'
                : '—'
            : '查看详情'}
        </span>
        <ChevronRight size={16} />
      </button>
      <nav className="mobile-dock ai-dock" aria-label="人机对局工具栏">
        <DropdownMenu>
          <DropdownMenuTrigger
            className="dock-button dock-menu"
            aria-label="对局操作"
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
              <span>新的一局</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!!room.result}
              onClick={() => setConfirmResign(true)}
            >
              <Flag />
              <span>认输</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleSound}>
              {sound ? <Volume2 /> : <VolumeX />}
              <span>{sound ? '关闭音效' : '开启音效'}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => location.assign('../')}>
              <ArrowLeft />
              <span>返回棋社</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          className="dock-button"
          onClick={() => setSheet('record')}
          aria-label="打开对局棋谱"
        >
          <ScrollText size={21} />
          <span>棋谱</span>
        </button>
        <button
          className={`dock-chat ai-analysis-toggle ${analysisOn ? 'active' : ''}`}
          aria-pressed={analysisOn}
          onClick={() => setAnalysisOn(!analysisOn)}
        >
          <Sparkles size={16} />
          <span>{analysisOn ? '分析已开' : '开启分析'}</span>
        </button>
        <button className="dock-button" disabled={!canUndo} onClick={undo}>
          <Undo2 size={21} />
          <span>悔棋</span>
        </button>
        <button
          className={`dock-button dock-analysis ${branch ? 'active' : ''}`}
          onClick={branch ? backToLive : explore}
        >
          <GitBranch size={21} />
          <span>{branch ? '返回' : '推演'}</span>
        </button>
      </nav>
      <GameSheet
        open={sheet === 'record'}
        onOpenChange={(open) => setSheet(open ? 'record' : null)}
        title="对局棋谱"
        description="点击着法回看局面，返回对局后继续练习。"
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
        title="局势与推荐"
        description={
          branch
            ? '当前独立推演局面的分析'
            : review !== null
              ? '当前复盘局面的分析'
              : '当前对局的分析'
        }
      >
        {analysisPanel()}
        <p className="ai-engine-credit">
          Fairy-Stockfish ·{' '}
          <a
            href={`${assetBase}engine/SOURCE.md`}
            target="_blank"
            rel="noreferrer"
          >
            源码与许可
          </a>
        </p>
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
            aria-label={started ? '关闭设置' : '退出人机设置'}
            onClick={closeSetup}
          >
            <X size={20} />
          </button>
          <DialogTitle>和 AI 下盘棋</DialogTitle>
          {started && (
            <DialogDescription>开始后会替换当前练习棋局。</DialogDescription>
          )}
          <fieldset>
            <legend>我方执子</legend>
            <div className="ai-choice-row">
              {(['red', 'black'] as Side[]).map((side) => (
                <button
                  key={side}
                  aria-pressed={human === side}
                  className={human === side ? 'selected' : ''}
                  onClick={() => setHuman(side)}
                >
                  {side === 'red' ? '执红 · 先手' : '执黑 · 后手'}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>棋手难度</legend>
            <div className="ai-choice-row">
              {(Object.keys(AI_LEVELS) as AiLevel[]).map((key) => (
                <button
                  key={key}
                  aria-pressed={level === key}
                  className={level === key ? 'selected' : ''}
                  onClick={() => setLevel(key)}
                >
                  {AI_LEVELS[key].label}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="ai-setup-note">
            悔棋会退回到你上一次落子前；已结束的对局会自动保存在当前浏览器，未结束的棋局仅保留在当前页面。
          </p>
          {error && (
            <p className="ai-setup-error" role="alert">
              {error}
            </p>
          )}
          {engineState === 'error' ? (
            <button className="primary-button" onClick={retryEngine}>
              重新加载棋手
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={engineState !== 'ready'}
              onClick={start}
            >
              <Bot size={18} />
              {engineState === 'ready' ? '开始对弈' : '正在准备棋手…'}
            </button>
          )}
          {started && (
            <button className="ai-cancel" onClick={() => setSetup(false)}>
              继续当前对局
            </button>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={confirmResign} onOpenChange={setConfirmResign}>
        <DialogContent className="ai-setup">
          <DialogTitle>确认认输？</DialogTitle>
          <DialogDescription>
            结束本局练习。之后仍可悔棋继续或重新开局。
          </DialogDescription>
          <button
            className="primary-button"
            onClick={() => {
              setMatch(resignAiMatch);
              setConfirmResign(false);
              backToLive();
            }}
          >
            确认认输
          </button>
          <button className="ai-cancel" onClick={() => setConfirmResign(false)}>
            继续对弈
          </button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
