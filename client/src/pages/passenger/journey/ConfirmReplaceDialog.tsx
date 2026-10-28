import { AlertDialog as A } from 'radix-ui';
import { Button } from '@/components/ui/button';

/** Shown when another device or tab already has a journey running (one journey per passenger). */
export function ConfirmReplaceDialog({ message, onCancel, onConfirm }: { message: string | null; onCancel: () => void; onConfirm: () => void }) {
  return (
    <A.Root open={!!message} onOpenChange={(o) => !o && onCancel()}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[1000] bg-slate-950/40 animate-fade-in" />
        <A.Content className="fixed left-1/2 top-1/2 z-[1001] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-card bg-surface p-5 shadow-2xl animate-slide-up">
          <A.Title className="text-base font-semibold">You already have a journey running</A.Title>
          <A.Description className="mt-2 text-sm text-ink-muted">
            {message} BUSIFY tracks one journey at a time. Replace it with this one?
          </A.Description>
          <div className="mt-5 flex justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="outline">Keep the current one</Button>
            </A.Cancel>
            <A.Action asChild>
              <Button onClick={onConfirm}>Replace journey</Button>
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
