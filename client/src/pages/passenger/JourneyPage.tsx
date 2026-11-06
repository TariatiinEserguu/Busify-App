import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router';
import { Bell, Check, ChevronDown, ChevronLeft, FlaskConical, Pause, Play, RefreshCw, VolumeX } from 'lucide-react';
import { BusMap, type MapUser } from '@/components/map/BusMap';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Slider } from '@/components/ui/controls';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { usePublicConfig, useUserSettings } from '@/features/appData';
import { useJourney } from '@/features/journey/JourneyProvider';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { journeyProgress } from './journey/progress';
import { SimulatorPanel } from './journey/SimulatorPanel';

/** Live journey ("Аялал явж байна"): the map with the route, and a sheet with distance and progress. */
export function JourneyPage() {
  const j = useJourney();
  const { t, formatDistance, meters } = useI18n();
  const { settings } = useUserSettings();
  const [simOpen, setSimOpen] = useState(() => j.source === 'simulation');
  const [radiusOpen, setRadiusOpen] = useState(false);

  const journey = j.journey;
  const reading = j.live.reading;
  const distance = j.live.distanceM ?? journey?.lastDistanceM ?? null;
  const position = reading ? { lat: reading.lat, lng: reading.lng } : null;
  const p = useMemo(
    () => journeyProgress(j.route?.stops ?? [], journey?.destinationStopId ?? null, position, distance),
    [j.route, journey?.destinationStopId, position?.lat, position?.lng, distance],
  );

  if (j.isLoading) return <Skeleton className="m-5 h-[80vh] rounded-card" />;
  if (!journey) return <Navigate to="/" replace />;

  const user: MapUser | null = reading ? { lat: reading.lat, lng: reading.lng, accuracyM: reading.accuracyM, simulated: reading.simulated } : null;
  const paused = journey.status === 'PAUSED';
  const alerted = j.alertState.triggered || !!journey.alertTriggeredAt;
  const gpsOk = j.source === 'simulation' ? !!reading : j.gps.state === 'tracking';
  const simulationClicks = j.source === 'simulation' && !paused;

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col lg:min-h-0 lg:flex-row">
      <div className="relative h-[46dvh] shrink-0 lg:order-2 lg:h-auto lg:flex-1">
        <BusMap
          className="h-full w-full"
          stops={j.route?.stops ?? []}
          routeColor="#10162c"
          destinationId={journey.destinationStopId}
          destinationPoint={!j.route ? { lat: journey.destinationLat, lng: journey.destinationLng, name: journey.destinationName } : null}
          alertRadiusM={journey.alertRadiusM}
          user={user}
          userAsBus
          followUser
          fitKey={`journey-${journey.id}-${!!j.route}`}
          onMapClick={simulationClicks ? j.simulation.placeAt : undefined}
          controlsClassName="top-16 lg:top-3"
          overlay={
            <>
              <div className="absolute left-3 top-3 z-[500] flex items-center gap-2">
                <Link to="/" className="press flex size-10 items-center justify-center rounded-xl bg-surface shadow-float lg:hidden" aria-label={t('Back')}>
                  <ChevronLeft className="size-5" aria-hidden />
                </Link>
                <span className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold shadow-float">
                  <span className={cn('size-2 rounded-full', gpsOk ? 'bg-ok animate-blink' : 'bg-accent-500')} />
                  {j.source === 'simulation' ? t('Simulator') : gpsOk ? t('GPS active') : t('Searching GPS')}
                </span>
              </div>
              {simulationClicks && (
                <div className="pointer-events-none absolute bottom-10 left-3 z-[400] flex items-center gap-1.5 rounded-full bg-violet-700 px-3 py-1 text-xs font-semibold text-white shadow lg:bottom-3">
                  <FlaskConical className="size-3.5" aria-hidden /> {t('Tap the map to move the bus')}
                </div>
              )}
            </>
          }
        />
      </div>

      <section
        aria-live="polite"
        className="relative z-[600] -mt-6 flex-1 rounded-t-[28px] bg-surface px-5 pb-8 pt-3 shadow-[0_-12px_32px_-12px_rgb(16_22_44/0.25)] animate-sheet-up lg:order-1 lg:mt-0 lg:w-[440px] lg:flex-none lg:overflow-y-auto lg:rounded-none lg:pt-8 lg:shadow-none"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line-strong lg:hidden" aria-hidden />

        {!settings.soundEnabled && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-bad-soft px-4 py-3 text-sm animate-slide-up">
            <VolumeX className="size-5 shrink-0 text-bad" aria-hidden />
            <p className="min-w-0 flex-1 text-[#7a1d16]">
              <strong className="font-bold text-bad">{t('Sound alert is off.')}</strong> {t('You may not hear the alert.')}
            </p>
            <Link to="/settings" className="shrink-0 font-bold text-bad hover:underline">
              {t('Fix')}
            </Link>
          </div>
        )}
        {j.source === 'gps' && (j.gps.state === 'denied' || j.gps.state === 'insecure' || j.gps.state === 'unsupported') && (
          <Callout
            tone="warning"
            className="mb-4"
            title={t('Location is not available')}
            action={
              <Button size="sm" variant="outline" onClick={() => { j.setSource('simulation'); setSimOpen(true); }}>
                {t('Use the simulator')}
              </Button>
            }
          >
            {j.gps.message ? t(j.gps.message) : null}
          </Callout>
        )}
        {j.live.lowAccuracy && <Callout tone="warning" className="mb-4">{t('Your position is not precise enough right now, so it is not used for the alert.')}</Callout>}

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink-muted">
              {t('{route} · to {stop}', { route: journey.routeNumber, stop: journey.destinationName })}
            </p>
            <p className="mt-1 flex items-baseline gap-2">
              <span className="text-[44px] font-extrabold leading-none tracking-tight tabular transition-all">{distance != null ? formatDistance(distance).split(' ')[0] : '—'}</span>
              <span className="text-lg font-semibold">{distance != null ? formatDistance(distance).split(' ')[1] : ''}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-ink-muted">{t('Left')}</p>
            <p className="text-2xl font-extrabold tracking-tight">{p.stopsLeft != null ? t('{n} stops', { n: p.stopsLeft }) : paused ? t('Paused') : '—'}</p>
          </div>
        </div>

        <div className="mt-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-sunken">
            <div className="h-full rounded-full bg-brand-900 transition-[width] duration-1000 ease-[var(--ease-out-soft)]" style={{ width: `${p.progress * 100}%` }} />
          </div>
          {p.upcoming.length > 1 && (
            <div className="mt-2 flex justify-between gap-2 text-xs">
              {p.upcoming.map((s, i) => (
                <span key={s.id} className={cn('min-w-0 truncate', i === p.upcoming.length - 1 ? 'font-bold text-ink' : 'text-ink-muted')}>
                  {s.name}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className={cn('mt-5 flex items-center gap-3 rounded-2xl px-4 py-3', alerted ? 'bg-accent-100' : 'bg-sunken')}>
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-400 text-brand-900">
            <Bell className={cn('size-5', alerted && 'animate-bell')} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {alerted ? t('Alert sent') : t('Sound + vibration at {distance}', { distance: meters(journey.alertRadiusM) })}
            </p>
            <p className="text-xs text-ink-muted">
              {paused ? t('Alert is on hold while paused.') : alerted ? t('You can re-arm it if you are not off the bus yet.') : t('Sit back and relax — we will wake you.')}
            </p>
          </div>
          {alerted && (
            <Button size="sm" variant="outline" onClick={j.resetAlert} disabled={j.busy}>
              <RefreshCw aria-hidden /> {t('Re-arm')}
            </Button>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="secondary" size="lg" className="h-14 rounded-2xl text-base" onClick={() => setRadiusOpen(true)}>
            {t('Change distance')}
          </Button>
          <ConfirmDialog
            trigger={
              <Button variant="danger-outline" size="lg" className="h-14 rounded-2xl text-base" disabled={j.busy}>
                {t('Cancel journey')}
              </Button>
            }
            title={t('Cancel this journey?')}
            description={t('Tracking stops and you will not be alerted at {stop}.', { stop: journey.destinationName })}
            confirmLabel={t('Cancel journey')}
            cancelLabel={t('Keep tracking')}
            destructive
            onConfirm={j.cancel}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {paused ? (
            <Button variant="ghost" onClick={j.resume} loading={j.busy}>
              <Play aria-hidden /> {t('Resume')}
            </Button>
          ) : (
            <Button variant="ghost" onClick={j.pause} disabled={j.busy}>
              <Pause aria-hidden /> {t('Pause')}
            </Button>
          )}
          <Button variant="ghost" onClick={j.complete} disabled={j.busy}>
            <Check aria-hidden /> {t('I got off')}
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setSimOpen((o) => !o)}
          className="mx-auto mt-4 flex items-center gap-1 text-sm font-semibold text-info underline underline-offset-4"
          aria-expanded={simOpen}
        >
          {t('Prototype: see what happens near the stop')}
          <ChevronDown className={cn('size-4 transition-transform duration-300', simOpen && 'rotate-180')} aria-hidden />
        </button>
        {simOpen && (
          <div className="mt-4 rounded-2xl bg-sunken p-4 animate-slide-up">
            {j.source !== 'simulation' ? (
              <div className="space-y-3 text-sm">
                <p className="text-ink-muted">{t('A virtual bus drives along the route so you can test the alert without travelling.')}</p>
                <Button className="w-full" onClick={() => j.setSource('simulation')}>
                  <FlaskConical aria-hidden /> {t('Switch to the simulator')}
                </Button>
              </div>
            ) : (
              <>
                <SimulatorPanel simulation={j.simulation} stops={j.route?.stops ?? []} destinationIndex={p.destIndex} disabled={paused || j.busy} />
                <Button variant="ghost" size="sm" className="mt-3" onClick={() => j.setSource('gps')}>
                  {t('Back to device GPS')}
                </Button>
              </>
            )}
          </div>
        )}
        <p className="mt-5 text-center text-xs text-ink-subtle">
          {t('Keep BUSIFY open during the ride.')} {j.wakeLockActive ? t('The screen is being kept awake.') : ''}
        </p>
      </section>

      <RadiusDialog open={radiusOpen} onOpenChange={setRadiusOpen} />
    </div>
  );
}

function RadiusDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const j = useJourney();
  const { config } = usePublicConfig();
  const { t, meters } = useI18n();
  const current = j.journey?.alertRadiusM ?? 200;
  const [value, setValue] = useState(current);
  useEffect(() => setValue(current), [current, open]);
  const presets = [100, 200, 300, 500].filter((v) => v >= config.alert.minRadiusM && v <= config.alert.maxRadiusM);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('Change distance')}
        description={t('How close before we wake you?')}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('Cancel')}
            </Button>
            <Button
              loading={j.busy}
              disabled={value === current}
              onClick={async () => {
                await j.updateRadius(value);
                onOpenChange(false);
              }}
            >
              {t('Save')}
            </Button>
          </>
        }
      >
        <div className="rounded-2xl bg-brand-900 p-5 text-white">
          <p className="text-5xl font-extrabold tabular">
            {value} <span className="text-lg font-semibold text-white/75">{t('m')}</span>
          </p>
          <Slider tone="dark" className="mt-4" min={config.alert.minRadiusM} max={config.alert.maxRadiusM} step={50} value={[value]} onValueChange={([v]) => setValue(v)} aria-label={t('Alert distance in metres')} />
          <div className="mt-4 grid grid-cols-4 gap-2">
            {presets.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setValue(v)}
                className={cn('press h-11 rounded-xl border text-sm font-bold', v === value ? 'border-accent-400 bg-accent-400 text-brand-900' : 'border-white/15 hover:border-white/40')}
              >
                {meters(v)}
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
