import { Slider as S, Switch as Sw, Tabs as T } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** On/off toggle; green when on, as in the deck. */
export function Switch({ className, ...props }: ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root
      className={cn(
        'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-line-strong transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-900 disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-ok',
        className,
      )}
      {...props}
    >
      <Sw.Thumb className="pointer-events-none block size-6 rounded-full bg-white shadow-[0_2px_6px_rgb(16_22_44/0.25)] transition-transform duration-300 ease-[var(--ease-spring)] data-[state=checked]:translate-x-5" />
    </Sw.Root>
  );
}

/** Range slider. `tone="dark"` is the amber-on-navy slider of the alert-distance card. */
export function Slider({ className, tone = 'light', ...props }: ComponentProps<typeof S.Root> & { tone?: 'light' | 'dark' }) {
  const dark = tone === 'dark';
  return (
    <S.Root className={cn('relative flex h-7 w-full touch-none select-none items-center', className)} {...props}>
      <S.Track className={cn('relative h-2 grow overflow-hidden rounded-full', dark ? 'bg-white/15' : 'bg-line')}>
        <S.Range className={cn('absolute h-full rounded-full', dark ? 'bg-accent-400' : 'bg-brand-900')} />
      </S.Track>
      <S.Thumb
        className={cn(
          'block size-6 rounded-full shadow-[0_2px_8px_rgb(16_22_44/0.35)] transition-transform duration-150 hover:scale-110 active:scale-95',
          'focus-visible:outline-none focus-visible:ring-4',
          dark ? 'border-[3px] border-brand-900 bg-accent-400 focus-visible:ring-accent-400/40' : 'border-[3px] border-brand-900 bg-white focus-visible:ring-accent-200',
        )}
        aria-label={props['aria-label']}
      />
    </S.Root>
  );
}

export const Tabs = T.Root;
export const TabsContent = T.Content;

/** Segmented control. */
export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return <T.List className={cn('inline-flex items-center gap-1 rounded-xl bg-sunken p-1', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-ink-muted transition-all duration-200 hover:text-ink',
        'data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-card [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

/** Pill-shaped choice chips (filters, categories, route numbers). */
export function Chip({
  active,
  className,
  ...props
}: ComponentProps<'button'> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors duration-150',
        active ? 'border-brand-900 bg-brand-900 text-white' : 'border-line-strong bg-surface text-ink hover:border-brand-300',
        className,
      )}
      {...props}
    />
  );
}

/** Small segmented switch, used for the language toggle and period pickers. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  tone = 'light',
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; title?: string }>;
  className?: string;
  size?: 'sm' | 'md';
  tone?: 'light' | 'dark';
  ariaLabel?: string;
}) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'relative inline-grid rounded-xl p-1',
        tone === 'dark' ? 'bg-white/10' : 'bg-sunken',
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className={cn(
          'absolute bottom-1 top-1 rounded-lg transition-transform duration-300 ease-[var(--ease-out-soft)]',
          tone === 'dark' ? 'bg-accent-400' : 'bg-surface shadow-card',
        )}
        style={{ left: 4, width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative z-10 rounded-lg font-semibold transition-colors duration-200',
            size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
            o.value === value
              ? tone === 'dark'
                ? 'text-brand-900'
                : 'text-ink'
              : tone === 'dark'
                ? 'text-white/70 hover:text-white'
                : 'text-ink-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
