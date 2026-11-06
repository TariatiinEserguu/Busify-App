import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BellRing, ChevronRight, History, LocateFixed, MapPin, Plus, Volume2, VolumeX } from 'lucide-react';
import { Avatar, RouteBadge } from '@/components/domain';
import { PassengerPage } from '@/components/layout/AppShell';
import { NotificationsBell } from '@/components/layout/NotificationsBell';
import { BusMap } from '@/components/map/BusMap';
import { Skeleton } from '@/components/ui/feedback';
import { useUserSettings, usePublicConfig } from '@/features/appData';
import { useAuth } from '@/features/auth/AuthProvider';
import { useJourney } from '@/features/journey/JourneyProvider';
import { useLocationPermission } from '@/features/journey/useGeolocation';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Journey } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { journeyProgress } from './journey/progress';

/** Passenger home ("Нүүр цонх"): greeting, the active journey card and quick actions. */
export function HomePage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const j = useJourney();
  const permission = useLocationPermission();

  return (
    <PassengerPage>
      <header className="flex items-center gap-3 animate-slide-up">
        <Avatar name={user?.name ?? '?'} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-muted">{t('Hello')}</p>
          <p className="truncate text-xl font-bold tracking-tight">{user?.name}</p>
        </div>
        <NotificationsBell tone="round" />
      </header>

      <div className="mt-6 space-y-4">
        {j.isLoading ? <Skeleton className="h-[420px] rounded-[28px]" /> : j.journey ? <ActiveJourneyCard /> : <StartCard />}
        {permission !== 'granted' && permission !== 'unknown' && !j.journey && (
          <Link to="/plan" className="lift flex items-center gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm animate-slide-up">
            <LocateFixed className="size-5 shrink-0 text-accent-700" aria-hidden />
            <span className="min-w-0 flex-1 font-medium text-[#5c3d00]">{t('Allow location so BUSIFY can wake you before your stop.')}</span>
            <ChevronRight className="size-4 text-accent-700" aria-hidden />
          </Link>
        )}
        <QuickTiles />
        {!j.journey && <RecentTrips />}
      </div>
    </PassengerPage>
  );
}

function ActiveJourneyCard() {
  const j = useJourney();
  const { t, formatDistance, meters } = useI18n();
  const navigate = useNavigate();
  const journey = j.journey!;
  const distance = j.live.distanceM ?? journey.lastDistanceM;
  const position = j.live.reading ? { lat: j.live.reading.lat, lng: j.live.reading.lng } : null;
  const p = useMemo(() => journeyProgress(j.route?.stops ?? [], journey.destinationStopId, position, distance), [j.route, journey.destinationStopId, position?.lat, position?.lng, distance]);
  const gpsOk = j.source === 'simulation' || j.gps.state === 'tracking';

  return (
    <section className="card-ink overflow-hidden p-5 pb-3 animate-slide-up [animation-delay:60ms]">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-white/90">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
          </span>
          {journey.status === 'PAUSED' ? t('Paused') : t('Active journey')}
        </span>
        <span className="rounded-lg bg-accent-400 px-2.5 py-1 text-sm font-bold text-brand-900">{journey.routeNumber}</span>
      </div>
      <p className="mt-4 text-sm text-white/70">{t('Get-off stop')}</p>
      <h2 className="text-[34px] font-extrabold leading-tight tracking-tight">{journey.destinationName}</h2>

      <dl className="stagger mt-4 grid grid-cols-3 gap-2">
        {[
          [t('Distance left'), distance != null ? formatDistance(distance) : '—'],
          [t('Stops'), p.stopsLeft != null ? t('{n} left', { n: p.stopsLeft }) : '—'],
          [t('Wake at'), meters(journey.alertRadiusM)],
        ].map(([k, v], i) => (
          <div key={k} className="rounded-2xl bg-white/8 px-3 py-2.5" style={{ ['--i' as string]: i }}>
            <dt className="text-[11px] font-medium text-white/65">{k}</dt>
            <dd className="mt-0.5 text-lg font-bold leading-tight tabular">{v}</dd>
          </div>
        ))}
      </dl>

      <div
        role="link"
        tabIndex={0}
        onClick={() => navigate('/journey')}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/journey')}
        className="group relative -mx-2 mt-4 block h-56 w-[calc(100%+1rem)] cursor-pointer overflow-hidden rounded-[22px] text-left"
        aria-label={t('Open the live map')}
      >
        <BusMap
          static
          hideControls
          className="pointer-events-none h-full w-full"
          stops={j.route?.stops ?? []}
          routeColor="#10162c"
          destinationId={journey.destinationStopId}
          destinationPoint={!j.route ? { lat: journey.destinationLat, lng: journey.destinationLng, name: journey.destinationName } : null}
          alertRadiusM={journey.alertRadiusM}
          user={j.live.reading ? { lat: j.live.reading.lat, lng: j.live.reading.lng, accuracyM: null, simulated: j.live.reading.simulated } : null}
          userAsBus
          fitKey={`home-${journey.id}-${!!j.route}`}
        />
        <span className={cn('absolute left-3 top-3 z-[500] flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold text-ink shadow')}>
          <span className={cn('size-2 rounded-full', gpsOk ? 'bg-ok animate-blink' : 'bg-accent-500')} />
          {gpsOk ? t('GPS active') : t('Searching GPS')}
        </span>
        <span className="absolute bottom-3 right-3 z-[500] flex items-center gap-1 rounded-full bg-brand-900 px-3 py-1.5 text-xs font-semibold text-white shadow transition-transform group-hover:translate-x-0.5">
          {t('Open')} <ArrowRight className="size-3.5" aria-hidden />
        </span>
      </div>
    </section>
  );
}

function StartCard() {
  const { t } = useI18n();
  return (
    <section className="card-ink relative overflow-hidden p-6 animate-slide-up [animation-delay:60ms]">
      <svg viewBox="0 0 300 120" className="pointer-events-none absolute -right-6 top-0 h-32 w-72 opacity-60" aria-hidden>
        <path d="M0 90 C 70 40, 120 120, 190 70 S 280 20, 320 40" fill="none" stroke="#2b3354" strokeWidth="18" strokeLinecap="round" />
        <path d="M0 90 C 70 40, 120 120, 190 70 S 280 20, 320 40" fill="none" stroke="#ffc233" strokeWidth="2.5" strokeDasharray="2 9" strokeLinecap="round" className="animate-dash" />
        <circle cx="250" cy="38" r="8" fill="#ffc233" />
      </svg>
      <p className="relative text-xs font-bold uppercase tracking-[0.12em] text-white/60">{t('No active journey')}</p>
      <h2 className="relative mt-3 max-w-[16rem] text-[28px] font-extrabold leading-tight tracking-tight">{t('Where are you going today?')}</h2>
      <p className="relative mt-2 max-w-xs text-sm text-white/70">{t('Choose your bus and stop — we will wake you before you arrive.')}</p>
      <Link
        to="/plan"
        className="press relative mt-6 inline-flex h-14 items-center gap-2 rounded-2xl bg-accent-400 px-6 text-base font-bold text-brand-900 shadow-glow transition-colors hover:bg-accent-300"
      >
        <Plus className="size-5" aria-hidden /> {t('Start a journey')}
      </Link>
    </section>
  );
}

function QuickTiles() {
  const { settings } = useUserSettings();
  const { t } = useI18n();
  return (
    <div className="stagger grid grid-cols-2 gap-3">
      <Link to="/settings" className="lift flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card" style={{ ['--i' as string]: 2 }}>
        <span className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl', settings.soundEnabled ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad')}>
          {settings.soundEnabled ? <Volume2 className="size-5" aria-hidden /> : <VolumeX className="size-5" aria-hidden />}
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight">{t('Sound + vibration')}</span>
          <span className="block text-xs text-ink-subtle">{settings.soundEnabled ? t('On') : t('Off')}</span>
        </span>
      </Link>
      <Link to="/map" className="lift flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card" style={{ ['--i' as string]: 3 }}>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ok-soft text-ok">
          <MapPin className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold leading-tight">{t('Location')}</span>
          <span className="block text-xs text-ink-subtle">{t('Every 5 sec')}</span>
        </span>
      </Link>
    </div>
  );
}

function RecentTrips() {
  const { t, meters } = useI18n();
  const navigate = useNavigate();
  const { config } = usePublicConfig();
  const query = useQuery({
    queryKey: ['journeys', 'history'],
    queryFn: async () => (await api.get<{ journeys: Journey[] }>('/journeys?limit=50')).journeys,
  });
  // One entry per route + stop, most recent first.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    return (query.data ?? []).filter((j) => {
      const key = `${j.routeId}-${j.destinationStopId}`;
      if (!j.routeId || !j.destinationStopId || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 3);
  }, [query.data]);
  if (query.isLoading) return <Skeleton className="h-36 rounded-card" />;
  if (recent.length === 0) return null;
  return (
    <section className="animate-slide-up [animation-delay:160ms]">
      <div className="mb-2 mt-2 flex items-center justify-between px-1">
        <h3 className="eyebrow">{t('Go again')}</h3>
        <Link to="/history" className="flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-ink">
          <History className="size-3.5" aria-hidden /> {t('History')}
        </Link>
      </div>
      <ul className="card divide-y divide-line overflow-hidden">
        {recent.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => navigate(`/plan?route=${r.routeId}&stop=${r.destinationStopId}`)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-canvas"
            >
              <RouteBadge number={r.routeNumber} color={r.routeColor} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{r.destinationName}</span>
                <span className="block text-xs text-ink-subtle">
                  {formatDate(r.startedAt)} · <BellRing className="inline size-3" aria-hidden /> {meters(r.alertRadiusM ?? config.alert.defaultRadiusM)}
                </span>
              </span>
              <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
