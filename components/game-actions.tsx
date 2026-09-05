'use client';
import { useState, type ReactNode } from 'react';
import {
  Undo2,
  GitBranch,
  Handshake,
  Flag,
  Menu,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';

type Props = {
  canUndo: boolean;
  canDraw: boolean;
  canResign: boolean;
  canRematch: boolean;
  onUndo: () => void;
  onAnalysis: () => void;
  onDraw: () => void;
  onResign: () => void;
  onRematch: () => void;
};
export default function GameActions(props: Props) {
  const [open, setOpen] = useState(false);
  function choose(action: () => void) {
    setOpen(false);
    action();
  }
  function actions(): ReactNode {
    return (
      <>
        <button
          className="board-action"
          disabled={!props.canUndo}
          onClick={props.onUndo}
        >
          <Undo2 size={20} />
          <span>
            悔棋<small>不限次数</small>
          </span>
        </button>
        <button
          className="board-action"
          onClick={() => choose(props.onAnalysis)}
        >
          <GitBranch size={20} />
          <span>
            推演<small>独立棋盘</small>
          </span>
        </button>
        <button
          className="board-action"
          disabled={!props.canDraw}
          onClick={() => choose(props.onDraw)}
        >
          <Handshake size={20} />
          <span>
            提和<small>对方同意</small>
          </span>
        </button>
        <button
          className="board-action"
          disabled={!props.canResign}
          onClick={() => choose(props.onResign)}
        >
          <Flag size={20} />
          <span>
            认输<small>结束本局</small>
          </span>
        </button>
      </>
    );
  }
  return (
    <>
      <div className="board-actions desktop-game-actions">{actions()}</div>
      <Collapsible
        className="mobile-game-actions"
        open={open}
        onOpenChange={setOpen}
      >
        <div className="mobile-action-toolbar">
          <CollapsibleTrigger className="actions-trigger">
            <Menu size={18} />
            <span>对局操作</span>
            <ChevronDown size={16} className={open ? 'expanded' : ''} />
          </CollapsibleTrigger>
          <span className="undo-promise">双方自由悔棋</span>
          <button
            className="rematch-shortcut"
            disabled={!props.canRematch}
            onClick={props.onRematch}
            aria-label="邀请重新开局"
          >
            <RefreshCw size={16} />
            <span>重开</span>
          </button>
        </div>
        <CollapsibleContent className="mobile-action-panel">
          <div className="board-actions">{actions()}</div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
