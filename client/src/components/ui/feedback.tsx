import type { HTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-slate-200/80', className)} aria-hidden {...props} />;
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-ink-muted', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}…</span>
    </span>
  );
}

const calloutStyles = {
  info: { box: 'border-brand-200 bg-brand-50 text-brand-950', icon: Info, iconClass: 'text-brand-700' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-950', icon: AlertTriangle, iconClass: 'text-amber-600' },
  error: { box: 'border-red-200 bg-red-50 text-red-950', icon: XCircle, iconClass: 'text-red-600' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-950', icon: CheckCircle2, iconClass: 'text-emerald-600' },
} as const;

interface CalloutProps {
  tone?: keyof typeof calloutStyles;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

/** Inline message for errors, warnings and explanations. */
export function Callout({ tone = 'info', title, children, action, icon, className }: CalloutProps) {
  const style = calloutStyles[tone];
  const Icon = icon ?? style.icon;
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={cn('flex gap-3 rounded-lg border px-3.5 py-3 text-sm', style.box, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', style.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed opacity-90">{children}</div>}
        {action && <div className="pt-1.5">{action}</div>}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <span className="mb-3 flex size-11 items-center justify-center rounded-full bg-slate-100 text-ink-subtle">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
