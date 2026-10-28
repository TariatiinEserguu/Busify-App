import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** A bordered white section. Used sparingly — most pages are lists and tables. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={cn('rounded-card border border-line bg-surface', className)} {...props} />;
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
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
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
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-subtle">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-[22px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>}
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
      className={cn(
        'border-b border-line bg-canvas/60 px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-ink-subtle',
        className,
      )}
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
          'mt-1 text-2xl font-semibold tracking-tight',
          tone === 'warning' ? 'text-amber-700' : tone === 'danger' ? 'text-red-700' : 'text-ink',
        )}
      >
        {value}
      </dd>
      {sub && <dd className="mt-0.5 truncate text-xs text-ink-subtle">{sub}</dd>}
    </div>
  );
}
