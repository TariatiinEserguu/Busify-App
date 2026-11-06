import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Inbox, Info, Lock, Search } from 'lucide-react';
import { type TicketCategory, type TicketPriority, type TicketStatus } from '@busify/shared';
import { Avatar, hoursLeft, label } from '@/components/domain';
import { Page } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input, Textarea } from '@/components/ui/input';
import { PageHeader, Panel } from '@/components/ui/layout';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, errorMessage, qs } from '@/lib/api';
import { formatDistance, meters, t, useI18n } from '@/lib/i18n';
import type { Journey, TicketDetail, TicketListPayload, TicketSummary } from '@/lib/types';
import { cn, formatShortDateTime, formatTime } from '@/lib/utils';

type View = 'inbox' | 'escalated';
type Target = 'admin' | 'org' | 'self';

/** Who should handle a request, suggested from its category (deck slide "Ажилтан · 1"). */
const SUGGESTED: Record<TicketCategory, Target> = {
  APP_PROBLEM: 'admin',
  ROUTE_DATA: 'admin',
  COMPLAINT: 'org',
  QUESTION: 'self',
  FEEDBACK: 'self',
};

/** Short status line used in the ticket list. */
function listStatus(tk: TicketSummary) {
  if (tk.status === 'RESOLVED') return { text: label.ticketStatus('RESOLVED'), cls: 'text-ok' };
  if (tk.escalated) return { text: t('Sent to admin'), cls: 'text-warn' };
  if (tk.status === 'IN_PROGRESS') return { text: t('Forwarded'), cls: 'text-warn' };
  return { text: t('New'), cls: 'text-info' };
}

export default function DeskPage({ view }: { view: View }) {
  const { t } = useI18n();
  const { id } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const base = view === 'inbox' ? '/desk/tickets' : '/desk/escalated';
  const params = { escalated: view === 'escalated' ? 'true' : '', search: search.trim(), pageSize: 100 };
  const query = useQuery({
    queryKey: ['tickets', 'desk', params],
    queryFn: () => api.get<TicketListPayload>(`/support/tickets${qs(params)}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const list = query.data?.tickets ?? [];
  const selectedId = Number(id) || list[0]?.id || null;
  const overdue = list.filter((x) => x.status === 'OPEN' && hoursLeft(x.createdAt) < 0).length;

  return (
    <Page width="full" className="max-w-[1320px]">
      <PageHeader
        title={view === 'inbox' ? t('Complaints & feedback') : t('Escalated complaints')}
        description={
          view === 'inbox'
            ? t('Requests sent from the passenger app (UC11)')
            : t('Progress of requests sent to the admin or the transport company. The passenger is told as soon as a reply arrives.')
        }
        actions={
          view === 'inbox' &&
          query.data && (
            <div className="flex flex-wrap gap-2">
              <span className="rounded-xl bg-surface px-3 py-2 text-sm font-bold shadow-card">{t('New')} {query.data.counts.OPEN}</span>
              <span className="rounded-xl bg-surface px-3 py-2 text-sm font-bold shadow-card">{t('Forwarded')} {query.data.counts.IN_PROGRESS}</span>
              {overdue > 0 && <span className="rounded-xl bg-warn-soft px-3 py-2 text-sm font-bold text-warn">{t('Over 48 h')} {overdue}</span>}
            </div>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Panel className="h-fit p-2 lg:sticky lg:top-6">
          <div className="relative p-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('Subject, passenger or #id')} className="pl-9" aria-label={t('Search tickets')} />
          </div>
          {query.isLoading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : query.isError ? (
            <Callout tone="error" className="m-2">{errorMessage(query.error)}</Callout>
          ) : list.length === 0 ? (
            <EmptyState icon={Inbox} title={t('No tickets here')} />
          ) : (
            <ul className="stagger max-h-[calc(100dvh-14rem)] space-y-1 overflow-y-auto">
              {list.map((tk, i) => {
                const st = listStatus(tk);
                const active = tk.id === selectedId;
                return (
                  <li key={tk.id} style={{ ['--i' as string]: Math.min(i, 10) }}>
                    <button
                      type="button"
                      onClick={() => navigate(`${base}/${tk.id}`)}
                      className={cn(
                        'w-full rounded-2xl border-2 px-3.5 py-3 text-left transition-all duration-200',
                        active ? 'border-brand-900 bg-surface' : 'border-transparent hover:bg-canvas',
                      )}
                    >
                      <span className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-muted">
                        <span>
                          #BF-{tk.id} · {formatTime(tk.createdAt)}
                        </span>
                        <span className={cn('font-bold', st.cls)}>{st.text}</span>
                      </span>
                      <span className="mt-1 block truncate font-bold">{tk.subject}</span>
                      <span className="block truncate text-xs text-ink-subtle">
                        {tk.passenger.name} · {tk.route?.number ?? '—'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="min-w-0">
          {selectedId ? (
            <Workspace key={selectedId} ticketId={selectedId} view={view} />
          ) : (
            !query.isLoading && (
              <Panel>
                <EmptyState icon={Inbox} title={t('Choose a request on the left')} />
              </Panel>
            )
          )}
        </div>
      </div>
    </Page>
  );
}

function useTicket(id: number) {
  const queryKey = ['tickets', 'detail', String(id)];
  const query = useQuery({ queryKey, queryFn: async () => (await api.get<{ ticket: TicketDetail }>(`/support/tickets/${id}`)).ticket });
  return { ...query, queryKey };
}

function Workspace({ ticketId, view }: { ticketId: number; view: View }) {
  const { t } = useI18n();
  const { data: tk, isLoading, isError, error, queryKey } = useTicket(ticketId);
  if (isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (isError || !tk) return <Callout tone="error">{errorMessage(error, 'Support request not found')}</Callout>;
  const left = hoursLeft(tk.createdAt);
  return (
    <div className="space-y-5 animate-fade-in">
      <Panel className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-ink-muted">
              #BF-{tk.id} · {formatShortDateTime(tk.createdAt)} · {tk.passenger.name}
              {tk.route ? ` · ${tk.route.number}` : ''} · {label.ticketCategory(tk.category)}
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">{tk.subject}</h2>
          </div>
          <Badge tone={tk.status === 'RESOLVED' ? 'success' : tk.status === 'OPEN' ? 'info' : 'warning'} className="px-3 py-1">
            {label.ticketStatus(tk.status)}
            {tk.status === 'OPEN' && ` · ${left >= 0 ? t('{n} h left', { n: left }) : t('{n} h overdue', { n: -left })}`}
          </Badge>
        </div>
        {view === 'escalated' ? (
          <Timeline ticket={tk} />
        ) : (
          <blockquote className="mt-4 whitespace-pre-wrap rounded-2xl bg-sunken px-4 py-3 text-[15px] leading-relaxed">«{tk.description}»</blockquote>
        )}
      </Panel>

      {view === 'inbox' && <TripHistory ticket={tk} />}
      <Conversation ticket={tk} />
      {view === 'inbox' ? <HandleCard ticket={tk} queryKey={queryKey} /> : <ReplyCard ticket={tk} queryKey={queryKey} />}
    </div>
  );
}

function TripHistory({ ticket: tk }: { ticket: TicketDetail }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const [all, setAll] = useState(false);
  const history = useQuery({
    queryKey: ['tickets', tk.id, 'passenger-journeys'],
    queryFn: async () => (await api.get<{ journeys: Journey[] }>(`/support/tickets/${tk.id}/passenger-journeys`)).journeys,
    enabled: can('passengers:history'),
  });
  if (!can('passengers:history')) return null;
  const rows = (history.data ?? []).slice(0, all ? 50 : 4);
  const missed = (history.data ?? []).filter((j) => j.destinationStopId === tk.journey?.destinationStopId && !j.alertTriggeredAt && j.status !== 'CANCELLED').length;
  return (
    <Panel className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">
          {t('Trip history')} <span className="font-normal text-ink-subtle">(UC12)</span>
        </h3>
        {(history.data?.length ?? 0) > 4 && (
          <button type="button" className="text-sm font-semibold text-info underline underline-offset-4" onClick={() => setAll((a) => !a)}>
            {all ? t('Show less') : t('Show all')}
          </button>
        )}
      </div>
      {history.isLoading ? (
        <Skeleton className="mt-3 h-32" />
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{t('This passenger has not tracked any trips yet.')}</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[13px] text-ink-muted">
                <th className="px-2 py-2 font-semibold">{t('Time')}</th>
                <th className="px-2 py-2 font-semibold">{t('Route → stop')}</th>
                <th className="px-2 py-2 font-semibold">{t('Distance')}</th>
                <th className="px-2 py-2 font-semibold">{t('Alert')}</th>
                <th className="px-2 py-2 font-semibold">GPS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => (
                <tr key={j.id} className={cn('border-t border-line', j.id === tk.journey?.id && 'bg-accent-50 font-semibold')}>
                  <td className="whitespace-nowrap px-2 py-2.5 tabular">{formatShortDateTime(j.startedAt)}</td>
                  <td className="px-2 py-2.5">
                    {j.routeNumber} → {j.destinationName}
                  </td>
                  <td className="px-2 py-2.5 tabular">{meters(j.alertRadiusM)}</td>
                  <td className={cn('px-2 py-2.5 font-semibold', j.alertTriggeredAt ? 'text-ok' : j.status === 'CANCELLED' ? 'text-ink-subtle' : 'text-bad')}>
                    {j.alertTriggeredAt ? `${t('On time')}${j.alertDistanceM != null ? ` (${formatDistance(j.alertDistanceM)})` : ''}` : j.status === 'CANCELLED' ? t('Cancelled') : t('Did not come')}
                  </td>
                  <td className="px-2 py-2.5">{j.usedSimulation ? t('Simulator') : t('Normal')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {missed > 1 && (
        <p className="mt-3 text-sm text-ink-muted">
          {t('Assessment:')} <strong className="text-ink">{t('the alert failed repeatedly at the same stop → the stop coordinates may be wrong.')}</strong>
        </p>
      )}
    </Panel>
  );
}

function Conversation({ ticket: tk }: { ticket: TicketDetail }) {
  const { t } = useI18n();
  if (tk.responses.length === 0) return null;
  return (
    <Panel className="p-5">
      <h3 className="font-bold">{t('Conversation')}</h3>
      <ol className="stagger mt-3 space-y-3">
        {tk.responses.map((r, i) => (
          <li key={r.id} className={cn('flex gap-3 rounded-2xl px-3 py-2.5', r.isInternal ? 'bg-warn-soft' : 'bg-sunken')} style={{ ['--i' as string]: i }}>
            <Avatar name={r.author?.name ?? '?'} size="sm" tone={r.author?.role === 'PASSENGER' ? 'muted' : 'ink'} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span className="font-bold text-ink">{r.author?.name ?? t('Deleted user')}</span>
                {r.isInternal && (
                  <span className="inline-flex items-center gap-1 font-semibold text-warn">
                    <Lock className="size-3" aria-hidden /> {t('Internal note')}
                  </span>
                )}
                {formatShortDateTime(r.createdAt)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{r.message}</p>
            </div>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function useTicketActions(tk: TicketDetail, queryKey: unknown[]) {
  const queryClient = useQueryClient();
  const done = (res: { ticket: TicketDetail }, msg: string) => {
    queryClient.setQueryData(queryKey, res.ticket);
    void queryClient.invalidateQueries({ queryKey: ['tickets', 'desk'] });
    void queryClient.invalidateQueries({ queryKey: ['tickets', 'nav-counts'] });
    toast.success(t(msg));
  };
  const fail = (err: unknown) => toast.error(t('Could not update the ticket'), { description: errorMessage(err) });
  return {
    reply: useMutation({
      mutationFn: (v: { message: string; internal: boolean }) => api.post<{ ticket: TicketDetail }>(`/support/tickets/${tk.id}/responses`, v),
      onSuccess: (res, v) => done(res, v.internal ? 'Internal note added' : 'Reply sent'),
      onError: fail,
    }),
    update: useMutation({
      mutationFn: (v: { status?: TicketStatus; priority?: TicketPriority; note?: string }) => api.patch<{ ticket: TicketDetail }>(`/support/tickets/${tk.id}`, v),
      onSuccess: (res) => done(res, 'Ticket updated'),
      onError: fail,
    }),
    escalate: useMutation({
      mutationFn: (reason: string) => api.post<{ ticket: TicketDetail }>(`/support/tickets/${tk.id}/escalate`, { reason }),
      onSuccess: (res) => done(res, 'Escalated. Administrators have been notified.'),
      onError: fail,
    }),
  };
}

/** "Бүртгэж, холбогдох талд шилжүүлэх" — priority, who handles it, a note and the action. */
function HandleCard({ ticket: tk, queryKey }: { ticket: TicketDetail; queryKey: unknown[] }) {
  const { t } = useI18n();
  const { can } = useAuth();
  const actions = useTicketActions(tk, queryKey);
  const suggested = SUGGESTED[tk.category];
  const [target, setTarget] = useState<Target>(tk.escalated ? 'self' : suggested);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [note, target]);
  const busy = actions.reply.isPending || actions.update.isPending || actions.escalate.isPending;

  const targets: Array<{ id: Target; title: string; text: string; foot: string; disabled?: boolean }> = [
    { id: 'admin', title: t('System admin'), text: t('Technical or data errors: app, alert, stop location'), foot: t('System notification → UC16'), disabled: tk.escalated || !can('tickets:escalate') },
    { id: 'org', title: t('Transport company'), text: t('Service issues: delays, driver, schedule'), foot: t('Recorded and forwarded by email') },
    { id: 'self', title: t('Resolve myself'), text: t('General questions, how-to'), foot: t('Reply to the passenger directly') },
  ];
  const primaryLabel = target === 'admin' ? t('Escalate to admin') : target === 'org' ? t('Forward to company') : t('Send reply');

  async function submit() {
    const text = note.trim();
    if (text.length < 5) return setError(t('Write a note of at least 5 characters.'));
    if (target === 'admin') await actions.escalate.mutateAsync(text);
    else if (target === 'org') {
      await actions.reply.mutateAsync({ message: `${t('Forwarded to the transport company')}: ${text}`, internal: true });
      if (tk.status === 'OPEN') await actions.update.mutateAsync({ status: 'IN_PROGRESS' });
    } else await actions.reply.mutateAsync({ message: text, internal: false });
    setNote('');
  }

  const priorities: Array<[TicketPriority, string]> = [
    ['LOW', t('Low')],
    ['NORMAL', t('Medium')],
    ['HIGH', t('High')],
  ];

  return (
    <section className="rounded-card border-2 border-brand-900 bg-surface p-5 animate-slide-up">
      <h3 className="font-bold">
        {t('Register and forward')} <span className="font-normal text-ink-subtle">(UC13)</span>
      </h3>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <p className="mb-1.5 text-sm font-semibold">{t('Category')}</p>
          <div className="flex h-12 items-center rounded-xl border border-line-strong px-3.5 text-sm font-semibold">{label.ticketCategory(tk.category)}</div>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold">{t('Priority')}</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('Priority')}>
            {priorities.map(([p, name]) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={tk.priority === p}
                disabled={busy}
                onClick={() => tk.priority !== p && actions.update.mutate({ priority: p })}
                className={cn(
                  'press flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors',
                  tk.priority === p ? 'border-2 border-brand-900' : 'border-line-strong hover:border-brand-300',
                )}
              >
                <span className={cn('size-4 rounded-full border-2', tk.priority === p ? 'border-info bg-info shadow-[inset_0_0_0_2.5px_#fff]' : 'border-line-strong')} />
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mb-2 mt-5 text-sm font-semibold">
        {t('Who should handle it?')} <span className="font-normal text-ink-muted">— {t('suggested from the category')}</span>
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {targets.map((x) => (
          <button
            key={x.id}
            type="button"
            disabled={x.disabled}
            onClick={() => setTarget(x.id)}
            aria-pressed={target === x.id}
            className={cn(
              'lift relative rounded-2xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              target === x.id ? 'border-2 border-brand-900 bg-accent-50' : 'border-line-strong',
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-bold">{x.title}</span>
              {x.id === suggested && <span className="rounded-md bg-accent-400 px-1.5 py-0.5 text-[11px] font-bold">{t('Suggested')}</span>}
            </span>
            <span className="mt-1 block text-xs text-ink-muted">{x.text}</span>
            <span className="mt-2 block text-xs font-bold">{x.foot}</span>
          </button>
        ))}
      </div>

      <label htmlFor="desk-note" className="mb-1.5 mt-5 block text-sm font-semibold">
        {target === 'self' ? t('Reply to the passenger') : t('Note')}
      </label>
      <Textarea id="desk-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} aria-invalid={!!error || undefined} />
      {error && <p className="mt-1 text-xs font-medium text-bad">{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {tk.status !== 'RESOLVED' && (
          <Button variant="outline" size="lg" disabled={busy} onClick={() => actions.update.mutate({ status: 'RESOLVED' })}>
            {t('Mark resolved')}
          </Button>
        )}
        <Button size="lg" loading={busy} onClick={submit}>
          {primaryLabel}
        </Button>
      </div>
    </section>
  );
}

/** Vertical progress line for an escalated request. */
function Timeline({ ticket: tk }: { ticket: TicketDetail }) {
  const { t } = useI18n();
  const steps = useMemo(() => {
    const out: Array<{ title: string; sub: string; done: boolean }> = [];
    for (const e of tk.events) {
      const who = e.actor?.name ?? t('System');
      const when = formatShortDateTime(e.createdAt);
      if (e.type === 'CREATED') out.push({ title: t('Passenger sent'), sub: `${when} · ${t('from the app')}`, done: true });
      else if (e.type === 'ESCALATED') out.push({ title: t('Escalated to the admin'), sub: `${when} · ${who}`, done: true });
      else if (e.type === 'STATUS_CHANGED' && e.toStatus === 'IN_PROGRESS') out.push({ title: t('Registered: {c}', { c: label.ticketCategory(tk.category) }), sub: `${when} · ${who}`, done: true });
      else if (e.type === 'RESPONSE_ADDED') out.push({ title: t('Reply sent to the passenger'), sub: `${when} · ${who}`, done: true });
      else if (e.type === 'STATUS_CHANGED' && e.toStatus === 'RESOLVED') out.push({ title: t('Resolved'), sub: `${when} · ${who}`, done: true });
      else if (e.type === 'REOPENED') out.push({ title: t('Re-opened'), sub: `${when} · ${who}`, done: true });
    }
    if (tk.status !== 'RESOLVED') out.push({ title: t('Send the reply to the passenger'), sub: t('Waiting'), done: false });
    return out;
  }, [tk]);
  return (
    <ol className="stagger mt-4">
      {steps.map((s, i) => (
        <li key={i} className="relative flex gap-3 pb-3 last:pb-0" style={{ ['--i' as string]: i }}>
          {i < steps.length - 1 && <span className={cn('absolute left-[9px] top-5 h-full w-[3px]', steps[i + 1].done ? 'bg-ok' : 'bg-line-strong')} aria-hidden />}
          <span className={cn('relative z-10 mt-0.5 size-[21px] shrink-0 rounded-full', s.done ? 'bg-ok' : 'bg-line-strong')} aria-hidden />
          <span>
            <span className="block font-bold">{s.title}</span>
            <span className="block text-sm text-ink-muted">{s.sub}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** "Байгууллагын хариуг бүртгэх": record the reply, send it on, close or re-open. */
function ReplyCard({ ticket: tk, queryKey }: { ticket: TicketDetail; queryKey: unknown[] }) {
  const { t } = useI18n();
  const actions = useTicketActions(tk, queryKey);
  const [received, setReceived] = useState('');
  const [toPassenger, setToPassenger] = useState('');
  const busy = actions.reply.isPending || actions.update.isPending;
  const mentionsChange = /хуваар|буудал|schedule|stop|хаа/i.test(received);
  return (
    <section className="rounded-card border-2 border-brand-900 bg-surface p-5 animate-slide-up">
      <h3 className="font-bold">{t('Record the reply')}</h3>
      <label htmlFor="received" className="mb-1.5 mt-4 block text-sm font-semibold">
        {t('Reply received')}
      </label>
      <Textarea id="received" rows={3} value={received} onChange={(e) => setReceived(e.target.value)} placeholder={t('What the admin or the company answered (internal).')} />
      {mentionsChange && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-info-soft px-3 py-2.5 text-sm text-[#1d3366] animate-fade-in">
          <Info className="size-4 shrink-0 text-info" aria-hidden />
          {t('The reply mentions a schedule or stop change — let the admin update the system.')}
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <Button variant="outline" disabled={busy || received.trim().length < 2} onClick={() => actions.reply.mutate({ message: received.trim(), internal: true }, { onSuccess: () => setReceived('') })}>
          {t('Save as internal note')}
        </Button>
      </div>
      <label htmlFor="to-passenger" className="mb-1.5 mt-4 block text-sm font-semibold">
        {t('Reply to send to the passenger')}
      </label>
      <Textarea id="to-passenger" rows={3} value={toPassenger} onChange={(e) => setToPassenger(e.target.value)} />
      <div className="mt-3 flex justify-end">
        <Button size="lg" loading={actions.reply.isPending} disabled={toPassenger.trim().length < 2} onClick={() => actions.reply.mutate({ message: toPassenger.trim(), internal: false }, { onSuccess: () => setToPassenger('') })}>
          {t('Send to passenger')}
        </Button>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm font-semibold">{t('Is the passenger satisfied?')}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy || tk.status === 'OPEN'} onClick={() => actions.update.mutate({ status: 'OPEN' })}>
            {t('No — re-open')}
          </Button>
          <Button variant="success" disabled={busy || tk.status === 'RESOLVED'} onClick={() => actions.update.mutate({ status: 'RESOLVED' })}>
            {t('Yes — close')}
          </Button>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-subtle">
        <Link to={`/support/${tk.id}`} className="underline">{t('Open the passenger view')}</Link>
      </p>
    </section>
  );
}

