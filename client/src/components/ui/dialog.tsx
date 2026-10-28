import type { ReactNode } from 'react';
import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

interface DialogContentProps {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** "side" renders a drawer from the right (full height). */
  variant?: 'center' | 'side';
}

export function DialogContent({ title, description, children, footer, className, variant = 'center' }: DialogContentProps) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[1000] bg-slate-950/40 animate-fade-in" />
      <D.Content
        className={cn(
          'fixed z-[1001] flex flex-col bg-surface shadow-2xl focus:outline-none',
          variant === 'center'
            ? 'left-1/2 top-1/2 max-h-[min(90vh,820px)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-card animate-slide-up'
            : 'inset-y-0 right-0 w-full max-w-xl animate-fade-in',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <D.Title className="text-base font-semibold text-ink">{title}</D.Title>
            {description ? (
              <D.Description className="mt-0.5 text-sm text-ink-muted">{description}</D.Description>
            ) : (
              <D.Description className="sr-only">{typeof title === 'string' ? title : 'Dialog'}</D.Description>
            )}
          </div>
          <D.Close
            className="-mr-1 rounded-md p-1.5 text-ink-subtle hover:bg-slate-100 hover:text-ink"
            aria-label="Close"
          >
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}
