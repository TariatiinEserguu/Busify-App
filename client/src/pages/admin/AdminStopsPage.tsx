import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { DemoBadge, RouteBadge } from '@/components/domain';
import { Page } from '@/components/layout/AppShell';
import { BusMap } from '@/components/map/BusMap';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { PageHeader, Panel } from '@/components/ui/layout';
import { api, errorMessage } from '@/lib/api';
import type { Stop } from '@/lib/types';
import { cn } from '@/lib/utils';
import { StopFormDialog } from './StopFormDialog';

export default function AdminStopsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Stop | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ['stops', 'list'],
    queryFn: async () => (await api.get<{ stops: Stop[] }>('/stops')).stops,
  });

  const stops = useMemo(() => {
    const t = search.trim().toLocaleLowerCase();
    const all = query.data ?? [];
    return t ? all.filter((s) => s.name.toLocaleLowerCase().includes(t) || s.code?.toLocaleLowerCase().includes(t)) : all;
  }, [query.data, search]);

  function openEditor(stop: Stop | null) {
    setEditing(stop);
    setDialogOpen(true);
  }

  async function remove(stop: Stop) {
    try {
      await api.delete(`/stops/${stop.id}`);
      await queryClient.invalidateQueries({ queryKey: ['stops'] });
      await queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success(`Deleted ${stop.name}`);
    } catch (err) {
      toast.error('Could not delete the stop', { description: errorMessage(err) });
    }
  }

  return (
    <Page width="wide">
      <PageHeader
        title="Stops"
        description="Every bus stop with its exact coordinates. Alerts are measured against these positions, so keep them accurate."
        actions={
          <Button onClick={() => openEditor(null)}>
            <Plus aria-hidden /> New stop
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stops by name or code" className="pl-9" aria-label="Search stops" />
          </div>
          <Panel>
            {query.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : query.isError ? (
              <div className="p-4">
                <Callout tone="error">{errorMessage(query.error)}</Callout>
              </div>
            ) : stops.length === 0 ? (
              <EmptyState icon={MapPin} title={search ? 'No stops match' : 'No stops yet'} action={!search && <Button variant="outline" onClick={() => openEditor(null)}>Add the first stop</Button>}>
                {search ? 'Try another name or code.' : 'Add stops with their real coordinates, then attach them to routes.'}
              </EmptyState>
            ) : (
              <ul className="max-h-[640px] divide-y divide-line overflow-y-auto">
                {stops.map((s) => (
                  <li
                    key={s.id}
                    className={cn('flex items-center gap-3 px-4 py-3', highlight === s.id && 'bg-brand-50/60')}
                    onMouseEnter={() => setHighlight(s.id)}
                    onMouseLeave={() => setHighlight(null)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {s.name}
                        {s.code && <span className="font-mono text-xs font-normal text-ink-subtle">{s.code}</span>}
                        {s.isDemo && <DemoBadge />}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-ink-subtle">
                        {s.latitude.toFixed(6)}, {s.longitude.toFixed(6)}
                      </p>
                      {s.routes.length > 0 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {s.routes.map((r) => (
                            <RouteBadge key={r.id} number={r.number} color={r.color} size="sm" className={cn(r.status !== 'ACTIVE' && 'opacity-50')} />
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-amber-700">Not on any route</p>
                      )}
                    </div>
                    <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.name}`} onClick={() => openEditor(s)}>
                      <Pencil />
                    </Button>
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${s.name}`}>
                          <Trash2 />
                        </Button>
                      }
                      title={`Delete ${s.name}?`}
                      description={
                        s.routes.length
                          ? `It will be removed from ${s.routes.length} route(s) (${s.routes.map((r) => r.number).join(', ')}) and the remaining stops renumbered. Past journeys keep their history.`
                          : 'This stop is not used by any route. Past journeys keep their history.'
                      }
                      confirmLabel="Delete stop"
                      destructive
                      onConfirm={() => remove(s)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel className="h-[420px] overflow-hidden xl:sticky xl:top-6 xl:h-[640px]">
          <BusMap
            className="h-full"
            otherStops={stops}
            destinationId={highlight}
            onStopClick={(id) => {
              const s = stops.find((x) => x.id === id);
              if (s) openEditor(s);
            }}
            fitKey={`stops-${query.data?.length ?? 0}-${search}`}
            ariaLabel="Map of all stops"
          />
        </Panel>
      </div>

      <StopFormDialog open={dialogOpen} onOpenChange={setDialogOpen} stop={editing} contextStops={query.data ?? []} />
    </Page>
  );
}
