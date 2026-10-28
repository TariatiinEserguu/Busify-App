import { AlertDialog as A } from 'radix-ui';
import { BellRing, Check } from 'lucide-react';
import { formatDistance } from '@busify/shared';
import { Button } from '@/components/ui/button';

interface AlertOverlayProps {
  open: boolean;
  destinationName: string;
  distanceM: number | null;
  busy: boolean;
  onDismiss: () => void;
  onArrived: () => void;
}

/** The full-screen "Your bus stop is approaching!" alert. */
export function AlertOverlay({ open, destinationName, distanceM, busy, onDismiss, onArrived }: AlertOverlayProps) {
  return (
    <A.Root open={open} onOpenChange={(o) => !o && onDismiss()}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[2000] bg-brand-950/70 backdrop-blur-[2px] animate-fade-in" />
        <A.Content
          className="fixed inset-x-4 top-1/2 z-[2001] mx-auto max-w-md -translate-y-1/2 overflow-hidden rounded-2xl bg-surface text-center shadow-2xl animate-slide-up focus:outline-none"
          onEscapeKeyDown={onDismiss}
        >
          <div className="bg-amber-400 px-6 pb-8 pt-9">
            <div className="relative mx-auto flex size-20 items-center justify-center">
              <span className="absolute inset-0 rounded-full bg-white/60 animate-alert-ring" aria-hidden />
              <span className="relative flex size-20 items-center justify-center rounded-full bg-white text-amber-600 shadow-lg">
                <BellRing className="size-10" aria-hidden />
              </span>
            </div>
          </div>
          <div className="px-6 pb-6 pt-5">
            <A.Title className="text-2xl font-bold tracking-tight text-ink">Your bus stop is approaching!</A.Title>
            <A.Description className="mt-2 text-base text-ink-muted">
              <span className="font-semibold text-ink">{destinationName}</span>
              {distanceM != null && <> is about {formatDistance(distanceM)} away.</>} Get ready to get off.
            </A.Description>
            <div className="mt-6 grid gap-2">
              <Button size="lg" onClick={onArrived} loading={busy} autoFocus>
                <Check aria-hidden />
                I&apos;m getting off — end journey
              </Button>
              <A.Cancel asChild>
                <Button size="lg" variant="outline" onClick={onDismiss}>
                  Dismiss and keep tracking
                </Button>
              </A.Cancel>
            </div>
            <p className="mt-4 text-xs text-ink-subtle">This alert sounds once per journey. You can re-arm it from the journey panel.</p>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
