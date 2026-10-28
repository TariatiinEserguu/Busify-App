import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3', {
  variants: {
    tone: {
      neutral: 'bg-slate-100 text-slate-700',
      brand: 'bg-brand-50 text-brand-800',
      success: 'bg-emerald-50 text-emerald-800',
      warning: 'bg-amber-50 text-amber-800',
      danger: 'bg-red-50 text-red-700',
      violet: 'bg-violet-50 text-violet-800',
      outline: 'border border-line-strong text-ink-muted',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
