'use client';
import { useRef, useState, type CSSProperties, type SubmitEvent } from 'react';
import { flushSync } from 'react-dom';
import { LocaleMenuItems } from '@/components/language-switch';
import { useLocale } from '@/lib/use-locale';
import {
  Menu,
  ScrollText,
  GitBranch,
  Send,
  ArrowLeft,
  Undo2,
  Handshake,
  Flag,
  LogOut,
  RotateCw,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';

export default function MobileDock({
  chat,
  setChat,
  participant,
  busy,
  analysis,
  canUndo,
  canDraw,
  canResign,
  viewportStyle,
  onUndo,
  onDraw,
  onResign,
  onRecord,
  onAnalysis,
  onSend,
  sound,
  onFlip,
  onToggleSound,
}: {
  chat: string;
  setChat: (text: string) => void;
  participant: boolean;
  busy: boolean;
  analysis: boolean;
  canUndo: boolean;
  canDraw: boolean;
  canResign: boolean;
  viewportStyle?: CSSProperties;
  onUndo: () => void;
  onDraw: () => void;
  onResign: () => void;
  onRecord: () => void;
  onAnalysis: () => void;
  onSend: () => Promise<boolean>;
  sound: boolean;
  onFlip: () => void;
  onToggleSound: () => void;
}) {
  const { t } = useLocale();
  const [chatOpen, setChatOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatTriggerRef = useRef<HTMLButtonElement>(null);

  function openChat() {
    // Focus during the tap itself so iOS can open the software keyboard.
    flushSync(() => setChatOpen(true));
    inputRef.current?.focus({ preventScroll: true });
  }
  function changeChatOpen(open: boolean) {
    if (!open) inputRef.current?.blur();
    setChatOpen(open);
  }
  async function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (participant && !busy && chat.trim() && (await onSend())) {
      changeChatOpen(false);
    }
  }

  return (
    <>
      <nav className="mobile-dock" aria-label={t('dock.toolbar')}>
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
            <DropdownMenuItem disabled={!canDraw} onClick={onDraw}>
              <Handshake />
              <span>{t('play.draw')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canResign} onClick={onResign}>
              <Flag />
              <span>{t('play.resign')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onFlip}>
              <RotateCw />
              <span>{t('room.flip')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleSound}>
              {sound ? <Volume2 /> : <VolumeX />}
              <span>{t(sound ? 'room.sound.off' : 'room.sound.on')}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.location.assign('./')}>
              <LogOut />
              <span>{t('dock.leave')}</span>
            </DropdownMenuItem>
            <LocaleMenuItems />
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          className="dock-button"
          aria-label={t('dock.openMoves')}
          onClick={onRecord}
        >
          <ScrollText size={21} />
          <span>{t('dock.moves')}</span>
        </button>
        <button
          ref={chatTriggerRef}
          className="dock-chat"
          aria-label={t(participant ? 'dock.chat.open' : 'dock.chat.watching')}
          aria-haspopup="dialog"
          aria-expanded={chatOpen}
          disabled={!participant}
          onClick={openChat}
        >
          <span>
            {participant
              ? chat || t('dock.chat.placeholder')
              : t('room.status.watching')}
          </span>
        </button>
        <button
          className="dock-button dock-undo"
          aria-label={t('play.undo')}
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={21} />
          <span>{t('play.undo')}</span>
        </button>
        <button
          className={`dock-button dock-analysis ${analysis ? 'active' : ''}`}
          aria-label={t(
            analysis ? 'dock.exploring.exit' : 'dock.exploring.start',
          )}
          onClick={onAnalysis}
        >
          {analysis ? <ArrowLeft size={21} /> : <GitBranch size={21} />}
          <span>{t(analysis ? 'dock.back' : 'play.explore')}</span>
        </button>
      </nav>
      <Sheet open={chatOpen} onOpenChange={changeChatOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="game-sheet chat-sheet"
          style={viewportStyle}
          initialFocus={inputRef}
          finalFocus={chatTriggerRef}
        >
          <div className="sheet-grip" aria-hidden="true" />
          <div className="game-sheet-heading">
            <SheetTitle>{t('chat.title')}</SheetTitle>
            <SheetDescription className="sr-only">
              {t('dock.chat.description')}
            </SheetDescription>
            <SheetClose
              className="sheet-close-button"
              aria-label={t('dock.chat.close')}
            >
              <X size={21} />
            </SheetClose>
          </div>
          <form className="chat-composer" onSubmit={send}>
            <textarea
              ref={inputRef}
              aria-label={t('dock.chat.compose')}
              placeholder={t('dock.chat.placeholder')}
              value={chat}
              maxLength={120}
              rows={3}
              disabled={!participant}
              onChange={(event) => setChat(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  // Safari may end composition before the confirming Enter.
                  // oxlint-disable-next-line typescript/no-deprecated
                  event.keyCode !== 229
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              enterKeyHint="send"
            />
            <div className="chat-composer-actions">
              <span>{chat.length}/120</span>
              <button
                type="submit"
                disabled={!participant || busy || !chat.trim()}
              >
                <Send size={17} />
                {t('dock.send')}
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
