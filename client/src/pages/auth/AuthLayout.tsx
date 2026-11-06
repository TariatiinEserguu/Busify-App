import type { ReactNode } from 'react';
import { BusFront } from 'lucide-react';
import { LanguageSwitch } from '@/components/layout/AppShell';
import { useI18n } from '@/lib/i18n';

/** Animated route line with stops and a bus dot travelling along it. */
function RouteArt({ className }: { className?: string }) {
  const path = 'M-20 70 C 60 30, 110 120, 190 80 S 320 10, 420 60';
  return (
    <svg viewBox="0 0 400 140" className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <path d={path} fill="none" stroke="#2b3354" strokeWidth="22" strokeLinecap="round" />
      <path d={path} fill="none" stroke="#ffc233" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" className="animate-dash" />
      <circle cx="40" cy="57" r="7" fill="#10162c" stroke="#6b7499" strokeWidth="3" />
      <circle cx="200" cy="77" r="7" fill="#10162c" stroke="#6b7499" strokeWidth="3" />
      <circle cx="318" cy="32" r="22" fill="none" stroke="#ffc233" strokeOpacity="0.5" strokeWidth="1.5">
        <animate attributeName="r" values="14;26;14" dur="2.6s" repeatCount="indefinite" />
        <animate attributeName="stroke-opacity" values="0.7;0;0.7" dur="2.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="318" cy="32" r="8" fill="#ffc233" />
      <circle r="6" fill="#fff">
        <animateMotion dur="7s" repeatCount="indefinite" path={path} />
      </circle>
    </svg>
  );
}

/** Sign-in layout from the deck: navy hero with the brand, form on a light sheet. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="grid min-h-dvh bg-brand-900 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:bg-canvas">
      <aside className="relative flex flex-col items-center overflow-hidden bg-brand-900 px-6 pb-14 pt-8 text-white lg:justify-center lg:pb-8">
        <RouteArt className="pointer-events-none absolute inset-x-0 top-6 h-28 w-full opacity-90 lg:top-16 lg:h-40" />
        <RouteArt className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full rotate-180 opacity-40 lg:h-36" />
        <div className="absolute right-4 top-4 z-10">
          <LanguageSwitch tone="dark" />
        </div>
        <div className="relative mt-24 flex flex-col items-center text-center lg:mt-0">
          <span className="flex size-[88px] items-center justify-center rounded-[26px] bg-accent-400 text-brand-900 shadow-[0_0_60px_-4px_rgb(255_194_51/0.6)] animate-pop-in">
            <BusFront className="size-11 animate-float" strokeWidth={2.2} aria-hidden />
          </span>
          <h1 className="mt-6 text-[44px] font-extrabold leading-none tracking-[0.08em] animate-slide-up">BUSIFY</h1>
          <p className="mt-4 text-lg text-white/75 animate-slide-up [animation-delay:120ms]">{t('Never miss your stop')}</p>
          <ul className="mt-10 hidden max-w-sm space-y-3 text-left text-sm text-white/75 lg:block">
            <li className="stagger flex gap-3">• {t('Uses your real GPS position, not a guessed arrival time.')}</li>
            <li className="flex gap-3">• {t('Sound and vibration once you are within your chosen distance.')}</li>
            <li className="flex gap-3">• {t('Runs on your own computer and network.')}</li>
          </ul>
        </div>
      </aside>
      <main className="-mt-8 flex flex-col rounded-t-[32px] bg-canvas px-5 pb-8 pt-8 animate-sheet-up sm:px-10 lg:mt-0 lg:rounded-none lg:justify-center">
        <div className="mx-auto w-full max-w-sm">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
          {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
