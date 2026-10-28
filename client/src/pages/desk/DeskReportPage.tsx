import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Download, FileCheck2 } from 'lucide-react';
import { TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, type TicketCategory, type TicketPriority } from '@busify/shared';
import { BarList } from '@/components/charts';
import { DateRangeFilter, lastDays } from '@/components/DateRangeFilter';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { PageHeader, Panel, PanelHeader, Stat, Table, Td, Th } from '@/components/ui/layout';
import { api, errorMessage, qs } from '@/lib/api';
import { cn, downloadCsv, formatDateTime, formatHours } from '@/lib/utils';

interface ResolvedReport {
  from: string;
  to: string;
  summary: {
    opened: number;
    resolved: number;
    escalated: number;
    averageResolutionHours: number | null;
    medianResolutionHours: number | null;
  };
  byCategory: Record<TicketCategory, number>;
  byAgent: Array<{ name: string; count: number }>;
  tickets: Array<{
    id: number;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    escalated: boolean;
    passenger: { id: number; name: string };
    assignedTo: { id: number; name: string } | null;
    routeNumber: string | null;
    createdAt: string;
    resolvedAt: string;
    resolutionHours: number;
  }>;
}

/** Report of resolved support cases for a chosen period (use case: "Шийдвэрлэсэн тохиолдлын тайлан"). */
export default function DeskReportPage() {
  const [range, setRange] = useState(() => lastDays(30));
  const query = useQuery({
    queryKey: ['support', 'report', range],
    queryFn: () => api.get<ResolvedReport>(`/support/reports/resolved${qs(range)}`),
    placeholderData: keepPreviousData,
  });
  const r = query.data;

  return (
    <Page width="wide">
      <PageHeader
        title="Resolved cases report"
        description="Support requests resolved in the selected period, with resolution times."
        actions={
          <Button
            variant="outline"
            disabled={!r || r.tickets.length === 0}
            onClick={() =>
              r &&
              downloadCsv(
                `busify-resolved-${range.from}-to-${range.to}.csv`,
                r.tickets.map((t) => ({
                  id: t.id,
                  subject: t.subject,
                  category: TICKET_CATEGORY_LABELS[t.category],
                  priority: t.priority,
                  escalated: t.escalated ? 'yes' : 'no',
                  passenger: t.passenger.name,
                  assigned_to: t.assignedTo?.name ?? '',
                  route: t.routeNumber ?? '',
                  opened: t.createdAt,
                  resolved: t.resolvedAt,
                  resolution_hours: t.resolutionHours.toFixed(2),
                })),
              )
            }
          >
            <Download aria-hidden /> Export CSV
          </Button>
        }
      />
      <div className="mb-5">
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

      {query.isLoading ? (
        <Skeleton className="h-64" />
      ) : query.isError ? (
        <Callout tone="error" title="Could not load the report">
          {errorMessage(query.error)}
        </Callout>
      ) : (
        <div className={cn('space-y-6', query.isFetching && 'opacity-70 transition-opacity')}>
          <Panel className="px-5 py-4">
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-5">
              <Stat label="Opened in period" value={r!.summary.opened} />
              <Stat label="Resolved" value={r!.summary.resolved} />
              <Stat label="Were escalated" value={r!.summary.escalated} />
              <Stat label="Average time to resolve" value={formatHours(r!.summary.averageResolutionHours)} />
              <Stat label="Median time to resolve" value={formatHours(r!.summary.medianResolutionHours)} />
            </dl>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Resolved by category" />
              <div className="p-4">
                <BarList
                  measure="Resolved requests"
                  items={TICKET_CATEGORIES.map((c) => ({ name: TICKET_CATEGORY_LABELS[c], value: r!.byCategory[c] ?? 0 }))}
                />
              </div>
            </Panel>
            <Panel>
              <PanelHeader title="Resolved by agent" />
              <div className="p-4">
                <BarList measure="Resolved requests" items={r!.byAgent.map((a) => ({ name: a.name, value: a.count }))} />
              </div>
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="Resolved requests" description={`${r!.tickets.length} in this period`} />
            {r!.tickets.length === 0 ? (
              <EmptyState icon={FileCheck2} title="No requests were resolved in this period">
                Choose a longer period, or check the open tickets.
              </EmptyState>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Subject</Th>
                    <Th className="hidden md:table-cell">Category</Th>
                    <Th className="hidden md:table-cell">Agent</Th>
                    <Th>Resolved</Th>
                    <Th className="text-right">Took</Th>
                  </tr>
                </thead>
                <tbody>
                  {r!.tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-canvas">
                      <Td className="tabular text-ink-subtle">{t.id}</Td>
                      <Td>
                        <Link to={`/desk/tickets/${t.id}`} className="font-medium hover:underline">
                          {t.subject}
                        </Link>
                        <div className="text-xs text-ink-subtle">{t.passenger.name}</div>
                      </Td>
                      <Td className="hidden text-ink-muted md:table-cell">{TICKET_CATEGORY_LABELS[t.category]}</Td>
                      <Td className="hidden text-ink-muted md:table-cell">{t.assignedTo?.name ?? '—'}</Td>
                      <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(t.resolvedAt)}</Td>
                      <Td className="tabular text-right">{formatHours(t.resolutionHours)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Panel>
        </div>
      )}
    </Page>
  );
}
