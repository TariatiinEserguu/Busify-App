import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, MapPin, Search, SearchX } from 'lucide-react';
import { haversineDistanceM } from '@busify/shared';
import { DemoBadge, scheduleText } from '@/components/domain';
import { PassengerPage } from '@/components/layout/AppShell';
import { Chip, Slider, Switch } from '@/components/ui/controls';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { usePublicConfig, useSaveUserSettings, useUserSettings } from '@/features/appData';
import { useJourney } from '@/features/journey/JourneyProvider';
import { gpsSupport, useCurrentPosition, useLocationPermission } from '@/features/journey/useGeolocation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { RouteDetail, RouteSummary, Stop } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ConfirmReplaceDialog } from './journey/ConfirmReplaceDialog';

type Step = 'gps' | 'stop' | 'distance';
const GPS_SKIP_KEY = 'busify.gpsIntroSeen';
const PRESETS = [100, 200, 300, 500];
/** Typical city bus speed used for the "≈ N sec before" hint (22 km/h). */
const BUS_SPEED_MS = 6.1;

function gpsIntroSeen() {
  try {
    return localStorage.getItem(GPS_SKIP_KEY) === '1';
  } catch {
    return false;
  }
}

/** Journey planner: allow GPS (first time only) → choose route and stop → choose the wake-up distance. */
export function PlanPage() {
  const j = useJourney();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const permission = useLocationPermission();
  const routeId = Number(params.get('route')) || null;
  const stopId = Number(params.get('stop')) || null;
  const needsGps = gpsSupport() === 'ok' && permission !== 'granted' && permission !== 'unknown' && !gpsIntroSeen();
  const step: Step = (params.get('step') as Step | null) ?? (needsGps ? 'gps' : 'stop');

  useEffect(() => {
    if (j.journey) navigate('/journey', { replace: true });
  }, [j.journey, navigate]);

  const go = (next: Partial<{ step: Step; route: number | null; stop: number | null }>, replace = false) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v == null) p.delete(k);
      else p.set(k, String(v));
    }
    setParams(p, { replace });
  };

  return (
    <div key={step} className="flex min-h-full flex-1 flex-col animate-page-in">
      {step === 'gps' && <GpsStep onDone={() => go({ step: 'stop' }, true)} />}
      {step === 'stop' && (
        <StopStep
          routeId={routeId}
          stopId={stopId}
          onRoute={(id) => go({ route: id, stop: null }, true)}
          onStop={(id, rid) => go({ stop: id, route: rid ?? routeId }, true)}
          onNext={() => go({ step: 'distance' })}
          onBack={() => navigate('/')}
        />
      )}
      {step === 'distance' && routeId && stopId && <DistanceStep routeId={routeId} stopId={stopId} onBack={() => navigate(-1)} />}
      {step === 'distance' && (!routeId || !stopId) && <StopStepRedirect onRedirect={() => go({ step: 'stop' }, true)} />}
    </div>
  );
}

function StopStepRedirect({ onRedirect }: { onRedirect: () => void }) {
  useEffect(onRedirect, [onRedirect]);
  return null;
}

function StepHeader({ step, onBack }: { step: number; onBack?: () => void }) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} className="press flex size-11 items-center justify-center rounded-2xl bg-surface shadow-card hover:shadow-float" aria-label={t('Back')}>
          <ChevronLeft className="size-5" aria-hidden />
        </button>
      ) : (
        <span className="flex gap-1.5" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span key={i} className={cn('h-1.5 rounded-full transition-all duration-500', i === step ? 'w-7 bg-brand-900' : 'w-5 bg-line-strong')} />
          ))}
        </span>
      )}
      <span className={cn('text-sm font-semibold text-ink-muted', onBack && 'flex-1 pr-11 text-center')}>{t('Step {n} / 3', { n: step })}</span>
    </div>
  );
}

// ---- Step 1: location permission --------------------------------------------
function GpsStep({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const location = useCurrentPosition(false);
  const finish = () => {
    try {
      localStorage.setItem(GPS_SKIP_KEY, '1');
    } catch {
      // fine
    }
    onDone();
  };
  useEffect(() => {
    if (location.state === 'ok' || location.state === 'denied') finish();
  }, [location.state]);

  return (
    <PassengerPage className="flex min-h-full flex-1 flex-col">
      <StepHeader step={1} />
      <div className="relative mt-6 flex h-52 items-center justify-center overflow-hidden rounded-[28px] bg-brand-900">
        {[0, 0.9, 1.8].map((d) => (
          <span key={d} className="absolute size-44 rounded-full border border-accent-400/40 animate-radar" style={{ animationDelay: `${d}s` }} aria-hidden />
        ))}
        <span className="absolute size-28 rounded-full bg-white/8" aria-hidden />
        <span className="relative flex size-16 items-center justify-center rounded-full bg-accent-400 text-brand-900 shadow-glow animate-pop-in">
          <MapPin className="size-7" strokeWidth={2.4} aria-hidden />
        </span>
      </div>
      <h1 className="mt-7 text-[26px] font-semibold leading-tight tracking-tight">{t('Allow BUSIFY to use your location?')}</h1>
      <p className="mt-2 text-[15px] text-ink-muted">{t('BUSIFY works out how close you are to your stop with GPS.')}</p>
      <ol className="stagger mt-6 space-y-4">
        {[t('Location is read only while a journey is active.'), t('The alert rings even if the app is in the background.'), t('Your location is never shared with third parties.')].map((text, i) => (
          <li key={i} className="flex gap-3" style={{ ['--i' as string]: i }}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sunken text-sm font-bold">{i + 1}</span>
            <span className="pt-1 text-[15px]">{text}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 flex gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-[#5c3d00]">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden />
        {t('Without GPS permission the system cannot send the alert.')}
      </div>
      {location.state === 'error' && location.message && <Callout tone="warning" className="mt-3">{t(location.message)}</Callout>}
      <div className="mt-auto space-y-2 pt-8">
        <button
          type="button"
          onClick={location.request}
          disabled={location.state === 'locating'}
          className="press h-14 w-full rounded-2xl bg-brand-900 text-base font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {location.state === 'locating' ? t('Finding your location…') : t('Allow')}
        </button>
        <button type="button" onClick={finish} className="h-12 w-full rounded-2xl text-base font-semibold text-ink hover:bg-sunken">
          {t('Not now')}
        </button>
      </div>
    </PassengerPage>
  );
}

// ---- Step 2: route and stop --------------------------------------------------
function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

function StopStep({
  routeId,
  stopId,
  onRoute,
  onStop,
  onNext,
  onBack,
}: {
  routeId: number | null;
  stopId: number | null;
  onRoute: (id: number) => void;
  onStop: (id: number, routeId?: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const { t, tn } = useI18n();
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim().toLocaleLowerCase(), 200);
  const permission = useLocationPermission();
  const here = useCurrentPosition(permission === 'granted');

  const routes = useQuery({ queryKey: ['routes', 'list', ''], queryFn: () => api.get<{ routes: RouteSummary[] }>('/routes') });
  const stops = useQuery({ queryKey: ['stops', 'list'], queryFn: () => api.get<{ stops: Stop[] }>('/stops'), staleTime: 60_000 });
  const list = routes.data?.routes ?? [];
  const activeRouteId = routeId ?? list[0]?.id ?? null;
  const route = useQuery({
    queryKey: ['routes', 'detail', activeRouteId],
    queryFn: async () => (await api.get<{ route: RouteDetail }>(`/routes/${activeRouteId}`)).route,
    enabled: activeRouteId != null,
  });
  const r = route.data;
  const chips = term ? list.filter((x) => `${x.number} ${x.name}`.toLocaleLowerCase().includes(term)) : list;
  const matchingStops = useMemo(
    () => (term ? (stops.data?.stops ?? []).filter((s) => s.routes.length > 0 && s.name.toLocaleLowerCase().includes(term)).slice(0, 6) : []),
    [term, stops.data],
  );
  const nearId = useMemo(() => {
    if (!here.position || !r) return null;
    let best: { id: number; d: number } | null = null;
    for (const s of r.stops) {
      const d = haversineDistanceM(here.position, { lat: s.latitude, lng: s.longitude });
      if (!best || d < best.d) best = { id: s.id, d };
    }
    return best && best.d < 800 ? best.id : null;
  }, [here.position, r]);
  const destination = r?.stops.find((s) => s.id === stopId) ?? null;

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PassengerPage className="flex-1 pb-36">
        <StepHeader step={2} onBack={onBack} />
        <h1 className="mt-5 text-[26px] font-semibold tracking-tight">{t('Where are you getting off?')}</h1>
        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search route or stop')}
            aria-label={t('Search route or stop')}
            className="h-14 w-full rounded-2xl border border-line-strong bg-surface pl-12 pr-4 text-base outline-none transition-[box-shadow,border-color] placeholder:text-ink-subtle focus:border-brand-900 focus:ring-4 focus:ring-accent-200/70"
          />
        </div>

        {routes.isLoading ? (
          <Skeleton className="mt-4 h-10" />
        ) : (
          <div className="scrollbar-none -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1">
            {chips.map((x) => (
              <Chip key={x.id} active={x.id === activeRouteId} onClick={() => onRoute(x.id)}>
                {x.number}
              </Chip>
            ))}
          </div>
        )}

        {matchingStops.length > 0 && (
          <ul className="card mt-4 divide-y divide-line overflow-hidden animate-slide-up">
            {matchingStops.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas"
                  onClick={() => {
                    const rid = s.routes.find((x) => x.id === activeRouteId)?.id ?? s.routes[0].id;
                    onStop(s.id, rid);
                    setSearch('');
                  }}
                >
                  <MapPin className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="text-xs font-semibold text-ink-muted">{s.routes.map((x) => x.number).join(', ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {routes.isError ? (
          <Callout tone="error" className="mt-4" title={t('Routes could not be loaded')}>
            {errorMessage(routes.error)}
          </Callout>
        ) : list.length === 0 && !routes.isLoading ? (
          <EmptyState icon={SearchX} title={t('No routes yet')}>
            {t('An administrator needs to add routes and stops first.')}
          </EmptyState>
        ) : (
          <section className="card mt-4 overflow-hidden">
            {!r ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-4 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-muted">
                      {r.number} · {r.firstStopName} → {r.lastStopName}
                    </p>
                    {scheduleText(r) && <p className="mt-0.5 text-xs text-ink-subtle">{scheduleText(r)}</p>}
                    {r.isDemo && <DemoBadge className="mt-1" />}
                  </div>
                  <span className="shrink-0 font-semibold text-ink-muted">{tn(r.stops.length, '{n} stop', '{n} stops')}</span>
                </div>
                <StopTimeline key={r.id} stops={r.stops} selectedId={stopId} nearId={nearId} onSelect={(id) => onStop(id)} />
              </>
            )}
          </section>
        )}
      </PassengerPage>

      <div className="fixed inset-x-0 bottom-0 z-[900] bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 lg:left-[232px]">
        <button
          type="button"
          disabled={!destination}
          onClick={onNext}
          className="press mx-auto block h-16 w-full max-w-[440px] rounded-2xl bg-brand-900 text-lg font-bold text-white shadow-float transition-all hover:bg-brand-700 disabled:bg-line-strong disabled:text-ink-subtle disabled:shadow-none"
        >
          {destination ? t('Get off at «{stop}»', { stop: destination.name }) : t('Choose your stop')}
        </button>
      </div>
    </div>
  );
}

/** Vertical stop line from the deck: navy dots, the chosen stop in amber with a "Get off" tag. */
function StopTimeline({ stops, selectedId, nearId, onSelect }: { stops: RouteDetail['stops']; selectedId: number | null; nearId: number | null; onSelect: (id: number) => void }) {
  const { t } = useI18n();
  const selectedIndex = stops.findIndex((s) => s.id === selectedId);
  const nearIndex = stops.findIndex((s) => s.id === nearId);
  return (
    <ol className="stagger px-2 pb-2">
      {stops.map((s, i) => {
        const selected = s.id === selectedId;
        const passed = nearIndex >= 0 && i < nearIndex;
        const solid = nearIndex >= 0 ? i <= nearIndex : i === 0;
        const last = i === stops.length - 1;
        const sub = i === 0 ? t('Start') : last ? t('Terminus') : s.id === nearId ? t('You are here') : s.description || null;
        return (
          <li key={s.id} style={{ ['--i' as string]: Math.min(i, 10) }}>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              aria-pressed={selected}
              className={cn('group flex w-full items-stretch gap-3 rounded-xl px-2 text-left transition-colors', selected ? 'bg-accent-50' : 'hover:bg-canvas')}
            >
              <span className="relative flex w-6 shrink-0 justify-center" aria-hidden>
                {i > 0 && <span className={cn('absolute left-1/2 top-0 h-1/2 w-[3px] -translate-x-1/2', passed || i <= nearIndex ? 'bg-brand-900' : 'bg-line-strong')} />}
                {!last && <span className={cn('absolute bottom-0 left-1/2 h-1/2 w-[3px] -translate-x-1/2', i < nearIndex ? 'bg-brand-900' : 'bg-line-strong')} />}
                <span
                  className={cn(
                    'relative z-10 my-auto rounded-full transition-all duration-300',
                    selected ? 'size-6 border-[3px] border-brand-900 bg-accent-400 shadow-[0_0_0_5px_rgb(255_194_51/0.3)]' : solid ? 'size-4 border-[3px] border-brand-900 bg-white' : 'size-3.5 border-[2.5px] border-line-strong bg-white group-hover:border-brand-400',
                  )}
                />
              </span>
              <span className={cn('flex min-w-0 flex-1 items-center gap-2 border-b border-line py-3', last && 'border-b-0', selected && 'border-transparent')}>
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-base', selected ? 'font-bold' : 'font-semibold', passed && !selected && 'text-ink-muted')}>{s.name}</span>
                  {sub && <span className={cn('block truncate text-xs', s.id === nearId ? 'font-semibold text-ok' : 'text-ink-subtle')}>{sub}</span>}
                </span>
                {selected && <span className="rounded-lg bg-accent-400 px-2.5 py-1 text-xs font-bold text-brand-900 animate-pop-in">{t('Get off')}</span>}
              </span>
            </button>
          </li>
        );
      })}
      {selectedIndex < 0 && <li className="px-4 pb-2 pt-1 text-xs text-ink-subtle">{t('Tap the stop where you want to get off.')}</li>}
    </ol>
  );
}

// ---- Step 3: wake-up distance ----------------------------------------------------
function DistanceStep({ routeId, stopId, onBack }: { routeId: number; stopId: number; onBack: () => void }) {
  const { t, meters } = useI18n();
  const j = useJourney();
  const navigate = useNavigate();
  const { config } = usePublicConfig();
  const { settings } = useUserSettings();
  const save = useSaveUserSettings();
  const [radius, setRadius] = useState(settings.alertRadiusM);
  const [conflict, setConflict] = useState<string | null>(null);
  useEffect(() => setRadius(settings.alertRadiusM), [settings.alertRadiusM]);
  const route = useQuery({
    queryKey: ['routes', 'detail', routeId],
    queryFn: async () => (await api.get<{ route: RouteDetail }>(`/routes/${routeId}`)).route,
  });
  const stop = route.data?.stops.find((s) => s.id === stopId);
  const min = config.alert.minRadiusM;
  const max = config.alert.maxRadiusM;
  const presets = PRESETS.filter((p) => p >= min && p <= max);
  const seconds = Math.round(radius / BUS_SPEED_MS);

  const toggle = (key: 'soundEnabled' | 'vibrationEnabled', value: boolean) =>
    save.mutate({
      alertRadiusM: settings.alertRadiusM,
      soundEnabled: settings.soundEnabled,
      vibrationEnabled: settings.vibrationEnabled,
      notificationsEnabled: settings.notificationsEnabled,
      keepScreenAwake: settings.keepScreenAwake,
      [key]: value,
    });

  async function start(replaceActive = false) {
    try {
      const ok = await j.start({ routeId, destinationStopId: stopId, alertRadiusM: radius, replaceActive });
      if (ok) navigate('/journey', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACTIVE_JOURNEY_EXISTS') setConflict(errorMessage(err));
    }
  }

  const rows: Array<{ title: string; hint: string; checked: boolean; onChange: (v: boolean) => void }> = [
    { title: t('Sound alert'), hint: t('Rings even in silent mode'), checked: settings.soundEnabled, onChange: (v) => toggle('soundEnabled', v) },
    { title: t('Vibration'), hint: t('Felt even with the phone in your pocket'), checked: settings.vibrationEnabled, onChange: (v) => toggle('vibrationEnabled', v) },
    { title: t('Repeat reminder'), hint: t('Every 30 sec if you do not respond'), checked: j.repeatAlert, onChange: j.setRepeatAlert },
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <PassengerPage className="flex-1 pb-36">
        <StepHeader step={3} onBack={onBack} />
        <h1 className="mt-5 text-[26px] font-semibold tracking-tight">{t('How close before we wake you?')}</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          {t('Get-off stop')}: <strong className="font-bold text-ink">{stop?.name ?? '…'}</strong> · {route.data?.number}
        </p>

        <section className="card-ink mt-5 p-5 animate-slide-up">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-baseline gap-2">
              <span key={radius} className="text-[64px] font-extrabold leading-none tracking-tight tabular animate-[pop-in_280ms_var(--ease-out-soft)]">{radius}</span>
              <span className="text-xl font-semibold text-white/80">{t('m')}</span>
            </p>
            <p className="pt-2 text-right text-sm leading-snug text-white/70">{t('≈ {n} sec', { n: seconds })}<br />{t('before, we wake you')}</p>
          </div>
          <Slider
            tone="dark"
            className="mt-5"
            min={min}
            max={max}
            step={min < 50 ? 10 : 50}
            value={[radius]}
            onValueChange={([v]) => setRadius(v)}
            aria-label={t('Alert distance in metres')}
          />
          <div className="mt-1 flex justify-between text-xs text-white/55">
            <span>{meters(min)}</span>
            <span>{meters(max)}</span>
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setRadius(p)}
                className={cn(
                  'press h-12 rounded-xl border text-sm font-bold transition-all duration-200',
                  p === radius ? 'border-accent-400 bg-accent-400 text-brand-900 shadow-glow' : 'border-white/15 text-white hover:border-white/40',
                )}
              >
                {meters(p)}
              </button>
            ))}
          </div>
        </section>

        <section className="card stagger mt-4 divide-y divide-line px-4">
          {rows.map((row, i) => (
            <label key={row.title} className="flex cursor-pointer items-center justify-between gap-4 py-4" style={{ ['--i' as string]: i + 1 }}>
              <span>
                <span className="block font-semibold">{row.title}</span>
                <span className="block text-xs text-ink-subtle">{row.hint}</span>
              </span>
              <Switch checked={row.checked} onCheckedChange={row.onChange} aria-label={row.title} />
            </label>
          ))}
        </section>
      </PassengerPage>

      <div className="fixed inset-x-0 bottom-0 z-[900] bg-gradient-to-t from-canvas via-canvas/95 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 lg:left-[232px]">
        <button
          type="button"
          disabled={!stop || j.busy}
          onClick={() => start(false)}
          className="press mx-auto block h-16 w-full max-w-[440px] rounded-2xl bg-accent-400 text-lg font-bold text-brand-900 shadow-glow transition-all hover:bg-accent-300 disabled:opacity-60"
        >
          {j.busy ? t('Starting…') : t('Activate alert')}
        </button>
      </div>

      <ConfirmReplaceDialog
        message={conflict}
        onCancel={() => setConflict(null)}
        onConfirm={async () => {
          setConflict(null);
          await start(true);
        }}
      />
    </div>
  );
}
