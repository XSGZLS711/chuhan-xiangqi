'use client';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLocale } from '@/lib/use-locale';
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
  hideDescription = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Kept for screen readers only, where the title says enough on screen. */
  hideDescription?: boolean;
  children: ReactNode;
}) {
  const { t } = useLocale();
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
            <SheetDescription
              className={hideDescription ? 'sr-only' : undefined}
            >
              {description}
            </SheetDescription>
          </div>
          <SheetClose
            className="sheet-close-button"
            aria-label={t('sheet.close')}
          >
            <X size={21} />
          </SheetClose>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
