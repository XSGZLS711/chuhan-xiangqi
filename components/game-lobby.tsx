'use client';
/* oxlint-disable next/no-html-link-for-pages -- The AI entry is a separate document with its own browser isolation. */
import { ArrowRight, Bot, GitBranch, Users } from 'lucide-react';

export default function GameLobby({
  friendDisabled,
  onCreate,
  onExplore,
}: {
  friendDisabled: boolean;
  onCreate: () => void;
  onExplore: () => void;
}) {
  return (
    <section className="game-lobby" aria-labelledby="lobby-title">
      <div className="lobby-welcome">
        <div className="lobby-art" aria-hidden="true">
          <div className="lobby-grid" />
          <span className="lobby-river">楚 河 · 汉 界</span>
          <span className="lobby-piece lobby-piece-back">馬</span>
          <span className="lobby-piece lobby-piece-black">将</span>
          <span className="lobby-piece lobby-piece-red">帅</span>
        </div>
        <div className="lobby-intro">
          <p className="lobby-eyebrow">方寸棋盘，从容相见</p>
          <h1 id="lobby-title">今天，和谁下盘棋？</h1>
          <p>邀好友过招，或与 AI 切磋。</p>
        </div>
      </div>
      <div className="lobby-choices">
        <button
          className="lobby-mode lobby-mode-friend"
          disabled={friendDisabled}
          onClick={onCreate}
        >
          <span className="lobby-mode-icon">
            <Users size={25} />
          </span>
          <span className="lobby-mode-copy">
            <strong>好友对弈</strong>
            <span>创建棋室，分享链接邀请好友</span>
          </span>
          <ArrowRight size={21} />
        </button>
        <a className="lobby-mode lobby-mode-ai" href="./ai/">
          <span className="lobby-mode-icon">
            <Bot size={25} />
          </span>
          <span className="lobby-mode-copy">
            <strong>人机对弈</strong>
            <span>三档难度，随时查看局势分析</span>
          </span>
          <ArrowRight size={21} />
        </a>
        <button className="lobby-explore" onClick={onExplore}>
          <GitBranch size={16} /> 先随手推演
        </button>
      </div>
      <p className="lobby-footnote">
        无需注册 <span>·</span> 自由悔棋 <span>·</span> 从容落子
      </p>
    </section>
  );
}
