'use client';
import './lobby.css';
import { useEffect, useRef, useState } from 'react';
import { gameFetch, invitationUrl } from '@/lib/client-api';
import ChessBoard from '@/components/chess-board';
import CapturedTray from '@/components/captured-tray';
import GameActions from '@/components/game-actions';
import GameRecord from '@/components/game-record';
import ChatLog from '@/components/chat-log';
import GameSheet from '@/components/game-sheet';
import MobileDock from '@/components/mobile-dock';
import GameLobby from '@/components/game-lobby';
import {
  canPlayLive,
  rematchControl,
  recentChat,
  displayNotation,
} from '@/lib/mobile-game';
import { useGameViewport } from '@/lib/use-game-viewport';
import { GameAudio } from '@/lib/game-audio';
import {
  updateFeedback,
  branchFeedback,
  effectDuration,
  LOW_CLOCK_MS,
  type BoardEffect,
  type SoundKind,
} from '@/lib/presentation';
import {
  initialBoard,
  legalTargets,
  legalMove,
  moveBoard,
  Side,
  opposite,
  inCheck,
  notation,
  Board,
  sideLabel,
} from '@/lib/xiangqi';
import type { PublicRoom } from '@/lib/game';
import {
  Users,
  Bot,
  ArrowRight,
  Undo2,
  GitBranch,
  Handshake,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  Send,
  ArrowLeft,
  RefreshCw,
  X,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
type Analysis = {
  boards: Board[];
  turns: Side[];
  texts: string[];
  base: number;
};
const emptyBoard = initialBoard();
const timeOptions = [
  { value: '0', label: '不限时 · 从容对弈' },
  { value: '10', label: '每方 10 分钟' },
  { value: '20', label: '每方 20 分钟' },
  { value: '30', label: '每方 30 分钟' },
];
export default function Home() {
  const [room, setRoom] = useState<PublicRoom | null>(null),
    [roomId, setRoomId] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [connection, setConnection] = useState<'online' | 'offline' | 'loading'>(
      'loading',
    );
  const [name, setName] = useState('棋友'),
    [minutes, setMinutes] = useState('0'),
    [modal, setModal] = useState<'create' | 'rules' | 'invite' | 'name' | null>(
      null,
    ),
    [confirm, setConfirm] = useState<'resign' | 'rematch' | null>(null);
  const [message, setMessage] = useState(''),
    [selected, setSelected] = useState<number | null>(null),
    [flipped, setFlipped] = useState(false),
    [sound, setSound] = useState(true),
    [tick, setTick] = useState(Date.now()),
    [review, setReview] = useState<number | null>(null),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [chat, setChat] = useState(''),
    [boardEffect, setBoardEffect] = useState<BoardEffect | null>(null),
    [sheet, setSheet] = useState<'record' | null>(null);
  const viewportStyle = useGameViewport(!!room);
  const roomRef = useRef<PublicRoom | null>(null),
    nameRef = useRef(name),
    autoJoin = useRef(''),
    clockOffset = useRef(0),
    soundRef = useRef(sound),
    audioRef = useRef<GameAudio | null>(null),
    viewModeRef = useRef<'live' | 'review' | 'analysis'>('live'),
    locked = useRef(false),
    orientationRoom = useRef(''),
    alive = useRef(true);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    viewModeRef.current = analysis
      ? 'analysis'
      : review !== null
        ? 'review'
        : 'live';
  }, [analysis, review]);
  useEffect(() => {
    if (!boardEffect) return;
    const timer = setTimeout(
      () => setBoardEffect(null),
      effectDuration(boardEffect.kind),
    );
    return () => clearTimeout(timer);
  }, [boardEffect]);
  // Hints fade on their own; connection trouble stays until it is resolved.
  useEffect(() => {
    if (!message || /连接|重连/.test(message)) return;
    const timer = setTimeout(() => setMessage(''), 5200);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => () => audioRef.current?.close(), []);
  function unlockSound() {
    if (!soundRef.current) return;
    audioRef.current ??= new GameAudio();
    audioRef.current.unlock();
  }
  function playSound(kind: SoundKind, delay = 0) {
    if (soundRef.current) audioRef.current?.play(kind, delay);
  }
  function update(r: PublicRoom) {
    if (!alive.current) return;
    const prev = roomRef.current;
    if (prev?.id === r.id && prev.version > r.version) return;
    clockOffset.current = r.serverNow - Date.now();
    if (prev?.id === r.id && prev.version !== r.version) {
      const feedback = updateFeedback(prev, r);
      feedback.sounds.forEach((kind, index) =>
        playSound(
          kind,
          index ? 0.36 : kind === 'move' || kind === 'capture' ? 0.18 : 0,
        ),
      );
      if (feedback.reset) setBoardEffect(null);
      if (feedback.effect && viewModeRef.current === 'live')
        setBoardEffect(feedback.effect);
      setSelected(null);
      if (prev.round !== r.round) {
        setReview(null);
        setAnalysis(null);
        orientationRoom.current = '';
      }
    }
    roomRef.current = r;
    setRoom(r);
    setConnection('online');
    setMessage((m) =>
      m.includes('连接不上') || m.includes('连接中断') || m.includes('无法连接')
        ? ''
        : m,
    );
    if (r.you && orientationRoom.current !== r.id) {
      setFlipped(r.you === 'black');
      orientationRoom.current = r.id;
    }
  }
  async function fetchRoom(id: string) {
    const res = await gameFetch('/api/game?room=' + encodeURIComponent(id), {
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    const data = (await res.json()) as PublicRoom & { error?: string };
    if (!res.ok) throw new Error(data.error);
    return data as PublicRoom;
  }
  useEffect(() => {
    alive.current = true;
    setRoomId(new URLSearchParams(location.search).get('room') || '');
    try {
      setName(localStorage.getItem('chuhan-name') || '棋友');
      setSound(localStorage.getItem('chuhan-sound') !== 'off');
    } catch {}
    const initialize = async () => {
      try {
        const res = await gameFetch('/api/game', {
          cache: 'no-store',
          signal: AbortSignal.timeout(12000),
        });
        if (!res.ok) throw new Error();
        setReady(true);
        setConnection('online');
      } catch {
        setConnection('offline');
        setMessage('暂时连接不上棋室，点击右上角重新连接。');
      }
    };
    void initialize();
    const timer = setInterval(() => setTick(Date.now()), 500);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!roomId || !ready) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const r = await fetchRoom(roomId);
        if (disposed) return;
        update(r);
        if (
          !r.you &&
          !r.players.black &&
          autoJoin.current !== roomId &&
          new URLSearchParams(location.search).get('spectate') !== '1'
        ) {
          autoJoin.current = roomId;
          const res = await gameFetch('/api/game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'join',
              room: roomId,
              version: r.version,
              name: nameRef.current,
            }),
          });
          const joined = (await res.json()) as PublicRoom & { error?: string };
          if (disposed) return;
          if (res.ok) update(joined);
          else {
            autoJoin.current = '';
            if (res.status !== 409)
              setMessage(joined.error || '入座未成功，请重新连接。');
          }
        }
      } catch (e) {
        if (!disposed) {
          setConnection('offline');
          setMessage(
            e instanceof Error ? e.message : '棋室连接中断，正在重连。',
          );
        }
      } finally {
        if (!disposed) timer = setTimeout(poll, document.hidden ? 5000 : 1400);
      }
    };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [roomId, ready]);
  async function reconnect() {
    setConnection('loading');
    try {
      const res = await gameFetch('/api/game', {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error();
      setReady(true);
      if (roomId) update(await fetchRoom(roomId));
      setConnection('online');
      setMessage('连接已恢复。');
    } catch {
      setConnection('offline');
      setMessage('仍然无法连接，请检查网络后再试。');
    }
  }
  async function action(
    kind: string,
    extra: Record<string, unknown> = {},
  ): Promise<boolean> {
    if (locked.current) return false;
    locked.current = true;
    setBusy(true);
    try {
      const current = roomRef.current;
      const res = await gameFetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          action: kind,
          room: current?.id,
          version: current?.version,
          ...extra,
        }),
      });
      const data = (await res.json()) as PublicRoom & { error?: string };
      if (!res.ok) {
        if (res.status === 409 && current) update(await fetchRoom(current.id));
        throw new Error(data.error || '操作未成功。');
      }
      update(data);
      setSelected(null);
      setMessage('');
      if (kind === 'create') {
        setReady(true);
        setRoomId(data.id);
        history.replaceState(null, '', '?room=' + data.id);
        setModal('invite');
      }
      return true;
    } catch (e) {
      setMessage(e instanceof Error ? e.message : '网络不稳定，请稍后重试。');
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function rememberName() {
    try {
      localStorage.setItem('chuhan-name', name.trim() || '棋友');
    } catch {}
  }
  const historyMoves = room?.history ?? [],
    reviewIndex =
      review === null
        ? historyMoves.length
        : Math.min(review, historyMoves.length),
    reviewBoard =
      reviewIndex === historyMoves.length
        ? (room?.board ?? emptyBoard)
        : historyMoves[reviewIndex].before;
  const board = analysis
      ? analysis.boards[analysis.boards.length - 1]
      : reviewBoard,
    turn = analysis
      ? analysis.turns[analysis.turns.length - 1]
      : reviewIndex === historyMoves.length
        ? (room?.turn ?? 'red')
        : historyMoves[reviewIndex].side;
  const check = inCheck(board, turn) ? turn : null,
    targets = selected === null ? [] : legalTargets(board, selected),
    last = analysis
      ? null
      : reviewIndex > 0
        ? historyMoves[reviewIndex - 1]
        : null;
  const participant = !!room?.you,
    canAct = participant && !!room?.players.black && !busy;
  function square(n: number) {
    if (!analysis) {
      if (review !== null) return;
      if (!room) {
        setMessage('创建好友对局开始对弈，或点击“推演”先试试棋。');
        return;
      }
      // Off-turn touches are deliberately silent and never select a piece.
      if (!canPlayLive(room, busy)) return;
    }
    if (selected !== null && legalMove(board, selected, n, turn)) {
      if (analysis) {
        const next = moveBoard(board, selected, n);
        setAnalysis({
          ...analysis,
          boards: [...analysis.boards, next],
          turns: [...analysis.turns, opposite(turn)],
          texts: [...analysis.texts, notation(board, selected, n)],
        });
        const feedback = branchFeedback(
          board,
          selected,
          n,
          turn,
          `analysis:${Date.now()}`,
        );
        setBoardEffect(feedback.effect);
        feedback.sounds.forEach((kind, index) =>
          playSound(kind, index ? 0.36 : 0.18),
        );
      } else void action('move', { from: selected, to: n });
      setSelected(null);
    } else if (board[n]?.side === turn) {
      setSelected(n === selected ? null : n);
      setMessage('');
    } else if (selected !== null) setMessage('这一步不可走，请选择标记位置。');
  }
  function returnToLive() {
    setBoardEffect(null);
    setReview(null);
    setAnalysis(null);
    setSelected(null);
  }
  async function undoAndContinue() {
    if (await action('undo')) returnToLive();
  }
  function rematch() {
    if (!room) return;
    const control = rematchControl(room, busy);
    if (control.disabled) return;
    if (control.intent === 'accept') void action('respond', { accept: true });
    else if (room.result) void action('offer-rematch');
    else setConfirm('rematch');
  }
  async function sendChat() {
    if (!chat.trim()) return false;
    const sent = await action('chat', { text: chat.trim() });
    if (sent) setChat('');
    return sent;
  }
  function toggleSound() {
    setSound(!sound);
    soundRef.current = !sound;
    if (sound) audioRef.current?.silence();
    else unlockSound();
    try {
      localStorage.setItem('chuhan-sound', sound ? 'off' : 'on');
    } catch {}
  }
  function startAnalysis() {
    setSheet(null);
    setBoardEffect(null);
    setAnalysis({
      boards: [board],
      turns: [turn],
      texts: [],
      base: reviewIndex,
    });
    setSelected(null);
    setMessage('');
  }
  function exitAnalysis() {
    setBoardEffect(null);
    setAnalysis(null);
    setReview(null);
    setSelected(null);
    setMessage('');
  }
  function navigate(n: number) {
    setBoardEffect(null);
    setReview(Math.max(0, Math.min(historyMoves.length, n)));
    setAnalysis(null);
    setSelected(null);
  }
  const inviteUrl =
    typeof window !== 'undefined' && room
      ? invitationUrl(location.origin, location.pathname, room.id)
      : '';
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage('邀请链接已复制，发给好友即可入座。');
    } catch {
      setModal('invite');
      setMessage('请长按或选中链接复制。');
    }
  }
  function download() {
    if (!room) return;
    const lines = [
      `楚汉棋社 · 第 ${room.round} 局`,
      `${room.players.red.name}（红） 对 ${room.players.black?.name ?? '待入座'}（黑）`,
      room.result
        ? `${room.result.winner === 'draw' ? '和棋' : sideLabel(room.result.winner) + '胜'} · ${room.result.reason}`
        : '对弈中',
      '',
      ...historyMoves.map(
        (m, i) =>
          `${i + 1}. ${sideLabel(m.side)} ${displayNotation(m.text)}${m.check ? ' 将军' : ''}`,
      ),
      '',
      '坐标记录：',
      ...historyMoves.map(
        (m) =>
          `${m.from % 9},${Math.floor(m.from / 9)} → ${m.to % 9},${Math.floor(m.to / 9)}`,
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `楚汉棋谱-第${room.round}局.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clockMs(s: Side): number | null {
    if (!room?.clockMinutes) return null;
    let remaining = room.clocks[s];
    if (room.players.black && !room.result && room.turn === s)
      remaining -= Math.max(0, tick + clockOffset.current - room.turnAt);
    return Math.max(0, remaining);
  }
  function clockText(s: Side) {
    const remaining = clockMs(s);
    if (remaining === null) return '不限时';
    const secs = Math.ceil(remaining / 1000);
    return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  }
  function scorePanel() {
    return (
      <section className="panel score-panel">
        <Tabs defaultValue="record">
          <div className="panel-heading">
            <TabsList variant="line">
              <TabsTrigger value="record">对局棋谱</TabsTrigger>
              <TabsTrigger value="chat">
                棋友聊天 {room?.chat.length ? `· ${room.chat.length}` : ''}
              </TabsTrigger>
            </TabsList>
            <button
              className="icon-button"
              aria-label="导出棋谱"
              title="导出棋谱"
              disabled={!room}
              onClick={download}
            >
              <Download size={16} />
            </button>
          </div>
          <TabsContent value="record">
            <GameRecord
              history={historyMoves}
              index={reviewIndex}
              onNavigate={(index) => {
                navigate(index);
                setSheet(null);
              }}
              onLive={returnToLive}
            />
            <div className="record-sheet-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  returnToLive();
                  setSheet(null);
                }}
              >
                返回对局
              </button>
              <button
                className="primary-button compact"
                onClick={startAnalysis}
              >
                从此处推演
              </button>
            </div>
          </TabsContent>
          <TabsContent value="chat">
            <ChatLog
              messages={room?.chat ?? []}
              you={room?.you ?? null}
              names={room?.players}
            />
            <form
              className="chat-form"
              onSubmit={async (e) => {
                e.preventDefault();
                await sendChat();
              }}
            >
              <input
                aria-label="聊天消息"
                placeholder={participant ? '和棋友说句话…' : '观战中'}
                value={chat}
                maxLength={120}
                disabled={!participant}
                onChange={(e) => setChat(e.target.value)}
              />
              <button
                aria-label="发送消息"
                disabled={!participant || !chat.trim() || busy}
              >
                <Send size={18} />
              </button>
            </form>
          </TabsContent>
        </Tabs>
      </section>
    );
  }
  function player(s: Side) {
    const p = room?.players[s],
      me = room?.you === s,
      bubble = recentChat(room, s, tick + clockOffset.current),
      remaining = clockMs(s),
      lowTime =
        remaining !== null &&
        remaining <= LOW_CLOCK_MS &&
        !!room?.players.black &&
        !room.result;
    return (
      <div className={`player-seat seat-${s}`}>
        <div
          className={`player-bar ${room?.players.black && !room.result && room.turn === s ? 'active-player' : ''}`}
        >
          <div className="player-avatar">
            <span className={`avatar ${s}`}>{s === 'red' ? '帅' : '将'}</span>
            {bubble && (
              <output
                className="avatar-bubble"
                key={`${s}:${bubble.at}`}
                aria-live="polite"
                title={bubble.text}
              >
                {bubble.text}
              </output>
            )}
          </div>
          <div className="player-name-block">
            <strong>
              {p && (
                <i
                  className={`presence-dot ${p.online ? 'present' : ''}`}
                  title={`${p.online ? '在线' : '暂时离线'} · ${sideLabel(s)}`}
                />
              )}
              <span className="player-name">
                {p ? p.name : s === 'black' ? '虚位以待' : '我方'}
              </span>
              {me && <em className="player-tag">我方</em>}
              {me && (
                <button
                  className="inline-link"
                  onClick={() => setModal('name')}
                >
                  改名
                </button>
              )}
            </strong>
          </div>
          <CapturedTray board={board} side={s} />
          <span
            className={`player-clock ${room?.clockMinutes ? 'timed-clock' : ''} ${lowTime ? 'low-time' : ''}`}
          >
            {clockText(s)}
          </span>
        </div>
      </div>
    );
  }
  const pillText = analysis
    ? '独立推演'
    : review !== null
      ? '棋谱复盘'
      : room?.result
        ? '对局结束'
        : room && !room.you
          ? '观战中'
          : room?.players.black
            ? check
              ? '将军！'
              : sideLabel(room.turn) + '走棋'
            : room
              ? '等待好友'
              : '正在连接';
  const rematchButton = room ? rematchControl(room, busy) : null;
  const ended = !!room?.result && !analysis && review === null;
  const lobby = !room && !roomId && !analysis;
  return (
    <main
      className={`app-shell ${lobby ? 'is-lobby' : 'table-view'} ${room ? 'in-room' : ''} ${ended ? 'game-ended' : ''} ${analysis ? 'is-analysis' : ''} ${review !== null && !analysis ? 'is-review' : ''}`}
      style={viewportStyle}
      onPointerDown={unlockSound}
      onKeyDownCapture={unlockSound}
    >
      <header className="site-header">
        <a href="./" className="brand">
          <span className="brand-seal">楚</span>
          <span>楚汉棋社</span>
        </a>
        <div className="header-tools">
          {!lobby && (
            <>
              <button
                className="text-button icon-tool"
                aria-label="翻转棋盘"
                title="翻转棋盘"
                onClick={() => {
                  setFlipped(!flipped);
                  setSelected(null);
                }}
              >
                <RotateCw size={17} />
              </button>
              <button
                className="text-button icon-tool"
                aria-label={sound ? '关闭对局音效' : '开启对局音效'}
                title={sound ? '关闭音效' : '开启音效'}
                onClick={toggleSound}
              >
                {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
            </>
          )}
          <button
            title={connection === 'online' ? '棋室已连接' : '点击重新连接'}
            aria-label="重新连接棋室"
            className={`text-button connection-${connection}`}
            onClick={reconnect}
          >
            {connection === 'online' ? (
              <Wifi size={16} />
            ) : (
              <WifiOff size={16} />
            )}
          </button>
          <button
            className="text-button"
            aria-label="对局规则"
            title="对局规则"
            onClick={() => setModal('rules')}
          >
            <BookOpen size={17} /> <span className="tool-label">对局规则</span>
          </button>
        </div>
      </header>
      {room && (
        <div className="mobile-room-nav">
          <span className="mobile-room-title">
            <strong>好友对弈</strong> <small>第 {room.round} 局</small>
          </span>
          <span className={`mobile-room-status ${check ? 'check-status' : ''}`}>
            {analysis
              ? '独立推演'
              : review !== null
                ? '复盘中'
                : room.result
                  ? '本局结束'
                  : !room.players.black
                    ? '等待好友'
                    : !room.you
                      ? '观战中'
                      : check
                        ? room.you === room.turn
                          ? '将军 · 请应将'
                          : '对方应将'
                        : room.you === room.turn
                          ? '轮到你走'
                          : '对方思考中'}
          </span>
          <button
            className={`mobile-connect connection-${connection}`}
            aria-label="重新连接棋室"
            onClick={reconnect}
          >
            {connection === 'online' ? (
              <Wifi size={15} />
            ) : (
              <WifiOff size={15} />
            )}
          </button>
          <button className="mobile-invite" onClick={copyInvite}>
            <Users size={16} />
            <span>邀请</span>
          </button>
        </div>
      )}
      {room?.offer && (
        <div className="mobile-offer-bar" role="status">
          <span>
            {room.offer.side === room.you
              ? '等待好友回应'
              : room.offer.kind === 'draw'
                ? '好友提议和棋'
                : '好友邀你再战'}
          </span>
          {room.offer.side === room.you ? (
            <button disabled={busy} onClick={() => void action('cancel-offer')}>
              撤回
            </button>
          ) : participant ? (
            <>
              <button
                disabled={busy}
                onClick={() => void action('respond', { accept: false })}
              >
                婉拒
              </button>
              <button
                className="accept-offer"
                disabled={busy}
                onClick={() => void action('respond', { accept: true })}
              >
                {room.offer.kind === 'rematch' ? '应邀出战' : '同意'}
              </button>
            </>
          ) : null}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          <span>{message}</span>
          <button aria-label="关闭提示" onClick={() => setMessage('')}>
            <X size={15} />
          </button>
        </div>
      )}
      {lobby ? (
        <GameLobby
          friendDisabled={busy}
          onCreate={() => setModal('create')}
          onExplore={startAnalysis}
        />
      ) : (
        <div className="workspace">
          <section className="play-column">
            {roomId && !room && (
              <div className="room-loading" role="status">
                {connection === 'offline'
                  ? '暂时无法打开棋室，请重新连接。'
                  : '正在打开好友棋室…'}
              </div>
            )}
            {player(flipped ? 'red' : 'black')}
            <div className="board-stage">
              <ChessBoard
                board={board}
                selected={selected}
                targets={targets}
                last={last}
                onSquare={square}
                flipped={flipped}
                checkSide={check}
                effect={boardEffect}
                animationContext={`${room?.id ?? 'local'}:${room?.round ?? 0}:${analysis ? 'analysis' : review !== null ? 'review' : 'live'}`}
                animate={!!analysis || review === null}
              />
            </div>
            {player(flipped ? 'black' : 'red')}
            {analysis ? (
              <div className="analysis-controls">
                <span>
                  <GitBranch size={17} /> 推演 {analysis.texts.length} 步
                </span>
                <button
                  disabled={analysis.boards.length < 2}
                  onClick={() => {
                    setBoardEffect(null);
                    setAnalysis({
                      ...analysis,
                      boards: analysis.boards.slice(0, -1),
                      turns: analysis.turns.slice(0, -1),
                      texts: analysis.texts.slice(0, -1),
                    });
                    setSelected(null);
                  }}
                >
                  <Undo2 size={17} />
                  退一步
                </button>
                <button
                  onClick={() => {
                    setBoardEffect(null);
                    setAnalysis({
                      ...analysis,
                      boards: [analysis.boards[0]],
                      turns: [analysis.turns[0]],
                      texts: [],
                    });
                    setSelected(null);
                  }}
                >
                  重置
                </button>
                <button onClick={exitAnalysis}>
                  <ArrowLeft size={17} />
                  返回对局
                </button>
              </div>
            ) : review !== null ? (
              <div className="analysis-controls">
                <span>复盘 · 第 {reviewIndex} 步</span>
                <button
                  className="review-step"
                  aria-label="复盘上一步"
                  disabled={!reviewIndex}
                  onClick={() => navigate(reviewIndex - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  className="review-step"
                  aria-label="复盘下一步"
                  disabled={reviewIndex >= historyMoves.length}
                  onClick={() => navigate(reviewIndex + 1)}
                >
                  <ChevronRight size={17} />
                </button>
                <button onClick={startAnalysis}>
                  <GitBranch size={17} />
                  从此处推演
                </button>
                <button
                  onClick={() => {
                    setReview(null);
                    setSelected(null);
                  }}
                >
                  返回对局
                </button>
              </div>
            ) : (
              <GameActions
                canUndo={canAct && (!!historyMoves.length || !!room?.result)}
                canDraw={canAct && !room?.result && !room?.offer}
                canResign={canAct && !room?.result}
                canRematch={canAct && !room?.offer}
                onUndo={() => void undoAndContinue()}
                onAnalysis={startAnalysis}
                onDraw={() => void action('offer-draw')}
                onResign={() => setConfirm('resign')}
                onRematch={() => setConfirm('rematch')}
              />
            )}
            {room?.result && !analysis && review === null && (
              <div className="endgame-panel">
                <div className="endgame-caption">
                  <strong>
                    {room.result.winner === 'draw'
                      ? '和棋'
                      : sideLabel(room.result.winner) + '获胜'}
                  </strong>
                  <span>{room.result.reason}</span>
                </div>
                <div className="endgame-buttons">
                  <button
                    className="primary-button"
                    disabled={rematchButton?.disabled}
                    onClick={rematch}
                  >
                    {rematchButton?.label ?? '再来一局'}
                  </button>
                  <button
                    className="secondary-button steam-button"
                    disabled={!canAct}
                    onClick={() => void undoAndContinue()}
                  >
                    再蒸一下<small>悔棋继续</small>
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!historyMoves.length}
                    onClick={() => {
                      navigate(0);
                      setSheet('record');
                    }}
                  >
                    复盘
                  </button>
                </div>
              </div>
            )}
          </section>
          <aside className="room-column">
            {!room ? (
              <section className="panel invite-panel">
                <div className="room-card-label">
                  <span
                    key={pillText}
                    className={`status-pill ${analysis ? 'analysis-pill' : ''}`}
                  >
                    {pillText}
                  </span>
                </div>
                <button
                  className="primary-button"
                  disabled={!ready || busy || !!roomId}
                  onClick={() => setModal('create')}
                >
                  <Users size={18} /> 创建好友对局 <ArrowRight size={18} />
                </button>
                <a className="secondary-button ai-entry" href="./ai/">
                  <Bot size={18} /> 人机对战与局势分析
                </a>
              </section>
            ) : (
              <section className="panel invite-panel">
                <div className="room-card-label">
                  <span
                    key={pillText}
                    className={`status-pill ${analysis ? 'analysis-pill' : ''}`}
                  >
                    {pillText}
                  </span>
                  <span className="room-code">
                    {room.id.slice(0, 6).toUpperCase()}
                  </span>
                </div>
                <div className="room-meta">
                  <span>
                    {room.you
                      ? `执${room.you === 'red' ? '红' : '黑'} · ${room.clockMinutes ? '每方 ' + room.clockMinutes + ' 分钟' : '不限时'}`
                      : '观战中'}
                  </span>
                  {participant && (
                    <button
                      disabled={!room.players.black || busy || !!room.offer}
                      onClick={() => setConfirm('rematch')}
                    >
                      <RefreshCw size={14} /> 重新开局
                    </button>
                  )}
                </div>
                <button className="primary-button" onClick={copyInvite}>
                  <Copy size={17} />
                  {room.players.black ? '复制棋室链接' : '复制邀请链接'}
                </button>
              </section>
            )}
            {room?.offer && (
              <section className="panel offer-panel">
                <Handshake size={24} />
                <h3>
                  {room.offer.side === room.you
                    ? '等待好友回应'
                    : `${sideLabel(room.offer.side)}${room.offer.kind === 'draw' ? '提议和棋' : '邀请重新开局'}`}
                </h3>
                {room.offer.kind === 'rematch' && (
                  <p>同意后交换先后手，开始新的一局。请先导出要保留的棋谱。</p>
                )}
                {room.you === room.offer.side ? (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void action('cancel-offer')}
                  >
                    撤回邀请
                  </button>
                ) : participant ? (
                  <div className="button-pair">
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => void action('respond', { accept: false })}
                    >
                      婉拒
                    </button>
                    <button
                      className="primary-button compact"
                      disabled={busy}
                      onClick={() => void action('respond', { accept: true })}
                    >
                      同意
                    </button>
                  </div>
                ) : null}
              </section>
            )}
            {scorePanel()}
          </aside>
        </div>
      )}
      {room && (
        <>
          <MobileDock
            chat={chat}
            setChat={setChat}
            participant={participant}
            busy={busy}
            analysis={!!analysis}
            canUndo={canAct && (!!historyMoves.length || !!room.result)}
            canDraw={canAct && !room.result && !room.offer}
            canResign={canAct && !room.result}
            viewportStyle={viewportStyle}
            onUndo={() => void undoAndContinue()}
            onDraw={() => void action('offer-draw')}
            onResign={() => setConfirm('resign')}
            onRecord={() => setSheet('record')}
            onAnalysis={analysis ? exitAnalysis : startAnalysis}
            onSend={sendChat}
            sound={sound}
            onFlip={() => {
              setFlipped(!flipped);
              setSelected(null);
            }}
            onToggleSound={toggleSound}
          />
          <GameSheet
            open={sheet === 'record'}
            onOpenChange={(open) => setSheet(open ? 'record' : null)}
            title="对局棋谱"
            description={`第 ${room.round} 局 · ${historyMoves.length} 步，点击棋谱可回看局面`}
          >
            {scorePanel()}
          </GameSheet>
        </>
      )}
      <Dialog
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
      >
        <DialogContent
          className="chess-dialog sm:max-w-[430px]"
          showCloseButton={false}
        >
          <button
            className="dialog-x"
            aria-label="关闭"
            onClick={() => setModal(null)}
          >
            <X size={19} />
          </button>
          <DialogTitle>
            {modal === 'create'
              ? '摆一桌，邀好友。'
              : modal === 'invite'
                ? '棋桌已备好，邀友入座。'
                : modal === 'name'
                  ? '如何称呼你？'
                  : '好友对局规则'}
          </DialogTitle>
          {(modal === 'invite' || modal === 'rules') && (
            <DialogDescription>
              {modal === 'invite'
                ? '把下面的链接发给好友。第一位访客自动执黑，之后的访客可以观战。'
                : '红方先行，双方轮流落子。'}
            </DialogDescription>
          )}
          {modal === 'create' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                rememberName();
                await action('create', { name, clockMinutes: Number(minutes) });
              }}
            >
              <label className="field-label" htmlFor="player-name">
                你的称呼
              </label>
              <input
                id="player-name"
                className="field-input"
                maxLength={16}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <label className="field-label" id="clock-label">
                对局用时
              </label>
              <Select
                value={minutes}
                onValueChange={(v) => setMinutes(v || '0')}
                items={timeOptions}
              >
                <SelectTrigger
                  className="clock-select"
                  aria-labelledby="clock-label"
                >
                  <Clock size={17} />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {timeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button className="primary-button" disabled={busy}>
                {busy ? '正在准备棋桌…' : '创建对局并邀请好友'}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {modal === 'invite' && (
            <>
              <input
                className="field-input invite-url"
                aria-label="邀请链接"
                value={inviteUrl}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button className="primary-button" onClick={copyInvite}>
                <Copy size={17} />
                复制邀请链接
              </button>
            </>
          )}
          {modal === 'name' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                rememberName();
                if (await action('name', { name })) setModal(null);
              }}
            >
              <input
                aria-label="你的称呼"
                className="field-input"
                value={name}
                maxLength={16}
                required
                onChange={(e) => setName(e.target.value)}
              />
              <button className="primary-button save-name" disabled={busy}>
                保存称呼
              </button>
            </form>
          )}
          {modal === 'rules' && (
            <div className="rules-content">
              <p>
                <strong>走棋与胜负</strong>
                <br />
                车走直线，马走日且不可蹩腿；象走田且不可塞眼、过河；士与将帅不出九宫；炮隔一子吃子；兵卒过河可横走、不可后退。将帅不能照面，也不能让己方被将军。将死、困毙、认输或计时耗尽均判负。
              </p>
              <p>
                <strong>无限自由悔棋</strong>
                <br />
                任意一方可直接撤回最近一步，不限次数、无需确认。棋子、吃子、轮次与该步开始时的用时一并恢复。结束后也能悔棋继续。
              </p>
              <p>
                <strong>推演与复盘</strong>
                <br />
                点击棋谱可以回看每一步，也可从任意局面独立推演。推演不会发送给对手；正式对局及计时照常进行。棋谱可导出保存。
              </p>
              <p>
                <strong>好友局循环规则</strong>
                <br />
                同一局面第三次出现时，单方持续将军者判负；否则判和。连续 60
                回合未吃子自动和棋。长捉等复杂竞赛争议采用好友协商提和，本平台不执行完整赛事裁判细则。
              </p>
              <p>
                <strong>提和、重开与连接</strong>
                <br />
                提和、重新开局需对方同意；重开会交换红黑方。离线不会立即判负，计时局仍继续计时。原浏览器刷新可回到座位；清除浏览器数据会失去座位身份。
              </p>
              <a
                href="https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf"
                target="_blank"
                rel="noreferrer"
                className="rules-source"
              >
                参考：世界象棋联合会规则 ↗
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent className="chess-dialog">
          <AlertDialogTitle>
            {confirm === 'resign' ? '确认认输？' : '邀请好友重新开局？'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm === 'resign'
              ? '本局将判对方获胜。之后仍可自由悔棋，或邀请再来一局。'
              : '好友同意后，会清空本局棋谱并交换先后手。想保留本局，请先导出棋谱。'}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>再想想</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                if (
                  await action(
                    confirm === 'resign' ? 'resign' : 'offer-rematch',
                  )
                )
                  setConfirm(null);
              }}
            >
              {confirm === 'resign' ? '确认认输' : '发出邀请'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
