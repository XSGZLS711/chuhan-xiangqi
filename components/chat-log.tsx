'use client';
import { useEffect, useRef } from 'react';
import { sideLabel, type Side } from '@/lib/xiangqi';
import type { PublicRoom } from '@/lib/game';

/** Chat history that stays pinned to the newest message. */
export default function ChatLog({
  messages,
  you,
  names,
}: {
  messages: PublicRoom['chat'];
  you: Side | null;
  names?: PublicRoom['players'];
}) {
  const list = useRef<HTMLDivElement>(null);
  const seen = useRef(0);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    // The first paint jumps to the end; later messages glide in.
    el.scrollTo({
      top: el.scrollHeight,
      behavior:
        seen.current && messages.length > seen.current ? 'smooth' : 'auto',
    });
    seen.current = messages.length;
  }, [messages.length]);
  return (
    <div className="chat-list" ref={list}>
      {messages.length ? (
        messages.map((m) => (
          <div
            key={`${m.at}:${m.side}`}
            className={`chat-message ${m.side === you ? 'mine' : ''}`}
          >
            <small>
              {names?.[m.side]?.name} · {sideLabel(m.side)}
            </small>
            <p>{m.text}</p>
          </div>
        ))
      ) : (
        <div className="chat-empty">
          以棋会友，聊上两句。
          <br />
          <small>入座后即可发送消息</small>
        </div>
      )}
    </div>
  );
}
