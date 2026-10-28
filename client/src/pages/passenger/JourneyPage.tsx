import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { BusMap, type MapUser } from '@/components/map/BusMap';
import { Button } from '@/components/ui/button';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { usePublicConfig, useUserSettings } from '@/features/appData';
import { useJourney } from '@/features/journey/JourneyProvider';
import { useCurrentPosition, useLocationPermission } from '@/features/journey/useGeolocation';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { RouteDetail, Stop } from '@/lib/types';
import { ActiveJourneyPanel } from './journey/ActiveJourneyPanel';
import { PlannerPanel } from './journey/PlannerPanel';
import { ConfirmReplaceDialog } from './journey/ConfirmReplaceDialog';

/** Passenger dashboard: plan a journey, then follow it on the map until the stop alert. */
export function JourneyPage() {
  const j = useJourney();
  const { config } = usePublicConfig();
  const { settings } = useUserSettings();
  const permission = useLocationPermission();
  const location = useCurrentPosition(permission === 'granted' && !j.journey);

  const [routeId, setRouteId] = useState<number | null>(null);
  const [destinationId, setDestinationId] = useState<number | null>(null);
  const [focusStop, setFocusStop] = useState<Stop | null>(null);
  const [radius, setRadius] = useState(settings.alertRadiusM);
  const [replaceConflict, setReplaceConflict] = useState<string | null>(null);
  useEffect(() => setRadius(settings.alertRadiusM), [settings.alertRadiusM]);

  // Each view (route list, stop list, live journey) starts at the top.
  const panelRef = useRef<HTMLDivElement>(null);
  const tracking = !!j.journey;
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
    if (window.innerWidth < 1024) window.scrollTo({ top: 0 });
  }, [tracking, routeId]);

  const routeQuery = useQuery({
    queryKey: ['routes', 'detail', routeId],
    queryFn: async () => (await api.get<{ route: RouteDetail }>(`/routes/${routeId}`)).route,
    enabled: routeId != null && !j.journey,
  });
  const stopsQuery = useQuery({
    queryKey: ['stops', 'list'],
    queryFn: () => api.get<{ stops: Stop[] }>('/stops'),
    enabled: !j.journey && routeId == null,
    staleTime: 60_000,
  });

  async function start(replaceActive = false) {
    if (!routeId || !destinationId) return;
    try {
      const ok = await j.start({ routeId, destinationStopId: destinationId, alertRadiusM: radius, replaceActive });
      if (ok) {
        setRouteId(null);
        setDestinationId(null);
      }
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACTIVE_JOURNEY_EXISTS') setReplaceConflict(errorMessage(err));
    }
  }

  // ---- What the map shows ------------------------------------------------------
  const user: MapUser | null = useMemo(() => {
    if (tracking && j.live.reading) {
      return { lat: j.live.reading.lat, lng: j.live.reading.lng, accuracyM: j.live.reading.accuracyM, simulated: j.live.reading.simulated };
    }
    if (!tracking && location.position) return { ...location.position, simulated: false };
    return null;
  }, [tracking, j.live.reading, location.position]);

  const mapStops = tracking ? (j.route?.stops ?? []) : (routeQuery.data?.stops ?? []);
  const mapColor = tracking ? j.journey!.routeColor : (routeQuery.data?.color ?? '#1d41d8');
  const otherStops = !tracking && routeId == null ? (stopsQuery.data?.stops ?? []).filter((s) => s.routes.length > 0) : [];
  const simulationClicks = tracking && j.source === 'simulation' && j.journey!.status === 'ACTIVE';

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      <div className="relative h-[46vh] min-h-72 shrink-0 lg:order-2 lg:h-auto lg:flex-1">
        <BusMap
          className="h-full w-full"
          stops={mapStops}
          routeColor={mapColor}
          otherStops={otherStops}
          destinationId={tracking ? j.journey!.destinationStopId : destinationId}
          destinationPoint={
            tracking && !j.route
              ? { lat: j.journey!.destinationLat, lng: j.journey!.destinationLng, name: j.journey!.destinationName }
              : null
          }
          alertRadiusM={tracking ? j.journey!.alertRadiusM : destinationId ? radius : null}
          user={user}
          followUser={tracking}
          fitKey={tracking ? `journey-${j.journey!.id}-${!!j.route}` : `plan-${routeId ?? 'all'}-${routeQuery.data ? 1 : 0}-${otherStops.length}`}
          onStopClick={
            tracking
              ? undefined
              : (id) => {
                  if (routeId) {
                    if (routeQuery.data?.stops.some((s) => s.id === id)) setDestinationId(id);
                  } else {
                    setFocusStop(otherStops.find((s) => s.id === id) ?? null);
                  }
                }
          }
          onMapClick={simulationClicks ? j.simulation.placeAt : undefined}
          overlay={
            simulationClicks ? (
              <div className="pointer-events-none absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 rounded-md bg-violet-700 px-2 py-1 text-xs font-medium text-white shadow">
                <FlaskConical className="size-3.5" aria-hidden /> Simulator · click the map to move
              </div>
            ) : null
          }
        />
      </div>

      <div ref={panelRef} className="min-h-0 w-full border-line bg-surface lg:order-1 lg:w-[420px] lg:shrink-0 lg:overflow-y-auto lg:border-r xl:w-[440px]">
        {j.isLoading ? (
          <div className="space-y-3 p-5">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-11" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : j.loadError ? (
          <div className="p-5">
            <Callout tone="error" title="Could not load your journey">
              {errorMessage(j.loadError)}
            </Callout>
            <Button className="mt-3" variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        ) : tracking ? (
          <ActiveJourneyPanel />
        ) : (
          <PlannerPanel
            location={location}
            routeId={routeId}
            onRouteChange={setRouteId}
            destinationId={destinationId}
            onDestinationChange={setDestinationId}
            focusStop={focusStop}
            onFocusStop={setFocusStop}
            route={routeQuery.data}
            routeLoading={routeQuery.isLoading}
            radius={radius}
            onRadiusChange={setRadius}
            radiusBounds={{ min: config.alert.minRadiusM, max: config.alert.maxRadiusM }}
            onStart={() => start(false)}
            starting={j.busy}
          />
        )}
      </div>

      <ConfirmReplaceDialog
        message={replaceConflict}
        onCancel={() => setReplaceConflict(null)}
        onConfirm={async () => {
          setReplaceConflict(null);
          await start(true);
        }}
      />
    </div>
  );
}
