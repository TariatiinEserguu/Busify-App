import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold ' +
    'transition-[background-color,color,border-color,box-shadow,transform] duration-150 active:scale-[0.97] ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-900 ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-900 text-white shadow-sm hover:bg-brand-700',
        accent: 'bg-accent-400 text-brand-900 shadow-sm hover:bg-accent-300 hover:shadow-glow',
        secondary: 'bg-sunken text-ink hover:bg-line',
        outline: 'border border-line-strong bg-surface text-ink hover:border-brand-300 hover:bg-canvas',
        ghost: 'text-ink-muted hover:bg-sunken hover:text-ink',
        danger: 'bg-bad text-white shadow-sm hover:bg-red-700',
        'danger-outline': 'border-[1.5px] border-bad/80 bg-surface text-bad hover:bg-bad-soft',
        success: 'bg-ok text-white shadow-sm hover:bg-emerald-700',
        link: 'h-auto px-0 text-info underline underline-offset-4 hover:text-brand-900',
      },
      size: {
        sm: 'h-8 rounded-lg px-3 text-[13px]',
        md: 'h-10 px-4',
        lg: 'h-12 px-5 text-[15px]',
        xl: 'h-14 rounded-2xl px-6 text-base [&_svg]:size-5',
        icon: 'size-10',
        'icon-sm': 'size-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    if (asChild) {
      return (
        <Slot.Root ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot.Root>
      );
    }
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
