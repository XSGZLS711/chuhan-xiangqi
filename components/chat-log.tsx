'use client';
import { useEffect, useRef } from 'react';
import { playerName, sideName } from '@/lib/i18n';
import { useLocale } from '@/lib/use-locale';
import type { Side } from '@/lib/xiangqi';
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
  const { locale, t } = useLocale();
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
              {t('chat.author', {
                name: playerName(locale, names?.[m.side]?.name ?? ''),
                side: sideName(locale, m.side),
              })}
            </small>
            <p>{m.text}</p>
          </div>
        ))
      ) : (
        <div className="chat-empty">
          {t('chat.empty')}
          <br />
          <small>{t('chat.empty.small')}</small>
        </div>
      )}
    </div>
  );
}
