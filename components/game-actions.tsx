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
import { useLocale } from '@/lib/use-locale';
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
  const { t } = useLocale();
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
          <span>{t('play.undo')}</span>
        </button>
        <button
          className="board-action"
          onClick={() => choose(props.onAnalysis)}
        >
          <GitBranch size={20} />
          <span>{t('play.explore')}</span>
        </button>
        <button
          className="board-action"
          disabled={!props.canDraw}
          onClick={() => choose(props.onDraw)}
        >
          <Handshake size={20} />
          <span>{t('play.draw')}</span>
        </button>
        <button
          className="board-action"
          disabled={!props.canResign}
          onClick={() => choose(props.onResign)}
        >
          <Flag size={20} />
          <span>{t('play.resign')}</span>
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
            <span>{t('play.actions')}</span>
            <ChevronDown size={16} className={open ? 'expanded' : ''} />
          </CollapsibleTrigger>
          <span className="actions-spacer" />
          <button
            className="rematch-shortcut"
            disabled={!props.canRematch}
            onClick={props.onRematch}
            aria-label={t('play.rematchInvite')}
          >
            <RefreshCw size={16} />
            <span>{t('play.rematchShort')}</span>
          </button>
        </div>
        <CollapsibleContent className="mobile-action-panel">
          <div className="board-actions">{actions()}</div>
        </CollapsibleContent>
      </Collapsible>
    </>
  );
}
