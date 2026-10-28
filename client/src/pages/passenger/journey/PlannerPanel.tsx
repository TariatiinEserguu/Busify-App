import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BusFront, Clock, LocateFixed, MapPin, Search, SearchX } from 'lucide-react';
import { formatDistance } from '@busify/shared';
import { DemoBadge, RouteBadge, scheduleText } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input } from '@/components/ui/input';
import { api, qs } from '@/lib/api';
import type { RouteDetail, RouteSummary, Stop } from '@/lib/types';
import { cn } from '@/lib/utils';
import { RadiusControl } from './RadiusControl';
import { StopLine } from './StopLine';

export interface CurrentLocation {
  position: { lat: number; lng: number; accuracyM: number | null } | null;
  state: string;
  message: string | null;
  request: () => void;
}

interface PlannerPanelProps {
  location: CurrentLocation;
  routeId: number | null;
  onRouteChange: (id: number | null) => void;
  destinationId: number | null;
  onDestinationChange: (id: number | null) => void;
  /** A stop picked on the map before choosing a route. */
  focusStop: Stop | null;
  onFocusStop: (stop: Stop | null) => void;
  route: RouteDetail | undefined;
  routeLoading: boolean;
  radius: number;
  onRadiusChange: (r: number) => void;
  radiusBounds: { min: number; max: number };
  onStart: () => void;
  starting: boolean;
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function PlannerPanel(props: PlannerPanelProps) {
  const { location, routeId, route, focusStop } = props;
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim(), 250);

  const routesQuery = useQuery({
    queryKey: ['routes', 'list', term],
    queryFn: () => api.get<{ routes: RouteSummary[] }>(`/routes${qs({ search: term })}`),
  });
  const stopsQuery = useQuery({
    queryKey: ['stops', 'list'],
    queryFn: () => api.get<{ stops: Stop[] }>('/stops'),
    staleTime: 60_000,
  });
  const nearbyQuery = useQuery({
    queryKey: ['stops', 'nearby', location.position?.lat.toFixed(4), location.position?.lng.toFixed(4)],
    queryFn: () =>
      api.get<{ stops: Stop[] }>(
        `/stops/nearby${qs({ lat: location.position!.lat, lng: location.position!.lng, radiusM: 1500, limit: 5 })}`,
      ),
    enabled: !!location.position,
  });

  const matchingStops = useMemo(() => {
    if (!term) return [];
    const t = term.toLocaleLowerCase();
    return (stopsQuery.data?.stops ?? []).filter((s) => s.routes.length > 0 && s.name.toLocaleLowerCase().includes(t)).slice(0, 6);
  }, [term, stopsQuery.data]);

  // ---- A route is selected: choose the destination stop ------------------
  if (routeId) {
    const destination = route?.stops.find((s) => s.id === props.destinationId) ?? null;
    return (
      <div className="flex min-h-full flex-col">
        <div className="border-b border-line px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => {
              props.onRouteChange(null);
              props.onDestinationChange(null);
            }}
            className="-ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden /> All routes
          </button>
          {route ? (
            <div className="mt-2 flex items-start gap-3">
              <RouteBadge number={route.number} color={route.color} size="lg" />
              <div className="min-w-0">
                <h2 className="font-semibold leading-tight text-ink">{route.name}</h2>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {route.firstStopName} → {route.lastStopName}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                  {scheduleText(route) && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden /> {scheduleText(route)}
                    </span>
                  )}
                  {route.isDemo && <DemoBadge />}
                </div>
              </div>
            </div>
          ) : (
            <Skeleton className="mt-2 h-11 w-2/3" />
          )}
        </div>

        <div className="flex-1 px-4 py-4 sm:px-5">
          <p className="mb-3 text-sm text-ink-muted">Choose the stop where you want to get off — here or on the map.</p>
          {props.routeLoading || !route ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : route.stops.length === 0 ? (
            <EmptyState icon={MapPin} title="This route has no stops yet" />
          ) : (
            <StopLine
              stops={route.stops}
              color={route.color}
              destinationId={props.destinationId}
              onSelect={(s) => props.onDestinationChange(s.id)}
            />
          )}
        </div>

        <div className="sticky bottom-0 space-y-4 border-t border-line bg-surface px-4 py-4 sm:px-5">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="size-4 text-amber-600" aria-hidden />
            {destination ? (
              <span>
                Get off at <strong className="font-semibold">{destination.name}</strong>
              </span>
            ) : (
              <span className="text-ink-muted">No destination selected yet</span>
            )}
          </div>
          <RadiusControl value={props.radius} onChange={props.onRadiusChange} min={props.radiusBounds.min} max={props.radiusBounds.max} />
          <Button size="lg" className="w-full" disabled={!destination} loading={props.starting} onClick={props.onStart}>
            Start journey
          </Button>
        </div>
      </div>
    );
  }

  // ---- No route yet: search, nearby stops and the route list -------------
  return (
    <div className="px-4 py-5 sm:px-5">
      <h1 className="text-lg font-semibold tracking-tight">Where are you going?</h1>
      <p className="mt-0.5 text-sm text-ink-muted">Find your bus by route number, route name or stop.</p>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="e.g. D1, Campus Shuttle, Central Plaza"
          className="h-11 pl-9"
          aria-label="Search routes and stops"
        />
      </div>

      <LocationLine location={location} />

      {focusStop && (
        <section className="mt-5 rounded-lg border border-line bg-canvas/60 p-3" aria-live="polite">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs text-ink-subtle">Selected on the map</p>
              <p className="font-medium">{focusStop.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => props.onFocusStop(null)}>
              Clear
            </Button>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Routes that stop here:</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {focusStop.routes.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  props.onRouteChange(r.id);
                  props.onDestinationChange(focusStop.id);
                  props.onFocusStop(null);
                }}
                className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm hover:border-brand-300"
              >
                <RouteBadge number={r.number} color={r.color} size="sm" />
                <span className="max-w-40 truncate">{r.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {matchingStops.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Stops</h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {matchingStops.map((s) => (
              <li key={s.id}>
                <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-canvas" onClick={() => props.onFocusStop(s)}>
                  <MapPin className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                  <span className="flex gap-1">
                    {s.routes.slice(0, 4).map((r) => (
                      <RouteBadge key={r.id} number={r.number} color={r.color} size="sm" />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!term && location.position && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Stops near you</h2>
          {nearbyQuery.isLoading ? (
            <Skeleton className="h-24" />
          ) : (nearbyQuery.data?.stops ?? []).filter((s) => s.routes.length > 0).length === 0 ? (
            <p className="rounded-lg border border-dashed border-line px-3 py-4 text-sm text-ink-muted">
              No stops within 1.5 km. Search for a route instead.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {(nearbyQuery.data?.stops ?? [])
                .filter((s) => s.routes.length > 0)
                .map((s) => (
                  <li key={s.id}>
                    <button type="button" className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-canvas" onClick={() => props.onFocusStop(s)}>
                      <span className="tabular w-14 shrink-0 text-xs font-medium text-ink-muted">{formatDistance(s.distanceM)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                      <span className="flex gap-1">
                        {s.routes.slice(0, 3).map((r) => (
                          <RouteBadge key={r.id} number={r.number} color={r.color} size="sm" />
                        ))}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">{term ? 'Matching routes' : 'Routes in service'}</h2>
        {routesQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[72px]" />
            ))}
          </div>
        ) : routesQuery.isError ? (
          <Callout tone="error" title="Routes could not be loaded" action={<Button size="sm" variant="outline" onClick={() => routesQuery.refetch()}>Try again</Button>}>
            Check your connection to the BUSIFY server.
          </Callout>
        ) : (routesQuery.data?.routes ?? []).length === 0 ? (
          <EmptyState icon={term ? SearchX : BusFront} title={term ? 'No routes match your search' : 'No routes yet'} className="rounded-lg border border-dashed border-line">
            {term ? 'Try a route number like "D1" or part of a stop name.' : 'An administrator needs to add routes and stops first.'}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {routesQuery.data!.routes.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => props.onRouteChange(r.id)}
                  className="group flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <RouteBadge number={r.number} color={r.color} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{r.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                      {r.firstStopName ? `${r.firstStopName} → ${r.lastStopName}` : 'No stops yet'}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <span>{r.stopCount} stops</span>
                      {scheduleText(r) && <span>· {scheduleText(r)}</span>}
                      {r.isDemo && <DemoBadge />}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function LocationLine({ location }: { location: CurrentLocation }) {
  const { state, position, message } = location;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-medium',
          state === 'ok' ? 'text-emerald-700' : state === 'denied' || state === 'insecure' || state === 'unsupported' ? 'text-amber-700' : 'text-ink-muted',
        )}
      >
        <LocateFixed className="size-3.5" aria-hidden />
        {state === 'ok' && position
          ? `Location found${position.accuracyM ? ` · ±${Math.round(position.accuracyM)} m` : ''}`
          : state === 'locating'
            ? 'Finding your location…'
            : state === 'denied'
              ? 'Location blocked'
              : state === 'insecure'
                ? 'Location needs HTTPS'
                : state === 'unsupported'
                  ? 'Location not supported'
                  : 'Location not used yet'}
      </span>
      {state !== 'locating' && state !== 'unsupported' && state !== 'insecure' && (
        <button type="button" onClick={location.request} className="font-medium text-brand-700 hover:underline">
          {state === 'ok' ? 'Refresh' : 'Use my location'}
        </button>
      )}
      {message && state !== 'ok' && <p className="w-full text-ink-subtle">{message}</p>}
    </div>
  );
}
