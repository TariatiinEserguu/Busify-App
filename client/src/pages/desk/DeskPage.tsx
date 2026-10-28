import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Inbox, Search, ShieldAlert } from 'lucide-react';
import { TICKET_CATEGORY_LABELS, TICKET_STATUS_LABELS, TICKET_STATUSES, type TicketStatus } from '@busify/shared';
import { Page } from '@/components/layout/AppShell';
import { RouteBadge, TicketPriorityBadge, TicketStatusBadge } from '@/components/domain';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Panel, Table, Td, Th } from '@/components/ui/layout';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, errorMessage, qs } from '@/lib/api';
import type { TicketListPayload } from '@/lib/types';
import { cn, timeAgo } from '@/lib/utils';

type StatusFilter = TicketStatus | 'ALL';

export default function DeskPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusFilter>('OPEN');
  const [escalated, setEscalated] = useState(user?.role === 'ADMIN' ? 'true' : '');
  const [assigned, setAssigned] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = { status: status === 'ALL' ? undefined : status, escalated, assigned, search: search.trim(), page, pageSize: 20 };
  const query = useQuery({
    queryKey: ['tickets', 'desk', params],
    queryFn: () => api.get<TicketListPayload>(`/support/tickets${qs(params)}`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const tabs: StatusFilter[] = [...TICKET_STATUSES, 'ALL'];

  return (
    <Page width="wide">
      <PageHeader
        title="Support tickets"
        description="Passenger complaints, questions and feedback. Reply, update the status, or escalate to an administrator."
      />

      {data?.escalatedOpen ? (
        <button
          type="button"
          onClick={() => {
            setEscalated('true');
            setStatus('ALL');
            setPage(1);
          }}
          className="mb-4 flex w-full items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-900 hover:bg-red-100"
        >
          <ShieldAlert className="size-4 text-red-600" aria-hidden />
          {data.escalatedOpen} escalated ticket{data.escalatedOpen === 1 ? '' : 's'} waiting for an administrator
        </button>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Ticket status" className="inline-flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
          {tabs.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium',
                status === s ? 'bg-brand-50 text-brand-800' : 'text-ink-muted hover:text-ink',
              )}
            >
              {s === 'ALL' ? 'All' : TICKET_STATUS_LABELS[s]}
              {s !== 'ALL' && data && <span className="tabular text-xs text-ink-subtle">{data.counts[s]}</span>}
            </button>
          ))}
        </div>
        <Select
          className="h-10 w-auto"
          value={escalated}
          onChange={(e) => {
            setEscalated(e.target.value);
            setPage(1);
          }}
          aria-label="Escalation"
        >
          <option value="">All tickets</option>
          <option value="true">Escalated only</option>
          <option value="false">Not escalated</option>
        </Select>
        <Select
          className="h-10 w-auto"
          value={assigned}
          onChange={(e) => {
            setAssigned(e.target.value);
            setPage(1);
          }}
          aria-label="Assignment"
        >
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </Select>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Subject, passenger or #id"
            className="pl-9"
            aria-label="Search tickets"
          />
        </div>
      </div>

      <Panel className={cn(query.isFetching && !query.isLoading && 'opacity-80 transition-opacity')}>
        {query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Callout tone="error" title="Could not load tickets">
              {errorMessage(query.error)}
            </Callout>
          </div>
        ) : data!.tickets.length === 0 ? (
          <EmptyState icon={Inbox} title="No tickets here">
            Nothing matches these filters. Try another status or clear the search.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-16">#</Th>
                <Th>Request</Th>
                <Th className="hidden md:table-cell">Category</Th>
                <Th className="hidden lg:table-cell">Assigned</Th>
                <Th className="hidden sm:table-cell">Updated</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {data!.tickets.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer hover:bg-canvas"
                  onClick={() => navigate(`/desk/tickets/${t.id}`)}
                >
                  <Td className="tabular text-ink-subtle">{t.id}</Td>
                  <Td>
                    <Link to={`/desk/tickets/${t.id}`} className="font-medium text-ink hover:underline" onClick={(e) => e.stopPropagation()}>
                      {t.subject}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                      <span>{t.passenger.name}</span>
                      {t.route && <RouteBadge number={t.route.number} size="sm" className="h-5 min-w-7 text-[11px]" />}
                      {t.escalated && (
                        <Badge tone="danger">
                          <ShieldAlert aria-hidden /> Escalated
                        </Badge>
                      )}
                      <TicketPriorityBadge priority={t.priority} />
                    </div>
                  </Td>
                  <Td className="hidden text-ink-muted md:table-cell">{TICKET_CATEGORY_LABELS[t.category]}</Td>
                  <Td className="hidden text-ink-muted lg:table-cell">{t.assignedTo?.name ?? '—'}</Td>
                  <Td className="hidden whitespace-nowrap text-ink-muted sm:table-cell">{timeAgo(t.updatedAt)}</Td>
                  <Td>
                    <TicketStatusBadge status={t.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-ink-muted">
              Page {page} of {pages} · {data.total} tickets
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </Page>
  );
}
