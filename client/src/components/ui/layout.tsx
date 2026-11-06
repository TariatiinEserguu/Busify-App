import type { CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A white rounded card, as used throughout the deck. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-card bg-surface shadow-card', className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        <h1 className="text-[26px] font-medium leading-tight tracking-tight text-ink sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-3xl text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full border-collapse text-sm', className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn('border-b border-line px-4 py-2.5 text-left text-[13px] font-semibold text-ink-muted', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('border-b border-line px-4 py-3 align-middle text-ink', className)} {...props} />;
}

/** A labelled number for dashboards. */
export function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'default' | 'warning' | 'danger';
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs font-medium text-ink-subtle">{label}</dt>
      <dd
        className={cn(
          'mt-1 text-2xl font-semibold tracking-tight tabular',
          tone === 'warning' ? 'text-accent-700' : tone === 'danger' ? 'text-bad' : 'text-ink',
        )}
      >
        {value}
      </dd>
      {sub && <dd className="mt-0.5 truncate text-xs text-ink-subtle">{sub}</dd>}
    </div>
  );
}

/** KPI tile from the dashboards: label, big number, optional coloured footnote. */
export function KpiCard({
  label,
  value,
  unit,
  note,
  noteTone = 'muted',
  variant = 'light',
  className,
  style,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  note?: ReactNode;
  noteTone?: 'muted' | 'ok' | 'bad';
  variant?: 'light' | 'ink' | 'warn';
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        'lift min-w-0 rounded-card px-5 py-4',
        variant === 'ink' ? 'bg-brand-900 text-white' : variant === 'warn' ? 'bg-warn-soft text-ink' : 'bg-surface shadow-card',
        className,
      )}
    >
      <p className={cn('truncate text-sm font-medium', variant === 'ink' ? 'text-white/75' : variant === 'warn' ? 'text-warn' : 'text-ink-muted')}>{label}</p>
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[32px] font-bold leading-none tracking-tight tabular">{value}</span>
        {unit && <span className={cn('text-base font-semibold', variant === 'ink' ? 'text-white/80' : 'text-ink')}>{unit}</span>}
      </p>
      {note && (
        <p
          className={cn(
            'mt-2 truncate text-xs font-semibold',
            noteTone === 'ok' ? 'text-ok' : noteTone === 'bad' ? 'text-bad' : variant === 'ink' ? 'text-white/65 font-medium' : 'text-ink-subtle font-medium',
          )}
        >
          {note}
        </p>
      )}
    </div>
  );
}
