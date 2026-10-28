import type { ReactNode } from 'react';
import { BellRing, Bus, MapPinned, ShieldCheck } from 'lucide-react';

/** Two-column sign-in layout: a quiet brand panel and the form. */
export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden overflow-hidden bg-brand-800 p-10 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white text-brand-800">
            <Bus className="size-5" aria-hidden />
          </span>
          BUSIFY
        </div>
        <div className="mt-auto max-w-md">
          <RouteDiagram />
          <h2 className="mt-10 text-3xl font-semibold leading-tight tracking-tight">Ride without watching every stop go by.</h2>
          <p className="mt-3 text-brand-100">
            Pick your route and stop. BUSIFY follows your position and wakes you up before you arrive.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-brand-50">
            <li className="flex gap-3"><MapPinned className="size-5 shrink-0 text-brand-200" aria-hidden /> Uses your real GPS position, not a guessed arrival time.</li>
            <li className="flex gap-3"><BellRing className="size-5 shrink-0 text-brand-200" aria-hidden /> Sound and vibration once you are within your chosen distance.</li>
            <li className="flex gap-3"><ShieldCheck className="size-5 shrink-0 text-brand-200" aria-hidden /> Runs on your own computer and network.</li>
          </ul>
        </div>
      </aside>
      <main className="flex flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center gap-2 font-semibold lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-white">
            <Bus className="size-[18px]" aria-hidden />
          </span>
          BUSIFY
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
          <div className="mt-7">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink-muted">{footer}</div>}
        </div>
      </main>
    </div>
  );
}

/** A small transit line diagram: stops along a line, the destination highlighted. */
function RouteDiagram() {
  const stops = ['Riverside', 'Old Market', 'Central Plaza', 'Library', 'University'];
  return (
    <div className="relative" aria-hidden>
      <div className="absolute left-[7px] top-2 bottom-2 w-1 rounded-full bg-brand-500" />
      <ul className="space-y-3">
        {stops.map((name, i) => (
          <li key={name} className="relative flex items-center gap-4">
            <span
              className={
                i === 3
                  ? 'relative z-10 size-[18px] rounded-full border-[3px] border-amber-300 bg-amber-400'
                  : 'relative z-10 size-[18px] rounded-full border-[3px] border-brand-500 bg-brand-800'
              }
            />
            <span className={i === 3 ? 'text-sm font-semibold text-white' : 'text-sm text-brand-200'}>{name}</span>
            {i === 3 && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[11px] font-semibold text-amber-950">Alert at 200 m</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
