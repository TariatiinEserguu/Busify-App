import { AlertDialog as A } from 'radix-ui';
import { useNavigate } from 'react-router';
import { Bell, Smartphone, Volume2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface AlertOverlayProps {
  open: boolean;
  destinationName: string;
  distanceM: number | null;
  busy: boolean;
  sound: boolean;
  vibration: boolean;
  journeyId: number;
  onDismiss: () => void;
  onSnooze: () => void;
  onArrived: () => void;
}

/** The full-screen amber "Your stop is approaching!" alert from the deck. */
export function AlertOverlay({ open, destinationName, distanceM, busy, sound, vibration, journeyId, onDismiss, onSnooze, onArrived }: AlertOverlayProps) {
  const { t, formatDistance } = useI18n();
  const navigate = useNavigate();
  return (
    <A.Root open={open} onOpenChange={(o) => !o && onDismiss()}>
      <A.Portal>
        <A.Overlay className="fixed inset-0 z-[2000] bg-accent-400 animate-fade-in" />
        <A.Content
          className="fixed inset-0 z-[2001] flex flex-col items-center overflow-y-auto bg-accent-400 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10 text-center text-brand-900 focus:outline-none"
          onEscapeKeyDown={onDismiss}
        >
          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center">
            <span className="rounded-lg bg-brand-900 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-accent-400 animate-slide-up">{t('Alert')}</span>

            <div className="relative mt-8 flex size-64 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-[3px] border-brand-900/70" />
              <span className="absolute inset-0 rounded-full border-2 border-brand-900/40 animate-alert-ring" aria-hidden />
              <span className="absolute inset-0 rounded-full border-2 border-brand-900/30 animate-alert-ring [animation-delay:0.9s]" aria-hidden />
              <span className="relative flex size-32 items-center justify-center rounded-full bg-brand-900 shadow-2xl animate-pop-in">
                <Bell className="size-16 text-accent-400 animate-bell" strokeWidth={2.2} aria-hidden />
              </span>
            </div>

            <A.Title className="mt-8 text-[38px] font-extrabold leading-[1.1] tracking-tight animate-slide-up [animation-delay:120ms]">
              {t('Your stop is approaching!')}
            </A.Title>
            <A.Description asChild>
              <div className="mt-4 animate-slide-up [animation-delay:200ms]">
                <p className="text-2xl font-bold">{destinationName}</p>
                <p className="mt-1 text-[17px] font-medium">
                  {distanceM != null ? t('{distance} left · next stop', { distance: formatDistance(distanceM) }) : t('Get ready to get off.')}
                </p>
              </div>
            </A.Description>

            <div className="mt-5 flex gap-2 animate-slide-up [animation-delay:260ms]">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-brand-900/12 px-3.5 py-1.5 text-sm font-semibold', !sound && 'line-through opacity-50')}>
                <Volume2 className="size-4" aria-hidden /> {t('Sound')}
              </span>
              <span className={cn('inline-flex items-center gap-1.5 rounded-full bg-brand-900/12 px-3.5 py-1.5 text-sm font-semibold', !vibration && 'line-through opacity-50')}>
                <Smartphone className="size-4" aria-hidden /> {t('Vibration')}
              </span>
            </div>

            <div className="mt-auto w-full space-y-3 pt-10 animate-slide-up [animation-delay:320ms]">
              <button
                type="button"
                autoFocus
                disabled={busy}
                onClick={onArrived}
                className="press h-16 w-full rounded-2xl bg-brand-900 text-lg font-bold text-white shadow-xl transition-colors hover:bg-brand-700 disabled:opacity-60"
              >
                {t("I'm awake — turn off")}
              </button>
              <button
                type="button"
                onClick={onSnooze}
                className="press h-14 w-full rounded-2xl border-[2.5px] border-brand-900 text-base font-bold transition-colors hover:bg-brand-900/8"
              >
                {t('Remind me again in 30 seconds')}
              </button>
              <button
                type="button"
                onClick={() => {
                  onDismiss();
                  navigate(`/support?journey=${journeyId}&topic=alert`);
                }}
                className="pt-1 text-sm font-semibold underline underline-offset-4"
              >
                {t('Alert came at the wrong time? Report it')}
              </button>
            </div>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}
