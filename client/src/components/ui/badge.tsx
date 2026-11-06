import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3', {
  variants: {
    tone: {
      neutral: 'bg-sunken text-ink-muted',
      brand: 'bg-brand-900 text-white',
      accent: 'bg-accent-400 text-brand-900',
      info: 'bg-info-soft text-info',
      success: 'bg-ok-soft text-ok',
      warning: 'bg-warn-soft text-warn',
      danger: 'bg-bad-soft text-bad',
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
