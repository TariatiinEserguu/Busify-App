import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Radio } from 'lucide-react';
import { RouteBadge, JourneyStatusBadge, label } from '@/components/domain';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { KpiCard, PageHeader, Panel } from '@/components/ui/layout';
import { capabilities } from '@/features/journey/alertEffects';
import { api, errorMessage } from '@/lib/api';
import { appConfig } from '@/lib/config';
import { formatDistance, t, useI18n } from '@/lib/i18n';
import type { AuditLogEntry, ErrorLogEntry, LiveJourney, TicketListPayload } from '@/lib/types';
import { cn, formatTime, formatWeekday, timeAgo } from '@/lib/utils';

interface Overview {
  counts: {
    passengers: number;
    staff: number;
    suspended: number;
    routesTotal: number;
    routesActive: number;
    stops: number;
    activeJourneys: number;
    journeysToday: number;
    alertsToday: number;
    openTickets: number;
    escalatedOpen: number;
    errors24h: number;
  };
  week: Array<{ date: string; journeys: number; alerts: number }>;
  activeJourneys: LiveJourney[];
  recentActivity: AuditLogEntry[];
  recentErrors: ErrorLogEntry[];
}

/** Checks one map tile so the dashboard can show whether the map API answers. */
function useTileStatus() {
  const [state, setState] = useState<'checking' | 'ok' | 'error'>('checking');
  useEffect(() => {
    const img = new Image();
    img.onload = () => setState('ok');
    img.onerror = () => setState('error');
    img.src = appConfig.tileUrl.replace('{s}', 'a').replace('{z}', '13').replace('{x}', '6033').replace('{y}', '2876').replace('{r}', '');
  }, []);
  return state;
}

export default function AdminOverviewPage() {
  const { t, lang } = useI18n();
  const query = useQuery({ queryKey: ['admin', 'overview'], queryFn: () => api.get<Overview>('/admin/overview'), refetchInterval: 30_000 });
  const health = useQuery({ queryKey: ['health'], queryFn: () => api.get<{ status: string; database: string }>('/health'), refetchInterval: 60_000, retry: false });
  const tiles = useTileStatus();

  if (query.isLoading) {
    return (
      <Page width="wide">
        <Skeleton className="h-10 w-64" />
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-card" />
          ))}
        </div>
        <Skeleton className="mt-6 h-72 rounded-card" />
      </Page>
    );
  }
  if (query.isError) {
    return (
      <Page width="wide">
        <Callout tone="error" title={t('Could not load the overview')}>{errorMessage(query.error)}</Callout>
      </Page>
    );
  }
  const d = query.data!;
  const c = d.counts;
  const weekJourneys = d.week.reduce((s, w) => s + w.journeys, 0);
  const weekAlerts = d.week.reduce((s, w) => s + w.alerts, 0);
  const rate = weekJourneys ? (weekAlerts / weekJourneys) * 100 : null;
  const max = Math.max(1, ...d.week.map((w) => w.journeys));
  const today = d.week.length - 1;
  const number = (n: number) => n.toLocaleString(lang === 'mn' ? 'mn-MN' : 'en-GB');

  const status: Array<{ name: string; ok: boolean | null; text: string }> = [
    { name: t('Server'), ok: true, text: t('Normal') },
    { name: t('Database'), ok: health.data ? health.data.database === 'ok' : health.isError ? false : null, text: health.data?.database === 'ok' ? t('Normal') : health.isError ? t('Error') : t('Checking') },
    { name: t('Map API'), ok: tiles === 'ok' ? true : tiles === 'error' ? false : null, text: tiles === 'ok' ? t('Normal') : tiles === 'error' ? t('Unreachable') : t('Checking') },
    { name: t('Push notifications'), ok: capabilities.notifications() ? true : null, text: capabilities.notifications() ? t('Normal') : t('Needs HTTPS') },
    { name: t('Security'), ok: true, text: t('LAN only') },
  ];

  return (
    <Page width="wide">
      <PageHeader
        title={t('Dashboard')}
        description={t('Error report, statistics (UC10) · Escalated issues (UC16)')}
        actions={<span className="rounded-xl bg-surface px-4 py-2 text-sm font-bold shadow-card">{t('Last 7 days')}</span>}
      />

      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard style={{ ['--i' as string]: 0 }} label={t('Active passengers')} value={number(c.passengers)} note={t('{n} tracking now', { n: c.activeJourneys })} />
        <KpiCard style={{ ['--i' as string]: 1 }} label={t('Trips')} value={number(weekJourneys)} note={t('{n} today', { n: c.journeysToday })} />
        <KpiCard style={{ ['--i' as string]: 2 }} label={t('Alerts on time')} value={rate != null ? `${rate.toFixed(1)}%` : '—'} note={t('{n} alerts this week', { n: number(weekAlerts) })} />
        <KpiCard style={{ ['--i' as string]: 3 }} variant={c.errors24h ? 'warn' : 'light'} label={t('System errors')} value={c.errors24h} note={t('last 24 hours')} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Panel className="p-5">
            <h2 className="font-bold">{t('Daily trips')}</h2>
            <div className="mt-6 flex h-48 items-end gap-3 sm:gap-6" role="list" aria-label={t('Daily trips')}>
              {d.week.map((w, i) => (
                <div key={w.date} role="listitem" aria-label={`${formatWeekday(`${w.date}T12:00:00`)}: ${w.journeys}`} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                  <span className="mb-1.5 text-xs font-bold text-ink-muted tabular">{w.journeys}</span>
                  <div
                    className={cn('w-full max-w-14 origin-bottom rounded-t-lg transition-colors animate-[grow_700ms_var(--ease-out-soft)_both]', i === today ? 'bg-accent-400' : 'bg-brand-900 group-hover:bg-brand-600')}
                    style={{ height: `${Math.max(3, (w.journeys / max) * 100)}%`, animationDelay: `${i * 60}ms` }}
                  />
                  <span className="mt-2 text-xs font-bold">{formatWeekday(`${w.date}T12:00:00`)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{t('Error report')}</h2>
              <Link to="/admin/activity?tab=errors" className="text-sm font-semibold text-info underline underline-offset-4">{t('Error log')}</Link>
            </div>
            {d.recentErrors.length === 0 ? (
              <p className="mt-3 text-sm text-ink-muted">{t('No errors recorded')}</p>
            ) : (
              <table className="mt-3 w-full text-sm">
                <thead>
                  <tr className="text-left text-[13px] text-ink-muted">
                    <th className="py-2 pr-2 font-semibold">{t('Type')}</th>
                    <th className="py-2 pr-2 font-semibold">{t('Last')}</th>
                    <th className="py-2 font-semibold">{t('Who fixes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentErrors.map((e) => (
                    <tr key={e.id} className="border-t border-line">
                      <td className="max-w-0 truncate py-2.5 pr-2 font-semibold">{t(e.message)}</td>
                      <td className="whitespace-nowrap py-2.5 pr-2 text-ink-muted">{timeAgo(e.createdAt)}</td>
                      <td className="whitespace-nowrap py-2.5">{e.source === 'SERVER' ? t('Developer') : t('Admin')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel className="p-5">
            <h2 className="font-bold">{t('Journeys being tracked')}</h2>
            {d.activeJourneys.length === 0 ? (
              <EmptyState icon={Radio} title={t('Nobody is tracking a journey right now')} />
            ) : (
              <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto">
                {d.activeJourneys.map((j) => (
                  <li key={j.id} className="flex items-center gap-3 py-3 text-sm">
                    <RouteBadge number={j.routeNumber} color={j.routeColor} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {j.passenger.name} → {j.destinationName}
                      </p>
                      <p className="text-xs text-ink-subtle">
                        {j.lastDistanceM != null ? formatDistance(j.lastDistanceM) : t('No position yet')} · {timeAgo(j.lastPositionAt ?? j.startedAt)}
                      </p>
                    </div>
                    <JourneyStatusBadge status={j.status} alerted={!!j.alertTriggeredAt} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel className="p-5">
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-bold">{t('System status')}</h2>
              <span className="text-right text-xs font-semibold text-ink-muted">{t('Auto check · every 1 min')}</span>
            </div>
            <ul className="mt-3 divide-y divide-line">
              {status.map((s) => (
                <li key={s.name} className="flex items-center gap-2.5 py-2.5 text-sm">
                  <span className={cn('size-2.5 rounded-full', s.ok === true ? 'bg-ok' : s.ok === false ? 'bg-bad animate-blink' : 'bg-accent-500')} />
                  <span className="flex-1 font-semibold">{s.name}</span>
                  <span className={cn('font-bold', s.ok === true ? 'text-ok' : s.ok === false ? 'text-bad' : 'text-warn')}>{s.text}</span>
                </li>
              ))}
            </ul>
            {(c.errors24h > 0 || tiles === 'error') && (
              <div className="mt-3 rounded-2xl bg-warn-soft px-3.5 py-3 text-sm text-[#5c3d00]">
                <p className="font-bold">{t('{n} errors in the last 24 hours', { n: c.errors24h })}</p>
                <p className="mt-0.5">{t('Server errors are reported to developers automatically. The admin only monitors.')}</p>
              </div>
            )}
          </Panel>
          <EscalatedCard />
          <Panel className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{t('Recent activity')}</h2>
              <Link to="/admin/activity" className="text-sm font-semibold text-info underline underline-offset-4">{t('Open')}</Link>
            </div>
            <ul className="mt-2 space-y-2">
              {d.recentActivity.slice(0, 4).map((a) => (
                <li key={a.id} className="rounded-xl bg-sunken px-3 py-2 text-sm">
                  <p className="font-semibold">{a.summary}</p>
                  <p className="text-xs text-ink-subtle">
                    {a.actor?.name ?? t('System')} · {formatTime(a.createdAt)}
                  </p>
                </li>
              ))}
              {d.recentActivity.length === 0 && <li className="text-sm text-ink-muted">{t('No activity recorded yet.')}</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </Page>
  );
}

/** "Ажилтнаас шилжсэн асуудал": escalated requests with quick actions. */
function EscalatedCard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['tickets', 'desk', 'escalated-open'],
    queryFn: () => api.get<TicketListPayload>('/support/tickets?escalated=true&pageSize=20'),
  });
  const resolve = useMutation({
    mutationFn: (id: number) => api.patch(`/support/tickets/${id}`, { status: 'RESOLVED' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(t('Ticket updated'));
    },
    onError: (err) => toast.error(t('Could not update the ticket'), { description: errorMessage(err) }),
  });
  const list = (query.data?.tickets ?? []).filter((x) => x.status !== 'RESOLVED');
  return (
    <section className="rounded-card border-2 border-brand-900 bg-surface p-5">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-bold leading-snug">{t('Issues escalated by staff')}</h2>
        {list.length > 0 && <span className="rounded-lg bg-accent-400 px-2 py-1 text-xs font-bold animate-pop-in">{t('{n} new', { n: list.length })}</span>}
      </div>
      {query.isLoading ? (
        <Skeleton className="mt-3 h-28" />
      ) : list.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">{t('Nothing waiting for an administrator.')}</p>
      ) : (
        <ul className="stagger mt-3 space-y-3">
          {list.map((tk, i) => (
            <li key={tk.id} className="rounded-2xl bg-sunken p-3.5" style={{ ['--i' as string]: i }}>
              <p className="text-xs font-semibold text-ink-muted">
                #BF-{tk.id} · {label.ticketCategory(tk.category)} · {label.ticketPriority(tk.priority)}
              </p>
              <p className="mt-1 font-bold leading-snug">{tk.subject}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tk.category === 'ROUTE_DATA' ? (
                  <Button size="sm" onClick={() => navigate('/admin/stops')}>{t('Fix the stop')}</Button>
                ) : (
                  <Button size="sm" onClick={() => navigate(`/desk/escalated/${tk.id}`)}>{t('Open')}</Button>
                )}
                <Button size="sm" variant="outline" loading={resolve.isPending && resolve.variables === tk.id} onClick={() => resolve.mutate(tk.id)}>
                  {t('Resolved')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
