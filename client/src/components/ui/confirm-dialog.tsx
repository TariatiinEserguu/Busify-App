import { useState, type ReactNode } from 'react';
import { AlertDialog as A } from 'radix-ui';
import { Button } from './button';

interface ConfirmDialogProps {
  trigger: ReactNode;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
}

/** Confirmation step for destructive or irreversible actions. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
}: ConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <A.Root open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <A.Trigger asChild>{trigger}</A.Trigger>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[1000] bg-slate-950/40 animate-fade-in" />
        <A.Content className="fixed left-1/2 top-1/2 z-[1001] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card bg-surface p-5 shadow-2xl animate-slide-up focus:outline-none">
          <A.Title className="text-base font-semibold text-ink">{title}</A.Title>
          <A.Description className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</A.Description>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="outline" disabled={busy}>
                {cancelLabel}
              </Button>
            </A.Cancel>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              loading={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  setOpen(false);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
