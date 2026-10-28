import {
  JOURNEY_STATUS_LABELS,
  ROUTE_STATUS_LABELS,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  type JourneyStatus,
  type RouteStatus,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from '@busify/shared';
import { FlaskConical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** Route number plate, styled like the sign on the front of a bus. */
export function RouteBadge({ number, color, size = 'md', className }: { number: string; color?: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-mono font-semibold leading-none text-white shadow-[inset_0_-2px_0_rgb(0_0_0/0.15)]',
        size === 'sm' && 'h-6 min-w-8 px-1.5 text-xs',
        size === 'md' && 'h-8 min-w-10 px-2 text-sm',
        size === 'lg' && 'h-11 min-w-13 px-2.5 text-lg',
        className,
      )}
      style={{ backgroundColor: color ?? '#1d41d8' }}
    >
      {number}
    </span>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge tone="violet" className={className} title="Sample data from the demo seed — not a real route or stop">
      <FlaskConical aria-hidden />
      Demo data
    </Badge>
  );
}

export function RouteStatusBadge({ status }: { status: RouteStatus }) {
  const tone = status === 'ACTIVE' ? 'success' : status === 'DRAFT' ? 'neutral' : 'warning';
  return <Badge tone={tone}>{ROUTE_STATUS_LABELS[status]}</Badge>;
}

export function JourneyStatusBadge({ status, alerted }: { status: JourneyStatus; alerted?: boolean }) {
  if (status === 'ACTIVE' && alerted) return <Badge tone="warning">Alerted</Badge>;
  const tone = status === 'ACTIVE' ? 'brand' : status === 'PAUSED' ? 'warning' : status === 'COMPLETED' ? 'success' : 'neutral';
  return <Badge tone={tone}>{JOURNEY_STATUS_LABELS[status]}</Badge>;
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const tone = status === 'OPEN' ? 'brand' : status === 'IN_PROGRESS' ? 'warning' : 'success';
  return <Badge tone={tone}>{TICKET_STATUS_LABELS[status]}</Badge>;
}

export function TicketPriorityBadge({ priority }: { priority: TicketPriority }) {
  if (priority === 'NORMAL') return null;
  const tone = priority === 'URGENT' ? 'danger' : priority === 'HIGH' ? 'warning' : 'neutral';
  return <Badge tone={tone}>{TICKET_PRIORITY_LABELS[priority]}</Badge>;
}

export function TicketCategoryLabel({ category }: { category: TicketCategory }) {
  return <span className="text-ink-muted">{TICKET_CATEGORY_LABELS[category]}</span>;
}

export function scheduleText(r: { firstDeparture: string | null; lastDeparture: string | null; headwayMinutes: number | null }) {
  const parts: string[] = [];
  if (r.headwayMinutes) parts.push(`every ${r.headwayMinutes} min`);
  if (r.firstDeparture && r.lastDeparture) parts.push(`${r.firstDeparture}–${r.lastDeparture}`);
  return parts.join(' · ');
}
