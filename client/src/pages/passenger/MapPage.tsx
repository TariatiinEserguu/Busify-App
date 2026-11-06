import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, MapPin, X } from 'lucide-react';
import { RouteBadge } from '@/components/domain';
import { BusMap } from '@/components/map/BusMap';
import { Chip } from '@/components/ui/controls';
import { useCurrentPosition, useLocationPermission } from '@/features/journey/useGeolocation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { RouteDetail, RouteSummary, Stop } from '@/lib/types';

/** "Газрын зураг": every stop on a clean map; pick a route to see its line, tap a stop to plan. */
export function MapPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const permission = useLocationPermission();
  const here = useCurrentPosition(permission === 'granted');
  const [routeId, setRouteId] = useState<number | null>(null);
  const [stop, setStop] = useState<Stop | null>(null);

  const routes = useQuery({ queryKey: ['routes', 'list', ''], queryFn: () => api.get<{ routes: RouteSummary[] }>('/routes') });
  const stops = useQuery({ queryKey: ['stops', 'list'], queryFn: () => api.get<{ stops: Stop[] }>('/stops'), staleTime: 60_000 });
  const route = useQuery({
    queryKey: ['routes', 'detail', routeId],
    queryFn: async () => (await api.get<{ route: RouteDetail }>(`/routes/${routeId}`)).route,
    enabled: routeId != null,
  });
  const allStops = useMemo(() => (stops.data?.stops ?? []).filter((s) => s.routes.length > 0), [stops.data]);
  const onRoute = route.data?.stops ?? [];
  const other = routeId ? allStops.filter((s) => !onRoute.some((r) => r.id === s.id)) : allStops;

  return (
    <div className="relative flex min-h-[calc(100dvh-7rem)] flex-1 flex-col lg:min-h-0">
      <BusMap
        className="absolute inset-0 h-full w-full"
        stops={onRoute}
        routeColor={route.data?.color ?? '#10162c'}
        otherStops={other}
        destinationId={stop?.id ?? null}
        user={here.position ? { ...here.position, simulated: false } : null}
        fitKey={`map-${routeId ?? 'all'}-${route.data ? 1 : 0}-${allStops.length}`}
        controlsClassName="top-20"
        onStopClick={(id) => setStop(allStops.find((s) => s.id === id) ?? null)}
        overlay={
          <div className="scrollbar-none absolute inset-x-0 top-0 z-[500] flex gap-2 overflow-x-auto px-3 pt-4">
            <Chip active={routeId == null} onClick={() => setRouteId(null)} className="shadow-float">
              {t('All stops')}
            </Chip>
            {(routes.data?.routes ?? []).map((r) => (
              <Chip key={r.id} active={r.id === routeId} onClick={() => setRouteId(r.id)} className="shadow-float">
                {r.number}
              </Chip>
            ))}
          </div>
        }
      />
      {stop && (
        <div className="absolute inset-x-3 bottom-4 z-[700] mx-auto max-w-md rounded-[24px] bg-surface p-4 shadow-float animate-sheet-up lg:bottom-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-400 text-brand-900">
              <MapPin className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold leading-tight">{stop.name}</p>
              <p className="text-xs text-ink-subtle">{t('Routes that stop here:')}</p>
            </div>
            <button type="button" onClick={() => setStop(null)} className="rounded-lg p-1.5 text-ink-subtle hover:bg-sunken" aria-label={t('Close')}>
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {stop.routes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => navigate(`/plan?route=${r.id}&stop=${stop.id}&step=distance`)}
                className="lift flex w-full items-center gap-3 rounded-2xl bg-sunken px-3 py-2.5 text-left"
              >
                <RouteBadge number={r.number} color={r.color} size="sm" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="flex items-center gap-1 text-xs font-bold text-ink">
                  {t('Get off here')} <ArrowRight className="size-3.5" aria-hidden />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
