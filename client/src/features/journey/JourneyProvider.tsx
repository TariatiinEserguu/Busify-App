/**
 * Journey tracking for the whole app. Lives above the page routes so tracking
 * continues while the passenger browses other pages.
 *
 * Positions come from the device GPS or from the simulator; both go through
 * the shared alert engine, which decides when to alert. The server stores
 * the journey and whether the alert already fired, so a page refresh never
 * repeats it.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  createAlertConfig,
  createAlertState,
  evaluateReading,
  formatDistance,
  rearmDistanceM,
  resetAlert as resetEngine,
  resumeAlertState,
  type AlertOutcome,
  type AlertState,
  type LatLng,
  type PositionReading,
} from '@busify/shared';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePublicConfig, useUserSettings } from '@/features/appData';
import { api, ApiError, errorMessage } from '@/lib/api';
import type { ActiveJourneyPayload, Journey, RouteDetail } from '@/lib/types';
import {
  flashTitle,
  registerNotificationWorker,
  requestNotificationPermission,
  ScreenWakeLock,
  showSystemNotification,
  startAlarm,
  unlockAudio,
} from './alertEffects';
import { AlertOverlay } from './AlertOverlay';
import { buildSimulationPath, SIM_TICK_MS, simulatedReading, type SimulationPath } from './simulator';
import { useGeolocationWatch, type GpsState } from './useGeolocation';

export type PositionSource = 'gps' | 'simulation';

export interface LiveReading extends PositionReading {
  simulated: boolean;
}

export interface SimulationControls {
  running: boolean;
  speedKmh: number;
  jitterM: number;
  startIndex: number;
  progress: number;
  remainingToStopM: number | null;
  setSpeed: (kmh: number) => void;
  setJitter: (m: number) => void;
  setStartIndex: (index: number) => void;
  play: () => void;
  pause: () => void;
  restart: () => void;
  jumpBeforeStop: (meters: number) => void;
  placeAt: (point: LatLng) => void;
}

interface StartInput {
  routeId: number;
  destinationStopId: number;
  alertRadiusM?: number;
  replaceActive?: boolean;
}

interface JourneyContextValue {
  journey: Journey | null;
  route: RouteDetail | null;
  isLoading: boolean;
  loadError: unknown;
  source: PositionSource;
  setSource: (source: PositionSource) => void;
  live: { reading: LiveReading | null; distanceM: number | null; outcome: AlertOutcome | null; lowAccuracy: boolean };
  gps: { state: GpsState; message: string | null; lastFixAt: number | null; accuracyM: number | null; retry: () => void };
  alertState: AlertState;
  simulation: SimulationControls;
  wakeLockActive: boolean;
  busy: boolean;
  start: (input: StartInput) => Promise<boolean>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
  complete: () => Promise<void>;
  resetAlert: () => Promise<void>;
  updateRadius: (radiusM: number) => Promise<void>;
}

const JourneyContext = createContext<JourneyContextValue | null>(null);
const ACTIVE_KEY = ['journey', 'active'];
const PROGRESS_INTERVAL_MS = 15_000;
const SOURCE_STORAGE_KEY = 'busify.positionSource';

function readStoredSource(): PositionSource {
  try {
    return sessionStorage.getItem(SOURCE_STORAGE_KEY) === 'simulation' ? 'simulation' : 'gps';
  } catch {
    return 'gps';
  }
}

export function JourneyProvider({ children }: { children: ReactNode }) {
  const { can } = useAuth();
  const enabled = can('journeys:use');
  const queryClient = useQueryClient();
  const { config } = usePublicConfig();
  const { settings } = useUserSettings(enabled);

  const activeQuery = useQuery({
    queryKey: ACTIVE_KEY,
    queryFn: () => api.get<ActiveJourneyPayload>('/journeys/active'),
    enabled,
    staleTime: 30_000,
  });
  const journey = activeQuery.data?.journey ?? null;
  const route = activeQuery.data?.route ?? null;

  const [source, setSourceState] = useState<PositionSource>(readStoredSource);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<JourneyContextValue['live']>({ reading: null, distanceM: null, outcome: null, lowAccuracy: false });
  const [alertState, setAlertState] = useState<AlertState>(() => createAlertState());
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertDistance, setAlertDistance] = useState<number | null>(null);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  // Refs keep the reading handler stable while always seeing current values.
  const engine = useRef<AlertState>(createAlertState());
  const engineJourneyId = useRef<number | null>(null);
  const journeyRef = useRef<Journey | null>(journey);
  journeyRef.current = journey;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastProgressAt = useRef(0);
  const pendingAlert = useRef<{ journeyId: number; distanceM: number; accuracyM: number | null; simulated: boolean } | null>(null);
  const stopEffects = useRef<Array<() => void>>([]);
  const wakeLock = useRef<ScreenWakeLock | null>(null);

  const alertConfig = useMemo(
    () =>
      createAlertConfig({
        radiusM: journey?.alertRadiusM ?? config.alert.defaultRadiusM,
        maxAccuracyM: config.alert.gpsMaxAccuracyM,
        confirmReadings: config.alert.confirmReadings,
      }),
    [journey?.alertRadiusM, config.alert.defaultRadiusM, config.alert.gpsMaxAccuracyM, config.alert.confirmReadings],
  );
  const alertConfigRef = useRef(alertConfig);
  alertConfigRef.current = alertConfig;

  const setPayload = useCallback(
    (payload: ActiveJourneyPayload) => queryClient.setQueryData(ACTIVE_KEY, payload),
    [queryClient],
  );

  const updateJourney = useCallback(
    (updated: Journey) => {
      queryClient.setQueryData<ActiveJourneyPayload>(ACTIVE_KEY, (prev) => {
        if (updated.status === 'COMPLETED' || updated.status === 'CANCELLED') return { journey: null, route: null };
        return { journey: updated, route: prev?.route ?? null };
      });
      if (updated.status === 'COMPLETED' || updated.status === 'CANCELLED') {
        void queryClient.invalidateQueries({ queryKey: ['journeys', 'history'] });
      }
    },
    [queryClient],
  );

  const stopAlertEffects = useCallback(() => {
    stopEffects.current.forEach((stop) => stop());
    stopEffects.current = [];
  }, []);

  // A new (or restored) journey gets a fresh engine that remembers whether
  // the server already recorded the alert.
  useEffect(() => {
    if (!journey) {
      if (engineJourneyId.current !== null) {
        engineJourneyId.current = null;
        stopAlertEffects();
        setAlertOpen(false);
        setLive({ reading: null, distanceM: null, outcome: null, lowAccuracy: false });
      }
      return;
    }
    if (engineJourneyId.current !== journey.id) {
      engineJourneyId.current = journey.id;
      engine.current = createAlertState({ triggered: !!journey.alertTriggeredAt, armed: !journey.alertRearmPending });
      setAlertState(engine.current);
      lastProgressAt.current = 0;
      setLive({ reading: null, distanceM: journey.lastDistanceM, outcome: null, lowAccuracy: false });
    }
  }, [journey, stopAlertEffects]);

  const sendAlert = useCallback(
    async (alert: NonNullable<typeof pendingAlert.current>) => {
      try {
        const res = await api.post<{ journey: Journey; duplicate: boolean }>(`/journeys/${alert.journeyId}/alert`, {
          distanceM: alert.distanceM,
          accuracyM: alert.accuracyM,
          simulated: alert.simulated,
        });
        pendingAlert.current = null;
        updateJourney(res.journey);
      } catch (err) {
        // Offline or server restarting: keep it and retry with the next progress update.
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) pendingAlert.current = null;
        else pendingAlert.current = alert;
      }
    },
    [updateJourney],
  );

  const fireAlert = useCallback(
    (j: Journey, distanceM: number, accuracyM: number | null, simulated: boolean) => {
      const s = settingsRef.current;
      setAlertDistance(distanceM);
      setAlertOpen(true);
      stopAlertEffects();
      stopEffects.current.push(startAlarm({ sound: s.soundEnabled, vibration: s.vibrationEnabled }));
      stopEffects.current.push(flashTitle('🔔 Your stop is approaching!'));
      if (s.notificationsEnabled) {
        void showSystemNotification('Your bus stop is approaching!', `${j.destinationName} is about ${formatDistance(distanceM)} away.`);
      }
      void sendAlert({ journeyId: j.id, distanceM, accuracyM, simulated });
    },
    [sendAlert, stopAlertEffects],
  );

  const handleReading = useCallback(
    (reading: PositionReading, simulated: boolean) => {
      const j = journeyRef.current;
      if (!j || j.status !== 'ACTIVE') return;
      const result = evaluateReading(engine.current, reading, { lat: j.destinationLat, lng: j.destinationLng }, alertConfigRef.current);
      engine.current = result.state;
      setAlertState(result.state);
      setLive({
        reading: { ...reading, simulated },
        distanceM: result.distanceM,
        outcome: result.outcome,
        lowAccuracy: result.outcome === 'ignored-inaccurate',
      });

      if (result.outcome === 'triggered' && result.distanceM != null) {
        fireAlert(j, result.distanceM, reading.accuracyM, simulated);
        lastProgressAt.current = Date.now();
        return;
      }
      if (result.outcome === 'ignored-stale' || result.outcome === 'ignored-inaccurate' || result.distanceM == null) return;

      const now = Date.now();
      if (now - lastProgressAt.current < PROGRESS_INTERVAL_MS && result.outcome !== 'rearmed') return;
      lastProgressAt.current = now;
      if (pendingAlert.current) void sendAlert(pendingAlert.current);
      api
        .post<{ journey: Journey }>(`/journeys/${j.id}/progress`, {
          distanceM: result.distanceM,
          accuracyM: reading.accuracyM,
          simulated,
          alertArmed: result.state.armed,
        })
        .then((res) => updateJourney(res.journey))
        .catch((err) => {
          // The journey was ended elsewhere (another device, or an admin removed the route).
          if (err instanceof ApiError && (err.status === 409 || err.status === 404)) {
            void queryClient.invalidateQueries({ queryKey: ACTIVE_KEY });
          }
        });
    },
    [fireAlert, queryClient, sendAlert, updateJourney],
  );

  // ---- Real GPS ----------------------------------------------------------
  const tracking = !!journey && journey.status === 'ACTIVE';
  const onGpsReading = useCallback((r: PositionReading) => handleReading(r, false), [handleReading]);
  const gps = useGeolocationWatch(tracking && source === 'gps', onGpsReading);

  // ---- Simulator -----------------------------------------------------------
  const destinationIndex = useMemo(
    () => (route && journey ? route.stops.findIndex((s) => s.id === journey.destinationStopId) : -1),
    [route, journey],
  );
  const [simRunning, setSimRunning] = useState(false);
  const [speedKmh, setSpeed] = useState(40);
  const [jitterM, setJitter] = useState(15);
  const [startIndex, setStartIndexState] = useState(0);
  const [alongM, setAlongM] = useState(0);
  const alongRef = useRef(0);

  // Sensible default start: two stops before the destination (about a 2-minute ride).
  useEffect(() => {
    setStartIndexState(destinationIndex > 0 ? Math.max(0, destinationIndex - 2) : 0);
    alongRef.current = 0;
    setAlongM(0);
    setSimRunning(false);
  }, [journey?.id, destinationIndex]);

  const journeyId = journey?.id;
  const destLat = journey?.destinationLat;
  const destLng = journey?.destinationLng;
  const simPath: SimulationPath | null = useMemo(() => {
    if (journeyId == null || destLat == null || destLng == null) return null;
    if (route && destinationIndex >= 0) return buildSimulationPath(route.stops, startIndex, destinationIndex);
    // Route removed or edited: approach the stored destination directly.
    return buildSimulationPath([{ latitude: destLat, longitude: destLng }], 0, 0);
  }, [journeyId, destLat, destLng, route, destinationIndex, startIndex]);

  const emitSimulated = useCallback(
    (along: number) => {
      if (!simPath) return;
      const reading = simulatedReading(simPath.path, along, jitterM);
      handleReading(reading, true);
      if (reading.finished) setSimRunning(false);
    },
    [simPath, jitterM, handleReading],
  );

  useEffect(() => {
    if (!simRunning || !tracking || source !== 'simulation' || !simPath) return;
    const timer = window.setInterval(() => {
      alongRef.current = Math.min(simPath.totalM, alongRef.current + (speedKmh / 3.6) * (SIM_TICK_MS / 1000));
      setAlongM(alongRef.current);
      emitSimulated(alongRef.current);
    }, SIM_TICK_MS);
    return () => window.clearInterval(timer);
  }, [simRunning, tracking, source, simPath, speedKmh, emitSimulated]);

  const simulation: SimulationControls = {
    running: simRunning,
    speedKmh,
    jitterM,
    startIndex,
    progress: simPath ? Math.min(1, alongM / simPath.totalM) : 0,
    remainingToStopM: simPath ? Math.max(0, simPath.destinationAlongM - alongM) : null,
    setSpeed,
    setJitter,
    setStartIndex: (index) => {
      setStartIndexState(index);
      alongRef.current = 0;
      setAlongM(0);
    },
    play: () => {
      unlockAudio();
      if (simPath && alongRef.current >= simPath.totalM) {
        alongRef.current = 0;
        setAlongM(0);
      }
      emitSimulated(alongRef.current);
      setSimRunning(true);
    },
    pause: () => setSimRunning(false),
    restart: () => {
      alongRef.current = 0;
      setAlongM(0);
      emitSimulated(0);
    },
    jumpBeforeStop: (meters) => {
      if (!simPath) return;
      alongRef.current = Math.max(0, simPath.destinationAlongM - meters);
      setAlongM(alongRef.current);
      emitSimulated(alongRef.current);
    },
    placeAt: (point) => {
      setSimRunning(false);
      handleReading({ ...point, accuracyM: 5, timestamp: Date.now() }, true);
    },
  };

  const setSource = useCallback((next: PositionSource) => {
    setSourceState(next);
    setSimRunning(false);
    try {
      sessionStorage.setItem(SOURCE_STORAGE_KEY, next);
    } catch {
      // Private mode: the choice just will not survive a refresh.
    }
  }, []);

  // ---- Keep the screen on while tracking ------------------------------------
  useEffect(() => {
    if (!tracking || !settings.keepScreenAwake) return;
    const lock = (wakeLock.current ??= new ScreenWakeLock());
    void lock.enable().then(setWakeLockActive);
    return () => {
      lock.release();
      setWakeLockActive(false);
    };
  }, [tracking, settings.keepScreenAwake]);

  useEffect(() => () => stopAlertEffects(), [stopAlertEffects]);

  // ---- Actions ---------------------------------------------------------------
  const run = useCallback(async <T,>(fn: () => Promise<T>, failure: string): Promise<T | undefined> => {
    setBusy(true);
    try {
      return await fn();
    } catch (err) {
      toast.error(failure, { description: errorMessage(err) });
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  const action = useCallback(
    (name: 'pause' | 'resume' | 'cancel' | 'complete', failure: string) => async () => {
      const j = journeyRef.current;
      if (!j) return;
      const res = await run(() => api.post<{ journey: Journey }>(`/journeys/${j.id}/${name}`), failure);
      if (!res) return;
      if (name === 'resume') {
        engine.current = resumeAlertState(engine.current);
        setAlertState(engine.current);
      }
      if (name === 'pause') setSimRunning(false);
      if (name === 'cancel' || name === 'complete') {
        stopAlertEffects();
        setAlertOpen(false);
        setSimRunning(false);
      }
      updateJourney(res.journey);
    },
    [run, stopAlertEffects, updateJourney],
  );

  const value: JourneyContextValue = {
    journey,
    route,
    isLoading: activeQuery.isLoading,
    loadError: activeQuery.error,
    source,
    setSource,
    live,
    gps,
    alertState,
    simulation,
    wakeLockActive,
    busy,
    async start(input) {
      // Called from a click, so browsers allow sound and notification prompts.
      unlockAudio();
      void registerNotificationWorker();
      if (settingsRef.current.notificationsEnabled) void requestNotificationPermission();
      setBusy(true);
      try {
        const payload = await api.post<ActiveJourneyPayload>('/journeys', input);
        engineJourneyId.current = null;
        setPayload(payload);
        toast.success(`Tracking started — we will alert you near ${payload.journey?.destinationName}.`);
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.code === 'ACTIVE_JOURNEY_EXISTS') throw err;
        toast.error('Could not start the journey', { description: errorMessage(err) });
        return false;
      } finally {
        setBusy(false);
      }
    },
    pause: action('pause', 'Could not pause the journey'),
    resume: action('resume', 'Could not resume the journey'),
    cancel: action('cancel', 'Could not cancel the journey'),
    complete: action('complete', 'Could not end the journey'),
    async resetAlert() {
      const j = journeyRef.current;
      if (!j) return;
      const stillNearStop =
        engine.current.lastDistanceM != null && engine.current.lastDistanceM <= rearmDistanceM(alertConfigRef.current.radiusM);
      const res = await run(
        () => api.post<{ journey: Journey }>(`/journeys/${j.id}/reset-alert`, { stillNearStop }),
        'Could not reset the alert',
      );
      if (!res) return;
      engine.current = resetEngine(engine.current, alertConfigRef.current);
      setAlertState(engine.current);
      updateJourney(res.journey);
      toast.success(stillNearStop ? 'Alert re-armed. It will sound again after you move away and come back.' : 'Alert re-armed.');
    },
    async updateRadius(alertRadiusM) {
      const j = journeyRef.current;
      if (!j) return;
      const res = await run(() => api.patch<{ journey: Journey }>(`/journeys/${j.id}`, { alertRadiusM }), 'Could not change the alert distance');
      if (res) updateJourney(res.journey);
    },
  };

  return (
    <JourneyContext.Provider value={value}>
      {children}
      {journey && (
        <AlertOverlay
          open={alertOpen}
          destinationName={journey.destinationName}
          distanceM={alertDistance}
          busy={busy}
          onDismiss={() => {
            stopAlertEffects();
            setAlertOpen(false);
          }}
          onArrived={async () => {
            await value.complete();
            setAlertOpen(false);
          }}
        />
      )}
    </JourneyContext.Provider>
  );
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error('useJourney must be used inside <JourneyProvider>');
  return ctx;
}
