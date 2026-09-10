'use client';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
export default function GameSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="game-sheet record-sheet"
      >
        <div className="sheet-grip" aria-hidden="true" />
        <div className="game-sheet-heading">
          <div>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </div>
          <SheetClose className="sheet-close-button" aria-label="关闭窗口">
            <X size={21} />
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
