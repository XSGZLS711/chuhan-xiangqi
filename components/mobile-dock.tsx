'use client';
import type { SubmitEvent } from 'react';
import { Menu, ScrollText, GitBranch, Send, ArrowLeft } from 'lucide-react';
export default function MobileDock({
  chat,
  setChat,
  participant,
  busy,
  analysis,
  onMenu,
  onRecord,
  onAnalysis,
  onSend,
}: {
  chat: string;
  setChat: (text: string) => void;
  participant: boolean;
  busy: boolean;
  analysis: boolean;
  onMenu: () => void;
  onRecord: () => void;
  onAnalysis: () => void;
  onSend: () => Promise<boolean>;
}) {
  async function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input');
    if (await onSend()) input?.blur();
  }
  return (
    <nav className="mobile-dock" aria-label="对局工具栏">
      <button
        className="dock-button dock-menu"
        aria-label="打开全部操作"
        onClick={onMenu}
      >
        <Menu size={23} />
      </button>
      <button
        className="dock-button"
        aria-label="打开对局棋谱"
        onClick={onRecord}
      >
        <ScrollText size={21} />
        <span>棋谱</span>
      </button>
      <form className="dock-chat" onSubmit={send}>
        <input
          aria-label="发送聊天消息"
          placeholder={participant ? '说句话…' : '观战中'}
          value={chat}
          maxLength={120}
          disabled={!participant}
          onChange={(event) => setChat(event.target.value)}
          enterKeyHint="send"
          autoComplete="off"
        />
        {chat.trim() && (
          <button
            type="submit"
            aria-label="发送"
            disabled={!participant || busy}
          >
            <Send size={18} />
          </button>
        )}
      </form>
      <button
        className={`dock-button dock-analysis ${analysis ? 'active' : ''}`}
        aria-label={analysis ? '退出推演，返回对局' : '开始独立推演'}
        onClick={onAnalysis}
      >
        {analysis ? <ArrowLeft size={21} /> : <GitBranch size={21} />}
        <span>{analysis ? '返回' : '推演'}</span>
      </button>
    </nav>
  );
}
