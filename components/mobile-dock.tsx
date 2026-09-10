'use client';
import { useRef, useState, type CSSProperties, type SubmitEvent } from 'react';
import { flushSync } from 'react-dom';
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
}) {
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
      <nav className="mobile-dock" aria-label="对局工具栏">
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
            <DropdownMenuItem disabled={!canDraw} onClick={onDraw}>
              <Handshake />
              <span>提和</span>
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canResign} onClick={onResign}>
              <Flag />
              <span>认输</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.location.assign('./')}>
              <LogOut />
              <span>离开棋室</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          className="dock-button"
          aria-label="打开对局棋谱"
          onClick={onRecord}
        >
          <ScrollText size={21} />
          <span>棋谱</span>
        </button>
        <button
          ref={chatTriggerRef}
          className="dock-chat"
          aria-label={participant ? '打开聊天输入' : '观战中，无法聊天'}
          aria-haspopup="dialog"
          aria-expanded={chatOpen}
          disabled={!participant}
          onClick={openChat}
        >
          <span>{participant ? chat || '说句话…' : '观战中'}</span>
        </button>
        <button
          className="dock-button dock-undo"
          aria-label="悔棋"
          disabled={!canUndo}
          onClick={onUndo}
        >
          <Undo2 size={21} />
          <span>悔棋</span>
        </button>
        <button
          className={`dock-button dock-analysis ${analysis ? 'active' : ''}`}
          aria-label={analysis ? '退出推演，返回对局' : '开始独立推演'}
          onClick={onAnalysis}
        >
          {analysis ? <ArrowLeft size={21} /> : <GitBranch size={21} />}
          <span>{analysis ? '返回' : '推演'}</span>
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
            <SheetTitle>棋友聊天</SheetTitle>
            <SheetDescription className="sr-only">
              给对方发送消息，最多 120 字
            </SheetDescription>
            <SheetClose className="sheet-close-button" aria-label="关闭聊天">
              <X size={21} />
            </SheetClose>
          </div>
          <form className="chat-composer" onSubmit={send}>
            <textarea
              ref={inputRef}
              aria-label="发送聊天消息"
              placeholder="说句话…"
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
                发送
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
