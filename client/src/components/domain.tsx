import {
  JOURNEY_STATUS_LABELS,
  ROLE_LABELS,
  ROUTE_STATUS_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type JourneyStatus,
  type RoleName,
  type RouteStatus,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@busify/shared';
import { FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { t, useI18n } from '@/lib/i18n';
import { cn, initials } from '@/lib/utils';

/** Translated labels for the shared enums. */
export const label = {
  role: (r: RoleName) => t(ROLE_LABELS[r]),
  routeStatus: (s: RouteStatus) => t(ROUTE_STATUS_LABELS[s]),
  journeyStatus: (s: JourneyStatus) => t(JOURNEY_STATUS_LABELS[s]),
  ticketStatus: (s: TicketStatus) => (s === 'OPEN' ? t('New') : t(TICKET_STATUS_LABELS[s])),
  ticketCategory: (c: TicketCategory) => t(TICKET_CATEGORY_LABELS[c]),
  ticketPriority: (p: TicketPriority) => (p === 'NORMAL' ? t('Medium') : t(TICKET_PRIORITY_LABELS[p])),
};

/** Route number plate, styled like the sign on the front of a bus. */
export function RouteBadge({ number, color, size = 'md', className }: { number: string; color?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-bold leading-none tracking-tight text-white tabular',
        size === 'sm' && 'h-6 min-w-9 px-1.5 text-xs',
        size === 'md' && 'h-8 min-w-11 px-2 text-sm',
        size === 'lg' && 'h-11 min-w-14 rounded-xl px-2.5 text-base',
        className,
      )}
      style={{ backgroundColor: color ?? '#10162c' }}
    >
      {number}
    </span>
  );
}

/** Round initials avatar; amber like the deck's profile badge. */
export function Avatar({ name, size = 'md', tone = 'accent', className }: { name: string; size?: 'sm' | 'md' | 'lg'; tone?: 'accent' | 'ink' | 'muted'; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold',
        size === 'sm' && 'size-8 text-xs',
        size === 'md' && 'size-11 text-sm',
        size === 'lg' && 'size-14 text-lg',
        tone === 'accent' && 'bg-accent-400 text-brand-900',
        tone === 'ink' && 'bg-brand-600 text-white',
        tone === 'muted' && 'bg-sunken text-ink-muted',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <Badge tone="violet" className={className} title={t('Sample data from the demo seed — not a real route or stop')}>
      <FlaskConical aria-hidden />
      {t('Demo data')}
    </Badge>
  );
}

export function RouteStatusBadge({ status }: { status: RouteStatus }) {
  useI18n();
  const tone = status === 'ACTIVE' ? 'success' : status === 'DRAFT' ? 'neutral' : 'warning';
  return <Badge tone={tone}>{label.routeStatus(status)}</Badge>;
}

export function JourneyStatusBadge({ status, alerted }: { status: JourneyStatus; alerted?: boolean }) {
  const { t } = useI18n();
  if (status === 'ACTIVE' && alerted) return <Badge tone="accent">{t('Alerted')}</Badge>;
  const tone = status === 'ACTIVE' ? 'brand' : status === 'PAUSED' ? 'warning' : status === 'COMPLETED' ? 'success' : 'neutral';
  return <Badge tone={tone}>{label.journeyStatus(status)}</Badge>;
}

export const ticketStatusTone = (status: TicketStatus) => (status === 'OPEN' ? 'info' : status === 'IN_PROGRESS' ? 'warning' : 'success');
export const ticketStatusText = (status: TicketStatus) => (status === 'OPEN' ? 'text-info' : status === 'IN_PROGRESS' ? 'text-warn' : 'text-ok');

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  useI18n();
  return <Badge tone={ticketStatusTone(status)}>{label.ticketStatus(status)}</Badge>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  useI18n();
  if (priority === 'NORMAL') return null;
  const tone = priority === 'URGENT' ? 'danger' : priority === 'HIGH' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{label.ticketPriority(priority)}</Badge>;
}

export function TicketCategoryLabel({ category }: { category: TicketCategory }) {
  useI18n();
  return <span className="text-ink-muted">{label.ticketCategory(category)}</span>;
}

export function scheduleText(r: { firstDeparture: string | null; lastDeparture: string | null; headwayMinutes: number | null }) {
  const parts: string[] = [];
  if (r.firstDeparture && r.lastDeparture) parts.push(`${r.firstDeparture}–${r.lastDeparture}`);
  if (r.headwayMinutes) parts.push(t('every {n} min', { n: r.headwayMinutes }));
  return parts.join(' · ');
}

/** Hours left until a 48 h response deadline (negative when overdue). */
export function hoursLeft(createdAt: string, limitHours = 48, now = Date.now()) {
  return Math.round(limitHours - (now - new Date(createdAt).getTime()) / 3_600_000);
}
