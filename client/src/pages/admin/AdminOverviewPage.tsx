import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertOctagon, ArrowRight, FlaskConical, Radio, ShieldAlert } from 'lucide-react';
import { formatDistance } from '@busify/shared';
import { ColumnChart } from '@/components/charts';
import { JourneyStatusBadge, RouteBadge } from '@/components/domain';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { PageHeader, Panel, PanelHeader, Stat } from '@/components/ui/layout';
import { api, errorMessage } from '@/lib/api';
import type { AuditLogEntry, ErrorLogEntry, LiveJourney } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

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

const dayLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

export default function AdminOverviewPage() {
  const query = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api.get<Overview>('/admin/overview'),
    refetchInterval: 30_000,
  });

  if (query.isLoading) {
    return (
      <Page width="wide">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-6 h-28" />
        <Skeleton className="mt-6 h-72" />
      </Page>
    );
  }
  if (query.isError) {
    return (
      <Page width="wide">
        <Callout tone="error" title="Could not load the overview">{errorMessage(query.error)}</Callout>
      </Page>
    );
  }
  const d = query.data!;
  const c = d.counts;

  return (
    <Page width="wide">
      <PageHeader title="Overview" description="What is happening on BUSIFY right now." />

      {c.escalatedOpen > 0 && (
        <Link to="/desk" className="mb-5 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 hover:bg-red-100">
          <ShieldAlert className="size-5 text-red-600" aria-hidden />
          <span className="flex-1">
            <strong className="font-semibold">{c.escalatedOpen} support ticket{c.escalatedOpen === 1 ? '' : 's'}</strong> escalated to administrators and still open.
          </span>
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      )}

      <Panel className="px-5 py-4">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Passengers" value={c.passengers.toLocaleString()} sub={`${c.staff} staff · ${c.suspended} suspended`} />
          <Stat label="Routes in service" value={c.routesActive} sub={`${c.routesTotal} routes in total`} />
          <Stat label="Bus stops" value={c.stops} />
          <Stat label="Tracking now" value={c.activeJourneys} sub={`${c.journeysToday} journeys today`} />
          <Stat label="Open tickets" value={c.openTickets} sub={`${c.escalatedOpen} escalated`} tone={c.escalatedOpen ? 'warning' : 'default'} />
          <Stat label="Errors, last 24 h" value={c.errors24h} tone={c.errors24h ? 'danger' : 'default'} sub={<Link to="/admin/activity?tab=errors" className="hover:underline">View error log</Link>} />
        </dl>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="Last 7 days" description="Journeys started per day, and how many of them sent a stop alert" actions={<Button asChild variant="ghost" size="sm"><Link to="/admin/reports">Full reports</Link></Button>} />
          <div className="grid gap-6 p-4 sm:grid-cols-2">
            <ColumnChart title="Journeys" measure="Journeys" height={120} data={d.week.map((w) => ({ key: w.date, label: dayLabel(w.date), value: w.journeys }))} />
            <ColumnChart title="Stop alerts sent" measure="Alerts" height={120} data={d.week.map((w) => ({ key: w.date, label: dayLabel(w.date), value: w.alerts }))} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Journeys being tracked" description="Distance is the passenger's last reported distance to their stop" />
          {d.activeJourneys.length === 0 ? (
            <EmptyState icon={Radio} title="Nobody is tracking a journey right now" />
          ) : (
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {d.activeJourneys.map((j) => (
                <li key={j.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <RouteBadge number={j.routeNumber} color={j.routeColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{j.passenger.name} → {j.destinationName}</p>
                    <p className="text-xs text-ink-subtle">
                      {j.lastDistanceM != null ? `${formatDistance(j.lastDistanceM)} away` : 'No position yet'} · updated {timeAgo(j.lastPositionAt ?? j.startedAt)}
                      {j.usedSimulation && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-violet-700"><FlaskConical className="size-3" aria-hidden /> simulated</span>
                      )}
                    </p>
                  </div>
                  <JourneyStatusBadge status={j.status} alerted={!!j.alertTriggeredAt} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHeader title="Recent administrative activity" actions={<Button asChild variant="ghost" size="sm"><Link to="/admin/activity">All activity</Link></Button>} />
          <ul className="divide-y divide-line">
            {d.recentActivity.map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-2.5 text-sm">
                <span className="w-20 shrink-0 text-xs text-ink-subtle">{timeAgo(a.createdAt)}</span>
                <span className="min-w-0">
                  <span className="text-ink">{a.summary}</span>
                  <span className="block text-xs text-ink-subtle">{a.actor?.name ?? 'System'} · {a.action}</span>
                </span>
              </li>
            ))}
            {d.recentActivity.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-muted">No activity recorded yet.</li>}
          </ul>
        </Panel>

        <Panel>
          <PanelHeader title="Latest errors" actions={<Button asChild variant="ghost" size="sm"><Link to="/admin/activity?tab=errors">Error log</Link></Button>} />
          {d.recentErrors.length === 0 ? (
            <EmptyState icon={AlertOctagon} title="No errors recorded">Server and app errors appear here for troubleshooting.</EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {d.recentErrors.map((e) => (
                <li key={e.id} className="flex gap-3 px-4 py-2.5 text-sm">
                  <span className="w-20 shrink-0 text-xs text-ink-subtle">{timeAgo(e.createdAt)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{e.message}</span>
                    <span className="block text-xs text-ink-subtle">{e.source === 'SERVER' ? 'Server' : 'Web app'}{e.path ? ` · ${e.path}` : ''}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </Page>
  );
}
