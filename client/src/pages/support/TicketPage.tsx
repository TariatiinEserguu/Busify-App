import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  History,
  Lock,
  MessageSquare,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react';
import {
  escalateTicketSchema,
  formatDistance,
  TICKET_CATEGORY_LABELS,
  TICKET_PRIORITIES,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '@busify/shared';
import { Page } from '@/components/layout/AppShell';
import { JourneyStatusBadge, RouteBadge, TicketPriorityBadge, TicketStatusBadge } from '@/components/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/controls';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Select, Textarea } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/ui/layout';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import type { Journey, TicketDetail, TicketEvent } from '@/lib/types';
import { cn, formatDate, formatDateTime, formatTime, initials, timeAgo } from '@/lib/utils';
import { JourneyList } from '../passenger/HistoryPage';

const EVENT_TEXT: Record<TicketEvent['type'], (e: TicketEvent) => string> = {
  CREATED: () => 'opened the request',
  STATUS_CHANGED: (e) => `changed status to ${e.toStatus ? TICKET_STATUS_LABELS[e.toStatus] : '—'}`,
  PRIORITY_CHANGED: (e) => `changed priority (${e.note ?? ''})`,
  ASSIGNED: (e) => (e.note === 'unassigned' ? 'removed the assignee' : 'assigned the request'),
  RESPONSE_ADDED: () => 'replied',
  INTERNAL_NOTE: () => 'added an internal note',
  ESCALATED: () => 'escalated to an administrator',
  REOPENED: () => 're-opened the request',
};

export function TicketPage({ mode }: { mode: 'passenger' | 'staff' }) {
  const { id } = useParams();
  const { can } = useAuth();
  const staff = mode === 'staff' && can('tickets:manage');
  const queryKey = ['tickets', 'detail', id];
  const query = useQuery({
    queryKey,
    queryFn: async () => (await api.get<{ ticket: TicketDetail }>(`/support/tickets/${id}`)).ticket,
  });
  const back = staff ? '/desk' : '/support';

  if (query.isLoading) {
    return (
      <Page>
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="mt-4 h-64" />
      </Page>
    );
  }
  if (query.isError || !query.data) {
    return (
      <Page>
        <EmptyState icon={MessageSquare} title="Support request not found" action={<Button asChild variant="outline"><Link to={back}>Back</Link></Button>}>
          {errorMessage(query.error, 'It may have been removed, or it belongs to another account.')}
        </EmptyState>
      </Page>
    );
  }

  const t = query.data;
  return (
    <Page width={staff ? 'wide' : 'narrow'}>
      <Link to={back} className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {staff ? 'All tickets' : 'My requests'}
      </Link>
      <header className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <TicketStatusBadge status={t.status} />
          {staff && <TicketPriorityBadge priority={t.priority} />}
          {t.escalated && (
            <Badge tone="danger">
              <ShieldAlert aria-hidden /> Escalated
            </Badge>
          )}
          <span className="text-xs text-ink-subtle">
            #{t.id} · {TICKET_CATEGORY_LABELS[t.category]} · opened {formatDateTime(t.createdAt)}
          </span>
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">{t.subject}</h1>
      </header>

      <div className={cn('grid gap-6', staff && 'lg:grid-cols-[minmax(0,1fr)_340px]')}>
        <div className="min-w-0 space-y-6">
          <Conversation ticket={t} staff={staff} />
          <ReplyBox ticket={t} staff={staff} queryKey={queryKey} />
        </div>
        {staff && <StaffSidebar ticket={t} queryKey={queryKey} />}
      </div>
    </Page>
  );
}

function Avatar({ name, staff }: { name: string; staff?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        staff ? 'bg-brand-100 text-brand-800' : 'bg-slate-200 text-slate-700',
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

function Conversation({ ticket: t, staff }: { ticket: TicketDetail; staff: boolean }) {
  return (
    <Panel>
      <ol className="divide-y divide-line">
        <li className="flex gap-3 px-4 py-4">
          <Avatar name={t.passenger.name} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-medium">{t.passenger.name}</span>{' '}
              <span className="text-xs text-ink-subtle">{formatDateTime(t.createdAt)}</span>
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-ink">{t.description}</p>
            {t.journey && <LinkedJourney journey={t.journey} />}
          </div>
        </li>
        {t.responses.map((r) => {
          const fromStaff = r.author?.role === 'SUPPORT' || r.author?.role === 'ADMIN';
          return (
            <li key={r.id} className={cn('flex gap-3 px-4 py-4', r.isInternal && 'bg-amber-50/60')}>
              <Avatar name={r.author?.name ?? '?'} staff={fromStaff} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-medium">{r.author?.name ?? 'Deleted user'}</span>
                  {fromStaff && <Badge tone="brand">{r.author?.role === 'ADMIN' ? 'Administrator' : 'Support'}</Badge>}
                  {r.isInternal && (
                    <Badge tone="warning">
                      <Lock aria-hidden /> Internal note
                    </Badge>
                  )}
                  <span className="text-xs text-ink-subtle">{formatDateTime(r.createdAt)}</span>
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{r.message}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {t.responses.length === 0 && (
        <p className="border-t border-line px-4 py-3 text-sm text-ink-muted">
          {staff ? 'No replies yet. The first reply moves the request to In progress.' : 'Support has not replied yet. You will get a notification when they do.'}
        </p>
      )}
    </Panel>
  );
}

function LinkedJourney({ journey: j }: { journey: Journey }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-canvas/60 px-3 py-2 text-xs">
      <RouteBadge number={j.routeNumber} color={j.routeColor} size="sm" />
      <span className="min-w-0 flex-1">
        Trip to <strong className="font-medium">{j.destinationName}</strong> · {formatDate(j.startedAt)} {formatTime(j.startedAt)} · alert at{' '}
        {j.alertRadiusM} m
        {j.alertTriggeredAt && (
          <span className="ml-1 inline-flex items-center gap-1 text-amber-700">
            <BellRing className="size-3" aria-hidden /> fired at {j.alertDistanceM != null ? formatDistance(j.alertDistanceM) : '—'}
          </span>
        )}
      </span>
      <JourneyStatusBadge status={j.status} />
    </div>
  );
}

function ReplyBox({ ticket, staff, queryKey }: { ticket: TicketDetail; staff: boolean; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = useMutation({
    mutationFn: () => api.post<{ ticket: TicketDetail }>(`/support/tickets/${ticket.id}/responses`, { message, internal }),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, res.ticket);
      void queryClient.invalidateQueries({ queryKey: ['tickets'], exact: false, refetchType: 'none' });
      setMessage('');
      setInternal(false);
      toast.success(internal ? 'Internal note added' : 'Reply sent');
    },
    onError: (err) => setError(errorMessage(err)),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!message.trim()) return setError('Write a message first.');
    send.mutate();
  }

  return (
    <Panel>
      <form onSubmit={onSubmit} className="space-y-3 p-4">
        <label htmlFor="reply" className="text-sm font-medium">
          {staff ? 'Reply to the passenger' : ticket.status === 'RESOLVED' ? 'Still need help? Reply to re-open this request' : 'Add a reply'}
        </label>
        <Textarea
          id="reply"
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={!!error || undefined}
          className={cn(internal && 'border-amber-300 bg-amber-50/40')}
          placeholder={internal ? 'Only support staff can see internal notes.' : 'Type your message…'}
        />
        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {staff ? (
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <Switch checked={internal} onCheckedChange={setInternal} aria-label="Internal note" />
              Internal note (hidden from the passenger)
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" loading={send.isPending}>
            {internal ? 'Add note' : 'Send reply'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function StaffSidebar({ ticket: t, queryKey }: { ticket: TicketDetail; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const { can, user } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  const staffList = useQuery({
    queryKey: ['support', 'staff'],
    queryFn: async () => (await api.get<{ staff: Array<{ id: number; name: string; role: string }> }>('/support/staff')).staff,
  });
  const history = useQuery({
    queryKey: ['tickets', t.id, 'passenger-journeys'],
    queryFn: async () => (await api.get<{ journeys: Journey[] }>(`/support/tickets/${t.id}/passenger-journeys`)).journeys,
    enabled: showHistory,
  });

  const update = useMutation({
    mutationFn: (body: { status?: TicketStatus; priority?: TicketPriority; assignedToId?: number | null }) =>
      api.patch<{ ticket: TicketDetail }>(`/support/tickets/${t.id}`, body),
    onSuccess: (res) => {
      queryClient.setQueryData(queryKey, res.ticket);
      void queryClient.invalidateQueries({ queryKey: ['tickets', 'desk'] });
      toast.success('Ticket updated');
    },
    onError: (err) => toast.error('Could not update the ticket', { description: errorMessage(err) }),
  });

  return (
    <aside className="space-y-4">
      <Panel>
        <PanelHeader title="Handling" />
        <div className="space-y-4 p-4">
          <Field label="Status">
            <Select value={t.status} onChange={(e) => update.mutate({ status: e.target.value as TicketStatus })} disabled={update.isPending}>
              {TICKET_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TICKET_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select value={t.priority} onChange={(e) => update.mutate({ priority: e.target.value as TicketPriority })} disabled={update.isPending}>
              {TICKET_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {TICKET_PRIORITY_LABELS[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assigned to">
            <Select
              value={t.assignedTo ? String(t.assignedTo.id) : ''}
              onChange={(e) => update.mutate({ assignedToId: e.target.value ? Number(e.target.value) : null })}
              disabled={update.isPending}
            >
              <option value="">Unassigned</option>
              {(staffList.data ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.id === user?.id ? ' (me)' : ''}
                </option>
              ))}
            </Select>
          </Field>

          {t.escalated ? (
            <Callout tone="error" icon={ShieldAlert} title="Escalated to administrators">
              {t.escalatedBy?.name ?? 'Someone'} · {t.escalatedAt ? timeAgo(t.escalatedAt) : ''}
              {t.escalationReason && <span className="mt-1 block">“{t.escalationReason}”</span>}
            </Callout>
          ) : (
            can('tickets:escalate') &&
            t.status !== 'RESOLVED' && (
              <Button variant="danger-outline" className="w-full" onClick={() => setEscalateOpen(true)}>
                <TriangleAlert aria-hidden /> Escalate to administrator
              </Button>
            )
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Passenger" />
        <div className="space-y-3 p-4 text-sm">
          <div>
            <p className="font-medium">{t.passenger.name}</p>
            <p className="break-all text-xs text-ink-subtle">{t.passenger.email}</p>
          </div>
          {t.route && (
            <p className="flex items-center gap-2 text-xs text-ink-muted">
              <RouteBadge number={t.route.number} size="sm" /> {t.route.name}
            </p>
          )}
          {can('passengers:history') && (
            <Button variant="outline" size="sm" onClick={() => setShowHistory(true)}>
              <History aria-hidden /> Journey history
            </Button>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Activity" description="Every action on this request" />
        <ol className="space-y-3 p-4">
          {t.events.map((e) => (
            <li key={e.id} className="flex gap-2 text-xs">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
              <span className="min-w-0">
                <span className="font-medium text-ink">{e.actor?.name ?? 'System'}</span>{' '}
                <span className="text-ink-muted">{EVENT_TEXT[e.type](e)}</span>
                {e.type === 'STATUS_CHANGED' && e.note && <span className="block text-ink-subtle">“{e.note}”</span>}
                <span className="block text-ink-subtle">{formatDateTime(e.createdAt)}</span>
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent variant="side" title={`Journey history — ${t.passenger.name}`} description="Most recent 50 journeys of the passenger who raised this request. Viewing is recorded in the audit log.">
          {history.isLoading ? (
            <Skeleton className="h-40" />
          ) : history.isError ? (
            <Callout tone="error">{errorMessage(history.error)}</Callout>
          ) : (history.data ?? []).length === 0 ? (
            <EmptyState icon={History} title="No journeys recorded">This passenger has not tracked any trips yet.</EmptyState>
          ) : (
            <div className="-mx-5">
              <JourneyList journeys={history.data!} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <EscalateDialog open={escalateOpen} onOpenChange={setEscalateOpen} ticketId={t.id} queryKey={queryKey} />
    </aside>
  );
}

function EscalateDialog({ open, onOpenChange, ticketId, queryKey }: { open: boolean; onOpenChange: (o: boolean) => void; ticketId: number; queryKey: unknown[] }) {
  const queryClient = useQueryClient();
  const form = useForm({ reason: '' });
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = form.validate(escalateTicketSchema);
    if (!input) return;
    setBusy(true);
    try {
      const res = await api.post<{ ticket: TicketDetail }>(`/support/tickets/${ticketId}/escalate`, input);
      queryClient.setQueryData(queryKey, res.ticket);
      toast.success('Escalated. Administrators have been notified.');
      onOpenChange(false);
    } catch (err) {
      if (!form.applyServerError(err)) toast.error('Could not escalate', { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Escalate to an administrator"
        description="Use this when the issue needs admin rights, e.g. fixing stop coordinates or an account problem."
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="escalate" variant="danger" loading={busy}>
              <ArrowUpRight aria-hidden /> Escalate
            </Button>
          </>
        }
      >
        <form id="escalate" onSubmit={onSubmit} noValidate>
          <Field label="Reason" error={form.errors.reason} hint="Administrators see this in their notification.">
            <Textarea rows={4} {...form.bind('reason')} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
