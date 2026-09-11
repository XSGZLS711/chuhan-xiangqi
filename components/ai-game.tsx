'use client';
/* oxlint-disable next/no-html-link-for-pages -- AI isolation requires full document navigation; this component is also a standalone Pages entry. */
import { useEffect, useRef, useState } from 'react';
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
  X,
} from 'lucide-react';
import ChessBoard from './chess-board';
import CapturedTray from './captured-tray';
import GameRecord from './game-record';
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
import { BrowserEngine, prepareAiPage } from '@/lib/ai-engine';
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
  const [match, setMatch] = useState(() => createAiMatch('red', 'medium'));
  const [started, setStarted] = useState(false);
  const [setup, setSetup] = useState(true);
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
  const engineRef = useRef<BrowserEngine | null>(null);
  const viewport = useGameViewport(started);
  const { room } = match;
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
  const live = review === null && !branch;
  const aiTurn = started && live && !room.result && room.turn !== match.human;
  const canMove =
    started &&
    !setup &&
    (!!branch || (live && !room.result && room.turn === match.human));
  const targets = selected === null ? [] : legalTargets(board, selected);
  const canUndo =
    room.history.some((m) => m.side === match.human) || !!room.result;
  const ended = live && !!room.result;

  useEffect(() => {
    let disposed = false;
    let engine: BrowserEngine | undefined;
    void (async () => {
      try {
        await prepareAiPage();
        if (disposed) return;
        engine = new BrowserEngine();
        engineRef.current = engine;
        await engine.ready;
        if (!disposed) setEngineState('ready');
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
    setReview(null);
    setBranch(null);
    setSelected(null);
    setSheet(null);
  }
  function undo() {
    setMatch(undoAiTurn);
    backToLive();
  }
  function navigate(next: number) {
    setReview(Math.max(0, Math.min(room.history.length, next)));
    setBranch(null);
    setSelected(null);
    setSheet(null);
  }
  function explore() {
    setBranch({ boards: [board], turns: [turn], base: position, moves: [] });
    setSelected(null);
    setSheet(null);
  }
  function square(n: number) {
    if (!canMove) return;
    if (selected !== null && legalMove(board, selected, n, turn)) {
      if (branch)
        setBranch({
          ...branch,
          boards: [...branch.boards, moveBoard(board, selected, n)],
          turns: [...branch.turns, opposite(turn)],
          moves: [
            ...branch.moves,
            squareToEngine(selected) + squareToEngine(n),
          ],
        });
      else setMatch((current) => playAiMove(current, selected, n));
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
          ? 'AI 思考中…'
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
            <strong>{me ? '我方' : '象棋 AI'}</strong>
            <small>
              {sideLabel(side)} ·{' '}
              {me ? '从容落子' : AI_LEVELS[match.level].label}
            </small>
          </div>
          {!me && <Bot size={20} aria-label="电脑棋手" />}
        </div>
        <CapturedTray board={board} side={side} />
      </div>
    );
  }

  return (
    <main
      className={`app-shell ai-room ${started ? 'in-room' : ''} ${ended ? 'game-ended' : ''}`}
      style={viewport}
    >
      <header className="site-header">
        <a className="brand" href="../">
          <span className="brand-seal">楚</span>
          <span>
            楚汉棋社<small>人机练习</small>
          </span>
        </a>
        <button className="text-button" onClick={() => setSetup(true)}>
          <Settings2 size={17} />
          新的一局
        </button>
      </header>
      <div className="ai-mobile-nav">
        <a href="../" aria-label="返回棋社">
          <ArrowLeft size={20} />
        </a>
        <strong>人机练习</strong>
        <span>
          {AI_LEVELS[match.level].label} · 第 {room.round} 局
        </span>
        <button onClick={() => setSetup(true)} aria-label="设置新的一局">
          <Settings2 size={20} />
        </button>
      </div>
      <output className="ai-status-line">
        <span>{engineState === 'loading' ? '正在准备棋手…' : status}</span>
        <span>{!visible ? '已暂停' : searching ? '计算中' : '本机对弈'}</span>
      </output>
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
            <ChessBoard
              board={board}
              flipped={match.human === 'black'}
              selected={selected}
              targets={targets}
              last={branch ? null : room.history[index - 1]}
              onSquare={square}
              checkSide={inCheck(board, turn) ? turn : null}
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
              <button onClick={backToLive}>返回对局</button>
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
              {branch ? '返回对局' : '独立推演'}
            </button>
            <button
              disabled={!!room.result}
              onClick={() => setConfirmResign(true)}
            >
              <Flag size={18} />
              认输
            </button>
          </div>
        </section>
        <aside className="room-column">
          {analysisPanel()}
          <section className="panel ai-record-panel">
            <div className="panel-heading">
              <strong>对局棋谱</strong>
              <span>{room.history.length} 步</span>
            </div>
            <GameRecord
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
            <a href="./engine/SOURCE.md" target="_blank" rel="noreferrer">
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
        <GameRecord
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
          <a href="./engine/SOURCE.md" target="_blank" rel="noreferrer">
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
          <DialogDescription>
            {started
              ? '开始后会替换当前练习棋局。'
              : '选择执子和难度，随时悔棋、推演与复盘。'}
          </DialogDescription>
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
            悔棋会退回到你上一次落子前；练习棋局仅保留在当前页面。
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
