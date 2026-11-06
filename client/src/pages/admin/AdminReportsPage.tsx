import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { JOURNEY_STATUS_LABELS, TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, type JourneyStatus, type TicketCategory } from '@busify/shared';
import { BarList, ColumnChart } from '@/components/charts';
import { DateRangeFilter, lastDays } from '@/components/DateRangeFilter';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { PageHeader, Panel, PanelHeader, Stat, Table, Td, Th } from '@/components/ui/layout';
import { api, errorMessage, qs } from '@/lib/api';
import { cn, downloadCsv, formatDateTime, formatHours } from '@/lib/utils';
import { t } from '@/lib/i18n';

interface Report {
  from: string;
  to: string;
  days: number;
  totals: {
    newUsers: number;
    newPassengers: number;
    journeys: number;
    alerts: number;
    alertRate: number | null;
    simulatedJourneys: number;
    ticketsOpened: number;
    ticketsResolved: number;
    averageResolutionHours: number | null;
    errors: number;
    serverErrors: number;
    clientErrors: number;
  };
  series: Array<{ date: string; newUsers: number; journeys: number; alerts: number; ticketsOpened: number; ticketsResolved: number; errors: number }>;
  journeyOutcomes: Record<JourneyStatus, number>;
  topDestinations: Array<{ name: string; count: number }>;
  topRoutes: Array<{ name: string; count: number }>;
  ticketsByCategory: Record<TicketCategory, number>;
  topErrors: Array<{ message: string; source: string; count: number; lastSeen: string }>;
}

const shortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Statistics and the error report for a chosen period. */
export default function AdminReportsPage() {
  const [range, setRange] = useState(() => lastDays(30));
  const query = useQuery({
    queryKey: ['admin', 'reports', range],
    queryFn: () => api.get<Report>(`/admin/reports${qs(range)}`),
    placeholderData: keepPreviousData,
  });
  const r = query.data;
  const series = (key: keyof Report['series'][number]) =>
    (r?.series ?? []).map((s) => ({ key: s.date, label: shortDate(s.date), value: s[key] as number }));

  return (
    <Page width="wide">
      <PageHeader
        title={t('Reports')}
        description={t('Usage statistics, alert performance, support load and errors for the selected period.')}
        actions={
          <Button
            variant="outline"
            disabled={!r}
            onClick={() =>
              r &&
              downloadCsv(
                `busify-daily-${range.from}-to-${range.to}.csv`,
                r.series.map((s) => ({
                  date: s.date,
                  new_users: s.newUsers,
                  journeys: s.journeys,
                  alerts: s.alerts,
                  tickets_opened: s.ticketsOpened,
                  tickets_resolved: s.ticketsResolved,
                  errors: s.errors,
                })),
              )
            }
          >
            <Download aria-hidden /> Export daily CSV
          </Button>
        }
      />
      <div className="mb-5">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {query.isLoading ? (
        <Skeleton className="h-96" />
      ) : query.isError ? (
        <Callout tone="error" title={t('Could not load the report')}>{errorMessage(query.error)}</Callout>
      ) : (
        <div className={cn('space-y-6', query.isFetching && 'opacity-70 transition-opacity')}>
          <Panel className="px-5 py-4">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label={t('Journeys')} value={r!.totals.journeys} sub={`${r!.totals.simulatedJourneys} used the simulator`} />
              <Stat label={t('Alerts sent')} value={r!.totals.alerts} sub={r!.totals.alertRate != null ? `${Math.round(r!.totals.alertRate * 100)}% of journeys` : 'No journeys'} />
              <Stat label={t('New accounts')} value={r!.totals.newUsers} sub={`${r!.totals.newPassengers} passengers`} />
              <Stat label={t('Tickets opened')} value={r!.totals.ticketsOpened} sub={`${r!.totals.ticketsResolved} resolved`} />
              <Stat label={t('Avg. resolution')} value={formatHours(r!.totals.averageResolutionHours)} />
              <Stat label={t('Errors')} value={r!.totals.errors} sub={`${r!.totals.serverErrors} server · ${r!.totals.clientErrors} app`} tone={r!.totals.serverErrors ? 'danger' : 'default'} />
            </dl>
          </Panel>

          <Panel>
            <PanelHeader title={t('Per day')} description={`${r!.days} days · hover or focus a column for its value`} />
            <div className="grid gap-x-8 gap-y-8 p-5 md:grid-cols-2 xl:grid-cols-3">
              <ColumnChart title={t('Journeys started')} measure={t('Journeys')} data={series('journeys')} />
              <ColumnChart title={t('Stop alerts sent')} measure={t('Alerts')} data={series('alerts')} />
              <ColumnChart title={t('New accounts')} measure={t('Accounts')} data={series('newUsers')} />
              <ColumnChart title={t('Support tickets opened')} measure={t('Tickets')} data={series('ticketsOpened')} />
              <ColumnChart title={t('Support tickets resolved')} measure={t('Tickets')} data={series('ticketsResolved')} />
              <ColumnChart title={t('Errors recorded')} measure={t('Errors')} data={series('errors')} />
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel>
              <PanelHeader title={t('Journey outcomes')} />
              <div className="p-4">
                <BarList measure={t('Journeys')} items={(Object.keys(r!.journeyOutcomes) as JourneyStatus[]).map((k) => ({ name: t(JOURNEY_STATUS_LABELS[k]), value: r!.journeyOutcomes[k] }))} />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title={t('Most chosen destinations')} />
              <div className="p-4">
                <BarList measure={t('Journeys')} items={r!.topDestinations.map((t) => ({ name: t.name, value: t.count }))} />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title={t('Busiest routes')} />
              <div className="p-4">
                <BarList measure={t('Journeys')} items={r!.topRoutes.map((t) => ({ name: t.name, value: t.count }))} />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title={t('Tickets by category')} />
              <div className="p-4">
                <BarList measure={t('Tickets')} items={TICKET_CATEGORIES.map((c) => ({ name: t(TICKET_CATEGORY_LABELS[c]), value: r!.ticketsByCategory[c] }))} />
              </div>
            </Panel>
            <Panel className="lg:col-span-2">
              <PanelHeader title={t('Most frequent errors')} description={t('Grouped by message — open Activity & errors for details')} />
              {r!.topErrors.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink-muted">{t('No errors in this period.')}</p>
              ) : (
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Message')}</Th>
                      <Th>{t('Source')}</Th>
                      <Th className="text-right">{t('Count')}</Th>
                      <Th className="hidden md:table-cell">{t('Last seen')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {r!.topErrors.map((e) => (
                      <tr key={`${e.source}-${e.message}`}>
                        <Td className="max-w-md truncate">{e.message}</Td>
                        <Td className="text-ink-muted">{e.source === 'SERVER' ? 'Server' : 'Web app'}</Td>
                        <Td className="tabular text-right">{e.count}</Td>
                        <Td className="hidden whitespace-nowrap text-ink-muted md:table-cell">{formatDateTime(e.lastSeen)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Panel>
          </div>
        </div>
      )}
    </Page>
  );
}
