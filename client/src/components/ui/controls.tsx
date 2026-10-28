import { Slider as S, Switch as Sw, Tabs as T } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: ComponentProps<typeof Sw.Root>) {
  return (
    <Sw.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-slate-300 transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-brand-700',
        className,
      )}
      {...props}
    >
      <Sw.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-sm transition-transform data-[state=checked]:translate-x-5" />
    </Sw.Root>
  );
}

export function Slider({ className, ...props }: ComponentProps<typeof S.Root>) {
  return (
    <S.Root className={cn('relative flex h-6 w-full touch-none select-none items-center', className)} {...props}>
      <S.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-slate-200">
        <S.Range className="absolute h-full bg-brand-600" />
      </S.Track>
      <S.Thumb
        className="block size-5 rounded-full border-2 border-brand-700 bg-white shadow transition-shadow focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200"
        aria-label={props['aria-label']}
      />
    </S.Root>
  );
}

export const Tabs = T.Root;
export const TabsContent = T.Content;

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return (
    <T.List
      className={cn('inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1', className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink-muted transition-colors hover:text-ink',
        'data-[state=active]:bg-brand-50 data-[state=active]:text-brand-800 [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}
