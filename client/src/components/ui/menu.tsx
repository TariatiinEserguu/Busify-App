import { DropdownMenu as M, Popover as P } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        className={cn('z-[1100] min-w-52 rounded-lg border border-line bg-surface p-1 shadow-lg animate-fade-in', className)}
        {...props}
      />
    </M.Portal>
  );
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        'flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm text-ink outline-none',
        'data-[highlighted]:bg-slate-100 [&_svg]:size-4 [&_svg]:text-ink-subtle',
        className,
      )}
      {...props}
    />
  );
}

export const DropdownMenuSeparator = () => <M.Separator className="my-1 h-px bg-line" />;
export const DropdownMenuLabel = ({ className, ...props }: ComponentProps<typeof M.Label>) => (
  <M.Label className={cn('px-2.5 py-1.5 text-xs text-ink-subtle', className)} {...props} />
);

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;

export function PopoverContent({ className, sideOffset = 8, align = 'end', ...props }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        align={align}
        className={cn('z-[1100] rounded-card border border-line bg-surface shadow-xl animate-fade-in focus:outline-none', className)}
        {...props}
      />
    </P.Portal>
  );
}
