import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Check,
  FlaskConical,
  Info,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Satellite,
  ShieldAlert,
  X,
} from 'lucide-react';
import { formatDistance, haversineDistanceM, rearmDistanceM } from '@busify/shared';
import { JourneyStatusBadge, RouteBadge } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls';
import { Callout } from '@/components/ui/feedback';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/menu';
import { usePublicConfig } from '@/features/appData';
import { useJourney } from '@/features/journey/JourneyProvider';
import { cn, formatDuration, formatTime } from '@/lib/utils';
import { RadiusControl } from './RadiusControl';
import { SimulatorPanel } from './SimulatorPanel';
import { StopLine } from './StopLine';

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function ActiveJourneyPanel() {
  const j = useJourney();
  const { config } = usePublicConfig();
  const journey = j.journey!;
  const now = useNow(1000);
  const paused = journey.status === 'PAUSED';
  const alerted = j.alertState.triggered || !!journey.alertTriggeredAt;
  const distance = j.live.distanceM ?? journey.lastDistanceM;
  const inside = distance != null && distance <= journey.alertRadiusM;
  const [radiusDraft, setRadiusDraft] = useState(journey.alertRadiusM);
  useEffect(() => setRadiusDraft(journey.alertRadiusM), [journey.alertRadiusM]);

  const destinationIndex = j.route ? j.route.stops.findIndex((s) => s.id === journey.destinationStopId) : -1;
  const reading = j.live.reading;
  const nearStopId = useMemo(() => {
    if (!reading || !j.route) return null;
    let best: { id: number; d: number } | null = null;
    for (const s of j.route.stops) {
      const d = haversineDistanceM(reading, { lat: s.latitude, lng: s.longitude });
      if (!best || d < best.d) best = { id: s.id, d };
    }
    return best && best.d < 150 ? best.id : null;
  }, [reading, j.route]);

  const lastFixAge = reading ? Math.max(0, Math.round((now - reading.timestamp) / 1000)) : null;

  return (
    <div className="divide-y divide-line">
      {/* Headline: where to, how far */}
      <section className={cn('px-4 py-5 sm:px-5', alerted && 'bg-amber-50')} aria-live="polite">
        <div className="flex items-center gap-2">
          <RouteBadge number={journey.routeNumber} color={journey.routeColor} size="sm" />
          <span className="min-w-0 truncate text-sm text-ink-muted">{journey.routeName}</span>
          <span className="ml-auto">
            <JourneyStatusBadge status={journey.status} alerted={alerted} />
          </span>
        </div>
        <p className="mt-3 text-sm text-ink-muted">Your stop</p>
        <h1 className="text-xl font-semibold leading-tight tracking-tight">{journey.destinationName}</h1>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="tabular text-4xl font-semibold tracking-tight text-ink">{distance != null ? formatDistance(distance) : '—'}</p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {distance == null
                ? paused
                  ? 'Tracking is paused'
                  : 'Waiting for the first position…'
                : inside
                  ? 'Inside your alert distance'
                  : 'straight-line distance to your stop'}
            </p>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm hover:bg-canvas" aria-label="Change alert distance">
                <BellRing className="size-4 text-amber-600" aria-hidden />
                <span className="tabular">{journey.alertRadiusM} m</span>
                <Pencil className="size-3 text-ink-subtle" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-4">
              <RadiusControl value={radiusDraft} onChange={setRadiusDraft} min={config.alert.minRadiusM} max={config.alert.maxRadiusM} />
              <Button className="mt-4 w-full" size="sm" loading={j.busy} disabled={radiusDraft === journey.alertRadiusM} onClick={() => j.updateRadius(radiusDraft)}>
                Save alert distance
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        <div className="mt-4 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm">
          {alerted ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="flex items-center gap-2 font-medium text-amber-800">
                <BellRing className="size-4" aria-hidden />
                Alert sent{journey.alertTriggeredAt ? ` at ${formatTime(journey.alertTriggeredAt)}` : ''}
                {journey.alertDistanceM != null ? ` (${formatDistance(journey.alertDistanceM)})` : ''}
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={j.resetAlert} disabled={j.busy}>
                <RefreshCw aria-hidden /> Re-arm alert
              </Button>
            </div>
          ) : !j.alertState.armed ? (
            <span className="flex items-center gap-2 text-ink-muted">
              <Info className="size-4 shrink-0" aria-hidden />
              Re-armed: the alert sounds again after you move beyond {formatDistance(rearmDistanceM(journey.alertRadiusM))} and come back.
            </span>
          ) : (
            <span className="flex items-center gap-2 text-ink-muted">
              <BellRing className="size-4 shrink-0 text-brand-700" aria-hidden />
              {paused ? 'Alert is on hold while paused.' : `Alert armed — it rings once you are within ${journey.alertRadiusM} m.`}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {paused ? (
            <Button variant="secondary" onClick={j.resume} loading={j.busy}>
              <Play aria-hidden /> Resume
            </Button>
          ) : (
            <Button variant="outline" onClick={j.pause} disabled={j.busy}>
              <Pause aria-hidden /> Pause
            </Button>
          )}
          <Button variant="primary" onClick={j.complete} disabled={j.busy}>
            <Check aria-hidden /> Arrived
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="danger-outline" disabled={j.busy}>
                <X aria-hidden /> Cancel
              </Button>
            }
            title="Cancel this journey?"
            description={`Tracking stops and you will not be alerted at ${journey.destinationName}.`}
            confirmLabel="Cancel journey"
            cancelLabel="Keep tracking"
            destructive
            onConfirm={j.cancel}
          />
        </div>
        <p className="mt-3 text-xs text-ink-subtle">
          Started {formatTime(journey.startedAt)} · {formatDuration(journey.startedAt, null)} ago
        </p>
      </section>

      {/* Position source */}
      <section className="px-4 py-5 sm:px-5">
        <Tabs value={j.source} onValueChange={(v) => j.setSource(v as 'gps' | 'simulation')}>
          <TabsList className="w-full" aria-label="Position source">
            <TabsTrigger value="gps" className="flex-1">
              <Satellite aria-hidden /> Device GPS
            </TabsTrigger>
            <TabsTrigger value="simulation" className="flex-1">
              <FlaskConical aria-hidden /> Simulator
            </TabsTrigger>
          </TabsList>

          <TabsContent value="gps" className="mt-4 space-y-3">
            <GpsStatusBlock lastFixAge={lastFixAge} paused={paused} />
          </TabsContent>
          <TabsContent value="simulation" className="mt-4">
            {paused && (
              <Callout tone="info" className="mb-4">
                Resume the journey to drive the simulated bus.
              </Callout>
            )}
            <SimulatorPanel
              simulation={j.simulation}
              stops={j.route?.stops ?? []}
              destinationIndex={destinationIndex}
              disabled={paused || j.busy}
            />
          </TabsContent>
        </Tabs>
      </section>

      {j.route && j.route.stops.length > 0 && (
        <section className="px-4 py-5 sm:px-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">Route {j.route.number} stops</h2>
          <StopLine stops={j.route.stops} color={j.route.color} destinationId={journey.destinationStopId} nearStopId={nearStopId} />
        </section>
      )}

      <section className="px-4 py-5 text-xs leading-relaxed text-ink-subtle sm:px-5">
        <p className="flex gap-2">
          <ShieldAlert className="size-4 shrink-0" aria-hidden />
          <span>
            Keep BUSIFY open during the ride. Browsers may pause GPS and timers when the screen is locked or the app is in the
            background, and system notifications, sound and vibration depend on the permissions of your browser and device.
            {j.wakeLockActive ? ' The screen is being kept awake.' : ''}
          </span>
        </p>
      </section>
    </div>
  );
}

function GpsStatusBlock({ lastFixAge, paused }: { lastFixAge: number | null; paused: boolean }) {
  const { gps, live, setSource } = useJourney();
  const { config } = usePublicConfig();
  if (paused) return <Callout tone="info">GPS tracking is paused. Resume the journey to continue.</Callout>;

  if (gps.state === 'denied' || gps.state === 'insecure' || gps.state === 'unsupported') {
    return (
      <Callout
        tone="warning"
        title={gps.state === 'denied' ? 'Location permission is blocked' : gps.state === 'insecure' ? 'GPS needs a secure connection' : 'GPS is not available'}
        action={
          <div className="flex flex-wrap gap-2">
            {gps.state === 'denied' && (
              <Button size="sm" variant="outline" onClick={gps.retry}>
                Try again
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setSource('simulation')}>
              Use the simulator
            </Button>
          </div>
        }
      >
        {gps.message} The stop alert cannot be sent without a position.
      </Callout>
    );
  }

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-3 rounded-lg border border-line px-3 py-2.5 text-sm">
        <div>
          <dt className="text-xs text-ink-subtle">Signal</dt>
          <dd className={cn('font-medium', gps.state === 'tracking' ? 'text-emerald-700' : 'text-amber-700')}>
            {gps.state === 'tracking' ? 'Good' : gps.state === 'starting' ? 'Starting' : 'Searching'}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">Accuracy</dt>
          <dd className="tabular font-medium">{gps.accuracyM != null ? `±${Math.round(gps.accuracyM)} m` : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-subtle">Last update</dt>
          <dd className="tabular font-medium">{lastFixAge == null ? '—' : lastFixAge < 3 ? 'now' : `${lastFixAge} s ago`}</dd>
        </div>
      </dl>
      {gps.message && <Callout tone={gps.state === 'searching' ? 'warning' : 'info'}>{gps.message}</Callout>}
      {live.lowAccuracy && (
        <Callout tone="warning">
          Your position is not precise enough right now (worse than ±{config.alert.gpsMaxAccuracyM} m), so it is not used for
          the alert. It improves outdoors or near a window.
        </Callout>
      )}
    </div>
  );
}
