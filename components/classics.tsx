'use client';
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { RotateCcw, X } from 'lucide-react';
import ChessBoard from '@/components/chess-board';
import { CLASSICS } from '@/lib/classics';
import { feedbackSounds } from '@/lib/game-audio';
import { t as translate, type MessageKey } from '@/lib/i18n';
import type { MoveStyle } from '@/lib/motion';
import { MATE_PATTERNS, type PatternId } from '@/lib/patterns';
import {
  branchFeedback,
  effectDuration,
  type BoardEffect,
  type SoundKind,
} from '@/lib/presentation';
import { useLocale } from '@/lib/use-locale';
import { inCheck, moveBoard, opposite } from '@/lib/xiangqi';

type Play = (
  kind: SoundKind,
  delay?: number,
  pan?: number,
  style?: MoveStyle,
) => void;
const isMate = (id: PatternId) =>
  (MATE_PATTERNS as readonly string[]).includes(id);
/** Time before the first move: an opening waits for the set to be dealt. */
const LEAD_MS = { opening: 1300, mate: 900 };
const STEP_MS = 1500;

/** The classic moves, played out on a real board: every opening and mate the board knows
 * by name, each a short game that ends on the move that completes it. Uses the game's own
 * board, effects and sounds, so what is shown here is what a game will show.
 */
export default function Classics({
  onClose,
  playSound,
}: {
  onClose: () => void;
  playSound: Play;
}) {
  const { t, locale } = useLocale();
  const [group, setGroup] = useState<'opening' | 'mate'>('opening');
  const [id, setId] = useState<PatternId>('central-cannon');
  const [run, setRun] = useState(0);
  const [step, setStep] = useState(0);
  const [effect, setEffect] = useState<BoardEffect | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    close = useRef<HTMLButtonElement>(null);
  const classic = CLASSICS.find((c) => c.id === id)!;
  const boards = useMemo(() => {
    const out = [classic.board];
    for (const [from, to] of classic.moves)
      out.push(moveBoard(out[out.length - 1], from, to));
    return out;
  }, [classic]);
  const turnAt = (n: number) => (n % 2 ? opposite(classic.turn) : classic.turn);
  const board = boards[step],
    turn = turnAt(step),
    last = step ? classic.moves[step - 1] : null;
  const choose = (next: PatternId) => {
    setId(next);
    setStep(0);
    setEffect(null);
    setRun((n) => n + 1);
  };
  // Play the moves one by one, with the sounds and stamps a game would make.
  const playNext = useEffectEvent(() => {
    const [from, to] = classic.moves[step];
    const before = boards[step];
    const feedback = branchFeedback(
      before,
      from,
      to,
      turnAt(step),
      `classic:${id}:${run}:${step}`,
    );
    setEffect(feedback.effect);
    feedbackSounds(feedback.sounds, { before, from, to }).forEach((sound) =>
      playSound(...sound),
    );
    setStep(step + 1);
  });
  const done = step >= classic.moves.length;
  useEffect(() => {
    if (done) return;
    const timer = setTimeout(
      playNext,
      step ? STEP_MS : LEAD_MS[isMate(id) ? 'mate' : 'opening'],
    );
    return () => clearTimeout(timer);
  }, [id, run, step, done]);
  useEffect(() => {
    if (!effect) return;
    const timer = setTimeout(
      () => setEffect(null),
      effectDuration(effect.kind),
    );
    return () => clearTimeout(timer);
  }, [effect]);
  // A modal in the top layer: the browser traps focus, and Escape closes it.
  useEffect(() => {
    const node = dialog.current;
    if (node && !node.open) node.showModal();
    close.current?.focus();
  }, []);
  const list = CLASSICS.filter((c) => isMate(c.id) === (group === 'mate'));
  const name = (pattern: PatternId) => `pattern.${pattern}` as MessageKey;
  return (
    <dialog
      ref={dialog}
      className="classics"
      aria-labelledby="classics-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="classics-panel">
        <header className="classics-head">
          <h2 id="classics-title">{t('classics.title')}</h2>
          <div className="classics-tabs" role="tablist">
            {(['opening', 'mate'] as const).map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={group === g}
                className={group === g ? 'active' : ''}
                onClick={() => {
                  setGroup(g);
                  choose(
                    CLASSICS.find((c) => isMate(c.id) === (g === 'mate'))!.id,
                  );
                }}
              >
                {t(g === 'mate' ? 'classics.mates' : 'classics.openings')}
              </button>
            ))}
          </div>
          <button
            ref={close}
            className="classics-close"
            onClick={onClose}
            aria-label={t('dialog.close')}
          >
            <X size={20} />
          </button>
        </header>
        <div className="classics-stage">
          <div className="classics-board" inert>
            <ChessBoard
              board={board}
              last={last ? { from: last[0], to: last[1] } : null}
              onSquare={() => {}}
              checkSide={inCheck(board, turn) ? turn : null}
              effect={effect}
              animationContext={`classic:${id}:${run}`}
              onDeal={() => playSound('deal')}
              onPattern={(hit, delay) =>
                playSound(
                  hit.kind === 'mate' ? 'pattern-mate' : 'pattern',
                  delay / 1000,
                )
              }
            />
          </div>
          <div className="classics-side">
            <div className="classics-now" key={`${id}:${run}`}>
              <strong className="classics-brush">
                {translate('zh', name(id))}
              </strong>
              {locale !== 'zh' && (
                <span className="classics-name">{t(name(id))}</span>
              )}
              <p>{t(`${name(id)}.gloss` as MessageKey)}</p>
              <button
                className="classics-replay"
                onClick={() => choose(id)}
                disabled={!done}
              >
                <RotateCcw size={16} /> {t('classics.replay')}
              </button>
            </div>
            <ul className="classics-list" aria-label={t('classics.board')}>
              {list.map((c, i) => (
                <li key={c.id} style={{ '--i': i } as CSSProperties}>
                  <button
                    className={c.id === id ? 'active' : ''}
                    aria-current={c.id === id}
                    onClick={() => choose(c.id)}
                  >
                    <b>{translate('zh', name(c.id))}</b>
                    {locale !== 'zh' && <span>{t(name(c.id))}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </dialog>
  );
}
