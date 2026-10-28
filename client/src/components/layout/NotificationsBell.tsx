import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { Bell, BellOff } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { api } from '@/lib/api';
import type { Notification } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';

export function NotificationsBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<{ notifications: Notification[]; unread: number }>('/notifications'),
    refetchInterval: 30_000,
  });
  const markRead = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/read`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const unread = data?.unread ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn('relative flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-slate-100 hover:text-ink', className)}
          aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(22rem,calc(100vw-1.5rem))]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button className="text-xs font-medium text-brand-700 hover:underline" onClick={() => markAll.mutate()}>
              Mark all as read
            </button>
          )}
        </div>
        <ul className="max-h-96 overflow-y-auto">
          {(data?.notifications ?? []).length === 0 && (
            <li className="flex flex-col items-center gap-2 px-6 py-8 text-center text-sm text-ink-muted">
              <BellOff className="size-5 text-ink-subtle" aria-hidden />
              You are all caught up.
            </li>
          )}
          {(data?.notifications ?? []).map((n) => (
            <li key={n.id} className="border-b border-line last:border-0">
              <button
                className="flex w-full gap-3 px-4 py-3 text-left hover:bg-canvas"
                onClick={() => {
                  if (!n.readAt) markRead.mutate(n.id);
                  setOpen(false);
                  if (n.link) navigate(n.link);
                }}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand-600')} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{n.title}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-ink-subtle">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
