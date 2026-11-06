import type { HTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle, type LucideIcon } from 'lucide-react';
import { t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('skeleton-shimmer rounded-xl', className)} aria-hidden {...props} />;
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn('inline-flex items-center gap-2 text-sm text-ink-muted', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label ?? t('Loading')}…</span>
    </span>
  );
}

const calloutStyles = {
  info: { box: 'bg-info-soft text-[#1d3366]', icon: Info, iconClass: 'text-info' },
  warning: { box: 'bg-warn-soft text-[#5c3d00]', icon: AlertTriangle, iconClass: 'text-accent-700' },
  error: { box: 'bg-bad-soft text-[#7a1d16]', icon: XCircle, iconClass: 'text-bad' },
  success: { box: 'bg-ok-soft text-[#124d2f]', icon: CheckCircle2, iconClass: 'text-ok' },
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
      className={cn('flex gap-3 rounded-xl px-4 py-3 text-sm animate-fade-in', style.box, className)}
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
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-sunken text-ink-muted animate-pop-in">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
