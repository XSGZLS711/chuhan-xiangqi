'use client';
import './lobby.css';
import { useEffect, useRef, useState } from 'react';
import { apiError, invitationUrl, type ApiError } from '@/lib/client-api';
import {
  createRoom,
  openSession,
  startRoomSync,
  type RoomSync,
} from '@/lib/room-sync';
import { errorInfo, errorText, type ErrorInfo } from '@/lib/errors';
import { playerName, reasonText, sideName, type MessageKey } from '@/lib/i18n';
import { historyMoveText } from '@/lib/notation';
import { useLocale } from '@/lib/use-locale';
import LanguageSwitch from '@/components/language-switch';
import ChessBoard from '@/components/chess-board';
import CapturedTray from '@/components/captured-tray';
import GameActions from '@/components/game-actions';
import GameRecord from '@/components/game-record';
import ChatLog from '@/components/chat-log';
import GameSheet from '@/components/game-sheet';
import MobileDock from '@/components/mobile-dock';
import GameLobby from '@/components/game-lobby';
import { canPlayLive, rematchControl, recentChat } from '@/lib/mobile-game';
import { useGameViewport } from '@/lib/use-game-viewport';
import { useAutoArchive } from '@/lib/use-auto-archive';
import { archiveGame } from '@/lib/archive';
import { gameArchive } from '@/lib/archive-storage';
import AccountMenu from '@/components/account-menu';
import { useAccount } from '@/lib/use-account';
import EffectSettings from '@/components/effect-settings';
import { useEffectSettings } from '@/lib/use-effect-settings';
import { visibleEffect, type SettingKey } from '@/lib/effect-settings';
import { GameAudio, soundDelay, soundPan } from '@/lib/game-audio';
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
  Board,
} from '@/lib/xiangqi';
import { NAME } from '@/lib/tokens';
import { seated, type PublicRoom } from '@/lib/game';
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
  /** Squares of each move played on the branch. */
  moves: [number, number][];
  base: number;
};
/** What the banner says: a dictionary key or an error code, never a finished sentence, so
 * switching language rewrites it in place. `sticky` banners wait to be resolved instead
 * of fading; `connection` ones go away once the room answers again. */
type Notice = {
  text: { key: MessageKey } | { error: ErrorInfo };
  sticky?: boolean;
  connection?: boolean;
};
const note = (key: MessageKey, flags: Partial<Notice> = {}): Notice => ({
  text: { key },
  ...flags,
});
const STICKY = ['unavailable', 'join-failed', 'connection-lost'];
const CONNECTION = ['unavailable', 'connection-lost'];
/** A failure as a banner; the ones about the connection stay until it is back. */
function problem(error: unknown, fallback: Parameters<typeof errorInfo>[1]) {
  const info = errorInfo(error, fallback);
  return {
    text: { error: info },
    sticky: !!info.code && STICKY.includes(info.code),
    connection: !!info.code && CONNECTION.includes(info.code),
  } satisfies Notice;
}
const emptyBoard = initialBoard();
const timeValues = ['0', '10', '20', '30'];
export default function Home() {
  const { locale, t, tn, notation } = useLocale();
  const { settings, setSetting } = useEffectSettings();
  const account = useAccount();
  const sound = settings.sound;
  const [room, setRoom] = useState<PublicRoom | null>(null),
    [roomId, setRoomId] = useState(''),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [connection, setConnection] = useState<'online' | 'offline' | 'loading'>(
      'loading',
    );
  const [name, setName] = useState<string>(NAME.player),
    [minutes, setMinutes] = useState('0'),
    // The side the maker of a new room sits on, chosen in the create dialog.
    [createSide, setCreateSide] = useState<Side>('red'),
    [modal, setModal] = useState<'create' | 'rules' | 'invite' | 'name' | null>(
      null,
    ),
    [confirm, setConfirm] = useState<'resign' | 'rematch' | null>(null);
  const [message, setMessage] = useState<Notice | null>(null),
    [selected, setSelected] = useState<number | null>(null),
    [flipped, setFlipped] = useState(false),
    [tick, setTick] = useState(Date.now()),
    [review, setReview] = useState<number | null>(null),
    [analysis, setAnalysis] = useState<Analysis | null>(null),
    [chat, setChat] = useState(''),
    [boardEffect, setBoardEffect] = useState<BoardEffect | null>(null),
    [sheet, setSheet] = useState<'record' | null>(null);
  const archiveFailed = useAutoArchive(
    room,
    room ? `friend:${room.id}:${room.round}` : null,
    { kind: 'friend' },
    room?.you ?? null,
    !!account.user,
  );
  const viewportStyle = useGameViewport(!!room);
  const roomRef = useRef<PublicRoom | null>(null),
    nameRef = useRef(name),
    autoJoin = useRef(''),
    clockOffset = useRef(0),
    soundRef = useRef(sound),
    audioRef = useRef<GameAudio | null>(null),
    viewModeRef = useRef<'live' | 'review' | 'analysis'>('live'),
    flippedRef = useRef(flipped),
    locked = useRef(false),
    orientationRoom = useRef(''),
    syncRef = useRef<RoomSync | null>(null),
    alive = useRef(true);
  useEffect(() => {
    nameRef.current = name;
  }, [name]);
  useEffect(() => {
    soundRef.current = sound;
    if (!sound) audioRef.current?.silence();
  }, [sound]);
  useEffect(() => {
    flippedRef.current = flipped;
  }, [flipped]);
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
    if (!message || message.sticky) return;
    const timer = setTimeout(() => setMessage(null), 5200);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => () => audioRef.current?.close(), []);
  function unlockSound() {
    if (!soundRef.current) return;
    audioRef.current ??= new GameAudio();
    audioRef.current.unlock();
  }
  function playSound(kind: SoundKind, delay = 0, pan = 0) {
    if (soundRef.current) audioRef.current?.play(kind, delay, pan);
  }
  function update(r: PublicRoom) {
    if (!alive.current) return;
    const prev = roomRef.current;
    if (prev?.id === r.id && prev.version > r.version) return;
    clockOffset.current = r.serverNow - Date.now();
    if (prev?.id === r.id && prev.version !== r.version) {
      const feedback = updateFeedback(prev, r);
      const pan = soundPan(r.history.at(-1)?.to, flippedRef.current);
      feedback.sounds.forEach((kind, index) =>
        playSound(kind, soundDelay(feedback.sounds, index), pan),
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
    setMessage((m) => (m?.connection ? null : m));
    if (r.you && orientationRoom.current !== r.id) {
      setFlipped(r.you === 'black');
      orientationRoom.current = r.id;
    }
  }
  useEffect(() => {
    alive.current = true;
    setRoomId(new URLSearchParams(location.search).get('room') || '');
    try {
      setName(localStorage.getItem('chuhan-name') || NAME.player);
    } catch {}
    const initialize = async () => {
      try {
        await openSession();
        setReady(true);
        setConnection('online');
      } catch {
        setConnection('offline');
        setMessage(
          note('msg.reconnectHint', { sticky: true, connection: true }),
        );
      }
    };
    void initialize();
    const timer = setInterval(() => setTick(Date.now()), 500);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, []);
  // The room's own socket, or held polls where it cannot get through (`lib/room-sync.ts`).
  useEffect(() => {
    if (!roomId || !ready) return;
    const sync = startRoomSync(roomId, {
      onRoom(r) {
        update(r);
        if (
          !r.you &&
          !seated(r) &&
          autoJoin.current !== roomId &&
          new URLSearchParams(location.search).get('spectate') !== '1'
        ) {
          autoJoin.current = roomId;
          sync.send('join', { name: nameRef.current }).catch((e: ApiError) => {
            autoJoin.current = '';
            if (e.status !== 409) setMessage(problem(e, 'join-failed'));
          });
        }
      },
      onLost(e) {
        setConnection('offline');
        setMessage(problem(e, 'connection-lost'));
      },
    });
    syncRef.current = sync;
    return () => {
      sync.stop();
      syncRef.current = null;
    };
  }, [roomId, ready]);
  async function reconnect() {
    setConnection('loading');
    try {
      await openSession(undefined, 10000);
      setReady(true);
      if (roomId && syncRef.current) update(await syncRef.current.refresh());
      setConnection('online');
      setMessage(note('msg.restored', { sticky: true }));
    } catch {
      setConnection('offline');
      setMessage(note('msg.stillOffline', { sticky: true, connection: true }));
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
      const sync = syncRef.current;
      if (kind !== 'create' && !sync)
        throw apiError(null, 0, 'network-unstable');
      const data =
        kind === 'create'
          ? await createRoom(
              String(extra.name),
              Number(extra.clockMinutes),
              extra.side === 'black' ? 'black' : 'red',
            )
          : await sync!.send(kind, extra);
      update(data);
      setSelected(null);
      setMessage(null);
      if (kind === 'create') {
        setReady(true);
        setRoomId(data.id);
        history.replaceState(null, '', '?room=' + data.id);
        setModal('invite');
      }
      return true;
    } catch (e) {
      setMessage(problem(e, 'network-unstable'));
      return false;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  function rememberName() {
    try {
      localStorage.setItem('chuhan-name', name.trim() || NAME.player);
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
    canAct = participant && !!room && seated(room) && !busy;
  function square(n: number) {
    if (!analysis) {
      if (review !== null) return;
      if (!room) {
        setMessage(note('play.noRoom'));
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
          moves: [...analysis.moves, [selected, n]],
        });
        const feedback = branchFeedback(
          board,
          selected,
          n,
          turn,
          `analysis:${Date.now()}`,
        );
        setBoardEffect(feedback.effect);
        const pan = soundPan(n, flipped);
        feedback.sounds.forEach((kind, index) =>
          playSound(kind, soundDelay(feedback.sounds, index), pan),
        );
      } else void action('move', { from: selected, to: n });
      setSelected(null);
    } else if (board[n]?.side === turn) {
      if (n !== selected) playSound('select', 0, soundPan(n, flipped));
      setSelected(n === selected ? null : n);
      setMessage(null);
    } else if (selected !== null) setMessage(note('play.illegal'));
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
    const control = rematchControl(room, busy, locale);
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
  function startAnalysis() {
    setSheet(null);
    setBoardEffect(null);
    setAnalysis({
      boards: [board],
      turns: [turn],
      moves: [],
      base: reviewIndex,
    });
    setSelected(null);
    setMessage(null);
  }
  function exitAnalysis() {
    setBoardEffect(null);
    setAnalysis(null);
    setReview(null);
    setSelected(null);
    setMessage(null);
  }
  function navigate(n: number) {
    setBoardEffect(null);
    setReview(Math.max(0, Math.min(historyMoves.length, n)));
    setAnalysis(null);
    setSelected(null);
  }
  /** The full review (graph, report, drills) runs on the AI page, where the engine
   * can. Save first so it opens even if the automatic save has not landed yet. */
  async function openReview() {
    if (!room?.result) return;
    const id = `friend:${room.id}:${room.round}`;
    try {
      await gameArchive().save(
        archiveGame(room, {
          id,
          mode: { kind: 'friend' },
          viewerSide: room.you,
          date: new Date().toISOString(),
        }),
      );
      location.assign(`./ai/?game=${encodeURIComponent(id)}&back=room`);
    } catch {
      // Without local storage the full review cannot load; step through here.
      navigate(0);
      setSheet('record');
    }
  }
  const inviteUrl =
    typeof window !== 'undefined' && room
      ? invitationUrl(location.origin, location.pathname, room.id)
      : '';
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setMessage(note('msg.inviteCopied'));
    } catch {
      setModal('invite');
      setMessage(note('msg.copyManually'));
    }
  }
  function download() {
    if (!room) return;
    const lines = [
      t('export.title', { round: room.round }),
      t('export.players', {
        red: room.players.red
          ? playerName(locale, room.players.red.name)
          : t('export.waiting'),
        black: room.players.black
          ? playerName(locale, room.players.black.name)
          : t('export.waiting'),
      }),
      room.result
        ? t('export.result', {
            outcome:
              room.result.winner === 'draw'
                ? t('result.draw')
                : t('result.sideWon', {
                    side: sideName(locale, room.result.winner),
                  }),
            reason: reasonText(locale, room.result.reason),
          })
        : t('export.inProgress'),
      '',
      ...historyMoves.map((m, i) =>
        t('export.move', {
          n: i + 1,
          side: sideName(locale, m.side),
          text: historyMoveText(m, notation),
          check: m.check ? t('export.check') : '',
        }),
      ),
      '',
      t('export.coordinates'),
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
    a.download = t('export.filename', { round: room.round });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function clockMs(s: Side): number | null {
    if (!room?.clockMinutes) return null;
    let remaining = room.clocks[s];
    if (seated(room) && !room.result && room.turn === s)
      remaining -= Math.max(0, tick + clockOffset.current - room.turnAt);
    return Math.max(0, remaining);
  }
  function clockText(s: Side) {
    const remaining = clockMs(s);
    if (remaining === null) return t('room.clock.unlimited');
    const secs = Math.ceil(remaining / 1000);
    return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  }
  function scorePanel() {
    return (
      <section className="panel score-panel">
        <Tabs defaultValue="record">
          <div className="panel-heading">
            <TabsList variant="line">
              <TabsTrigger value="record">{t('record.tab')}</TabsTrigger>
              <TabsTrigger value="chat">
                {t('chat.tab', {
                  count: room?.chat.length ? `· ${room.chat.length}` : '',
                })}
              </TabsTrigger>
            </TabsList>
            <button
              className="icon-button"
              aria-label={t('record.export')}
              title={t('record.export')}
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
                {t('play.backToGame')}
              </button>
              <button
                className="primary-button compact"
                onClick={startAnalysis}
              >
                {t('play.exploreFromHere')}
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
                aria-label={t('chat.message')}
                placeholder={t(
                  participant
                    ? 'chat.placeholder'
                    : 'chat.placeholder.watching',
                )}
                value={chat}
                maxLength={120}
                disabled={!participant}
                onChange={(e) => setChat(e.target.value)}
              />
              <button
                aria-label={t('chat.send')}
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
        !!room &&
        seated(room) &&
        !room.result;
    return (
      <div className={`player-seat seat-${s}`}>
        <div
          className={`player-bar ${room && seated(room) && !room.result && room.turn === s ? 'active-player' : ''}`}
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
                  title={t('room.presence.title', {
                    state: t(
                      p.online
                        ? 'room.presence.online'
                        : 'room.presence.offline',
                    ),
                    side: sideName(locale, s),
                  })}
                />
              )}
              <span className="player-name">
                {p
                  ? playerName(locale, p.name)
                  : t(room || s === 'black' ? 'room.seatOpen' : 'room.you')}
              </span>
              {me && <em className="player-tag">{t('room.you')}</em>}
              {me && (
                <button
                  className="inline-link"
                  onClick={() => setModal('name')}
                >
                  {t('room.rename')}
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
  const pillText = t(
    analysis
      ? 'room.status.exploring'
      : review !== null
        ? 'room.pill.replay'
        : room?.result
          ? 'room.pill.over'
          : room && !room.you
            ? 'room.status.watching'
            : room && seated(room)
              ? check
                ? 'room.pill.check'
                : 'room.pill.toMove'
              : room
                ? 'room.status.waiting'
                : 'room.pill.connecting',
    { side: room ? sideName(locale, room.turn) : '' },
  );
  const timeOptions = timeValues.map((value) => ({
    value,
    label: t(value === '0' ? 'play.clock.unlimited' : 'play.clock.limit', {
      n: value,
    }),
  }));
  const rematchButton = room ? rematchControl(room, busy, locale) : null;
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
          <span>{t('brand.name')}</span>
        </a>
        <div className="header-tools">
          {!lobby && (
            <>
              <button
                className="text-button icon-tool"
                aria-label={t('room.flip')}
                title={t('room.flip')}
                onClick={() => {
                  setFlipped(!flipped);
                  setSelected(null);
                }}
              >
                <RotateCw size={17} />
              </button>
              <button
                className="text-button icon-tool"
                aria-label={t(
                  sound ? 'room.sound.off.label' : 'room.sound.on.label',
                )}
                title={t(sound ? 'room.sound.off' : 'room.sound.on')}
                onClick={toggleSound}
              >
                {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
            </>
          )}
          <button
            title={t(
              connection === 'online'
                ? 'room.connected'
                : 'room.reconnect.hint',
            )}
            aria-label={t('room.reconnect.label')}
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
            className="text-button rules-button"
            aria-label={t('room.rules')}
            title={t('room.rules')}
            onClick={() => setModal('rules')}
          >
            <BookOpen size={17} />{' '}
            <span className="tool-label">{t('room.rules')}</span>
          </button>
          {lobby && <LanguageSwitch />}
          <AccountMenu account={account} />
        </div>
      </header>
      {room && (
        <div className="mobile-room-nav">
          <span className="mobile-room-title">
            <strong>{t('room.friendGame')}</strong>{' '}
            <small>{t('room.round', { n: room.round })}</small>
          </span>
          <span className={`mobile-room-status ${check ? 'check-status' : ''}`}>
            {t(
              analysis
                ? 'room.status.exploring'
                : review !== null
                  ? 'room.status.replaying'
                  : room.result
                    ? 'room.status.over'
                    : !seated(room)
                      ? 'room.status.waiting'
                      : !room.you
                        ? 'room.status.watching'
                        : check
                          ? room.you === room.turn
                            ? 'room.status.checkYou'
                            : 'room.status.checkThem'
                          : room.you === room.turn
                            ? 'room.status.yourTurn'
                            : 'room.status.theirTurn',
            )}
          </span>
          <button
            className={`mobile-connect connection-${connection}`}
            aria-label={t('room.reconnect.label')}
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
            <span>{t('room.invite')}</span>
          </button>
        </div>
      )}
      {room?.offer && (
        <div className="mobile-offer-bar" role="status">
          <span>
            {t(
              room.offer.side === room.you
                ? 'room.waitingReply'
                : room.offer.kind === 'draw'
                  ? 'room.offer.draw'
                  : 'room.offer.rematch',
            )}
          </span>
          {room.offer.side === room.you ? (
            <button disabled={busy} onClick={() => void action('cancel-offer')}>
              {t('room.offer.withdraw')}
            </button>
          ) : participant ? (
            <>
              <button
                disabled={busy}
                onClick={() => void action('respond', { accept: false })}
              >
                {t('room.offer.decline')}
              </button>
              <button
                className="accept-offer"
                disabled={busy}
                onClick={() => void action('respond', { accept: true })}
              >
                {t(
                  room.offer.kind === 'rematch'
                    ? 'room.offer.acceptRematch'
                    : 'room.offer.accept',
                )}
              </button>
            </>
          ) : null}
        </div>
      )}
      {archiveFailed && (
        <p className="notice" role="alert">
          {t('archive.saveFailed')}
        </p>
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
      {message && (
        <div className="notice" role="status">
          <span>
            {'key' in message.text
              ? t(message.text.key)
              : errorText(locale, message.text.error)}
          </span>
          <button
            aria-label={t('notice.dismiss')}
            onClick={() => setMessage(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {lobby ? (
        <GameLobby
          signedIn={!!account.user}
          friendDisabled={busy}
          onCreate={() => setModal('create')}
          onExplore={startAnalysis}
        />
      ) : (
        <div className="workspace">
          <section className="play-column">
            {roomId && !room && (
              <div className="room-loading" role="status">
                {t(
                  connection === 'offline'
                    ? 'room.loading.offline'
                    : 'room.loading',
                )}
              </div>
            )}
            {player(flipped ? 'red' : 'black')}
            <div className="board-stage">
              <EffectSettings settings={settings} onChange={changeSetting} />
              <ChessBoard
                board={board}
                selected={selected}
                targets={settings.hints ? targets : []}
                last={last}
                onSquare={square}
                flipped={flipped}
                checkSide={check}
                effect={visibleEffect(boardEffect, settings)}
                captureEffects={settings.moveEffects}
                animationContext={`${room?.id ?? 'local'}:${room?.round ?? 0}:${analysis ? 'analysis' : review !== null ? 'review' : 'live'}`}
                animate={!!analysis || review === null}
              />
            </div>
            {player(flipped ? 'black' : 'red')}
            {analysis ? (
              <div className="analysis-controls">
                <span>
                  <GitBranch size={17} />{' '}
                  {tn('play.exploring', analysis.moves.length)}
                </span>
                <button
                  disabled={analysis.boards.length < 2}
                  onClick={() => {
                    setBoardEffect(null);
                    setAnalysis({
                      ...analysis,
                      boards: analysis.boards.slice(0, -1),
                      turns: analysis.turns.slice(0, -1),
                      moves: analysis.moves.slice(0, -1),
                    });
                    setSelected(null);
                  }}
                >
                  <Undo2 size={17} />
                  {t('play.backOne')}
                </button>
                <button
                  onClick={() => {
                    setBoardEffect(null);
                    setAnalysis({
                      ...analysis,
                      boards: [analysis.boards[0]],
                      turns: [analysis.turns[0]],
                      moves: [],
                    });
                    setSelected(null);
                  }}
                >
                  {t('play.reset')}
                </button>
                <button onClick={exitAnalysis}>
                  <ArrowLeft size={17} />
                  {t('play.backToGame')}
                </button>
              </div>
            ) : review !== null ? (
              <div className="analysis-controls">
                <span>{t('play.replay', { n: reviewIndex })}</span>
                <button
                  className="review-step"
                  aria-label={t('play.replay.prev')}
                  disabled={!reviewIndex}
                  onClick={() => navigate(reviewIndex - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  className="review-step"
                  aria-label={t('play.replay.next')}
                  disabled={reviewIndex >= historyMoves.length}
                  onClick={() => navigate(reviewIndex + 1)}
                >
                  <ChevronRight size={17} />
                </button>
                <button onClick={startAnalysis}>
                  <GitBranch size={17} />
                  {t('play.exploreFromHere')}
                </button>
                <button
                  onClick={() => {
                    setReview(null);
                    setSelected(null);
                  }}
                >
                  {t('play.backToGame')}
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
                      ? t('result.draw')
                      : t('result.sideWins', {
                          side: sideName(locale, room.result.winner),
                        })}
                  </strong>
                  <span>{reasonText(locale, room.result.reason)}</span>
                </div>
                <div className="endgame-buttons">
                  <button
                    className="primary-button"
                    disabled={rematchButton?.disabled}
                    onClick={rematch}
                  >
                    {rematchButton?.label ?? t('room.rematch.again')}
                  </button>
                  <button
                    className="secondary-button steam-button"
                    disabled={!canAct}
                    onClick={() => void undoAndContinue()}
                  >
                    {t('play.steam')}
                    {t('play.steam.hint') && (
                      <small>{t('play.steam.hint')}</small>
                    )}
                  </button>
                  <button
                    className="secondary-button"
                    disabled={!historyMoves.length}
                    onClick={() => void openReview()}
                  >
                    {t('play.review')}
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
                  <Users size={18} /> {t('room.createGame')}{' '}
                  <ArrowRight size={18} />
                </button>
                <a className="secondary-button ai-entry" href="./ai/">
                  <Bot size={18} /> {t('room.aiEntry')}
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
                      ? t('room.youPlay.meta', {
                          side: t(
                            room.you === 'red'
                              ? 'side.red.short'
                              : 'side.black.short',
                          ),
                          time: room.clockMinutes
                            ? t('play.clock.limit', { n: room.clockMinutes })
                            : t('room.clock.unlimited'),
                        })
                      : t('room.status.watching')}
                  </span>
                  {participant && (
                    <button
                      disabled={!seated(room) || busy || !!room.offer}
                      onClick={() => setConfirm('rematch')}
                    >
                      <RefreshCw size={14} /> {t('room.rematch')}
                    </button>
                  )}
                </div>
                <button className="primary-button" onClick={copyInvite}>
                  <Copy size={17} />
                  {t(seated(room) ? 'room.copyRoomLink' : 'room.copyInvite')}
                </button>
              </section>
            )}
            {room?.offer && (
              <section className="panel offer-panel">
                <Handshake size={24} />
                <h3>
                  {room.offer.side === room.you
                    ? t('room.waitingReply')
                    : t(
                        room.offer.kind === 'draw'
                          ? 'room.offer.panel.draw'
                          : 'room.offer.panel.rematch',
                        { side: sideName(locale, room.offer.side) },
                      )}
                </h3>
                {room.offer.kind === 'rematch' && (
                  <p>{t('room.offer.rematchNote')}</p>
                )}
                {room.you === room.offer.side ? (
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => void action('cancel-offer')}
                  >
                    {t('room.offer.withdrawInvite')}
                  </button>
                ) : participant ? (
                  <div className="button-pair">
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => void action('respond', { accept: false })}
                    >
                      {t('room.offer.decline')}
                    </button>
                    <button
                      className="primary-button compact"
                      disabled={busy}
                      onClick={() => void action('respond', { accept: true })}
                    >
                      {t('room.offer.accept')}
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
            settings={settings}
            onSetting={changeSetting}
            onFlip={() => {
              setFlipped(!flipped);
              setSelected(null);
            }}
            onToggleSound={toggleSound}
          />
          <GameSheet
            open={sheet === 'record'}
            onOpenChange={(open) => setSheet(open ? 'record' : null)}
            title={t('record.title')}
            description={tn('record.description', historyMoves.length, {
              round: room.round,
            })}
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
            aria-label={t('dialog.close')}
            onClick={() => setModal(null)}
          >
            <X size={19} />
          </button>
          <DialogTitle>
            {t(
              modal === 'create'
                ? 'dialog.create.title'
                : modal === 'invite'
                  ? 'dialog.invite.title'
                  : modal === 'name'
                    ? 'dialog.name.title'
                    : 'dialog.rules.title',
            )}
          </DialogTitle>
          {(modal === 'invite' || modal === 'rules') && (
            <DialogDescription>
              {t(
                modal === 'invite'
                  ? 'dialog.invite.description'
                  : 'dialog.rules.description',
              )}
            </DialogDescription>
          )}
          {modal === 'create' && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                rememberName();
                await action('create', {
                  name,
                  clockMinutes: Number(minutes),
                  side: createSide,
                });
              }}
            >
              <label className="field-label" htmlFor="player-name">
                {t('dialog.yourName')}
              </label>
              <input
                id="player-name"
                className="field-input"
                maxLength={16}
                value={playerName(locale, name)}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <fieldset className="side-choice">
                <legend className="field-label">{t('ai.setup.side')}</legend>
                <div>
                  {(['red', 'black'] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      aria-pressed={createSide === side}
                      className={createSide === side ? 'selected' : ''}
                      onClick={() => setCreateSide(side)}
                    >
                      {t(side === 'red' ? 'ai.setup.red' : 'ai.setup.black')}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="field-label" id="clock-label">
                {t('dialog.clock')}
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
                {t(busy ? 'dialog.preparing' : 'dialog.create')}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {modal === 'invite' && (
            <>
              <input
                className="field-input invite-url"
                aria-label={t('dialog.inviteLink')}
                value={inviteUrl}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button className="primary-button" onClick={copyInvite}>
                <Copy size={17} />
                {t('room.copyInvite')}
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
                aria-label={t('dialog.yourName')}
                className="field-input"
                value={playerName(locale, name)}
                maxLength={16}
                required
                onChange={(e) => setName(e.target.value)}
              />
              <button className="primary-button save-name" disabled={busy}>
                {t('dialog.saveName')}
              </button>
            </form>
          )}
          {modal === 'rules' && (
            <div className="rules-content">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <p key={n}>
                  <strong>{t(`rules.${n}.title`)}</strong>
                  <br />
                  {t(`rules.${n}.body`)}
                </p>
              ))}
              <a
                href="https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf"
                target="_blank"
                rel="noreferrer"
                className="rules-source"
              >
                {t('rules.source')}
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
            {t(
              confirm === 'resign'
                ? 'dialog.resign.title'
                : 'dialog.rematch.title',
            )}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              confirm === 'resign'
                ? 'dialog.resign.body'
                : 'dialog.rematch.body',
            )}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('dialog.think')}</AlertDialogCancel>
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
              {t(
                confirm === 'resign'
                  ? 'dialog.resign.confirm'
                  : 'dialog.rematch.confirm',
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
