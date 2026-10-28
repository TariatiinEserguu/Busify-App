import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Route as RouteIcon, Search, Trash2 } from 'lucide-react';
import { ROUTE_STATUS_LABELS, ROUTE_STATUSES, type RouteStatus } from '@busify/shared';
import { DemoBadge, RouteBadge, RouteStatusBadge, scheduleText } from '@/components/domain';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Panel, Table, Td, Th } from '@/components/ui/layout';
import { api, errorMessage, qs } from '@/lib/api';
import type { RouteSummary } from '@/lib/types';
import { timeAgo } from '@/lib/utils';

export default function AdminRoutesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RouteStatus | ''>('');
  const query = useQuery({
    queryKey: ['routes', 'admin', search.trim()],
    queryFn: () => api.get<{ routes: RouteSummary[] }>(`/routes${qs({ includeInactive: true, search: search.trim() })}`),
  });
  const routes = (query.data?.routes ?? []).filter((r) => !status || r.status === status);

  async function remove(route: RouteSummary) {
    try {
      await api.delete(`/routes/${route.id}`);
      await queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success(`Route ${route.number} deleted`);
    } catch (err) {
      toast.error('Could not delete the route', { description: errorMessage(err) });
    }
  }

  return (
    <Page width="wide">
      <PageHeader
        title="Routes"
        description="Bus routes, their schedules and the order of their stops. Suspended and draft routes are hidden from passengers."
        actions={
          <Button asChild>
            <Link to="/admin/routes/new">
              <Plus aria-hidden /> New route
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Number, name or stop" className="pl-9" aria-label="Search routes" />
        </div>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as RouteStatus | '')} aria-label="Status">
          <option value="">All statuses</option>
          {ROUTE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ROUTE_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
      </div>

      <Panel>
        {query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Callout tone="error">{errorMessage(query.error)}</Callout>
          </div>
        ) : routes.length === 0 ? (
          <EmptyState icon={RouteIcon} title={search || status ? 'No routes match' : 'No routes yet'} action={<Button asChild variant="outline"><Link to="/admin/routes/new">Create the first route</Link></Button>}>
            Routes connect stops in order. Create the stops first, or add them while editing a route.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-20">Route</Th>
                <Th>Name</Th>
                <Th className="hidden md:table-cell">Stops</Th>
                <Th className="hidden lg:table-cell">Schedule</Th>
                <Th>Status</Th>
                <Th className="hidden sm:table-cell">Updated</Th>
                <Th className="w-12">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {routes.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-canvas" onClick={() => navigate(`/admin/routes/${r.id}`)}>
                  <Td>
                    <RouteBadge number={r.number} color={r.color} size="sm" />
                  </Td>
                  <Td>
                    <Link to={`/admin/routes/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                      {r.firstStopName ? `${r.firstStopName} → ${r.lastStopName}` : 'No stops yet'}
                      {r.isDemo && <DemoBadge />}
                    </div>
                  </Td>
                  <Td className="tabular hidden md:table-cell">{r.stopCount}</Td>
                  <Td className="hidden text-ink-muted lg:table-cell">{scheduleText(r) || '—'}</Td>
                  <Td>
                    <RouteStatusBadge status={r.status} />
                  </Td>
                  <Td className="hidden whitespace-nowrap text-ink-muted sm:table-cell">{timeAgo(r.updatedAt)}</Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete route ${r.number}`}>
                          <Trash2 />
                        </Button>
                      }
                      title={`Delete route ${r.number}?`}
                      description="Passengers will no longer see it. Any journey currently tracking on this route is ended. Past journeys keep their history. To hide it temporarily, set the status to Suspended instead."
                      confirmLabel="Delete route"
                      destructive
                      onConfirm={() => remove(r)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </Page>
  );
}
