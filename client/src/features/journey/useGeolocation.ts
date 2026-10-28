import { useCallback, useEffect, useRef, useState } from 'react';
import type { PositionReading } from '@busify/shared';
import { reportClientError } from '@/lib/reportError';

export type GpsSupport = 'ok' | 'unsupported' | 'insecure';

/** Browsers only provide location on https:// pages or http://localhost. */
export function gpsSupport(): GpsSupport {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  return 'ok';
}

export const GPS_HELP = {
  unsupported: 'This browser cannot provide your location. You can still test alerts with the simulator.',
  insecure:
    'Location only works on secure pages. Open BUSIFY at http://localhost on this computer, or enable HTTPS for phones (see the README).',
  denied:
    'Location permission is blocked. Allow location for this site in your browser settings, then press "Try again". Without it BUSIFY cannot send stop alerts.',
} as const;

export type PermissionStatusValue = 'granted' | 'denied' | 'prompt' | 'unknown' | GpsSupport;

/** Current geolocation permission (updates live where the Permissions API exists). */
export function useLocationPermission(): PermissionStatusValue {
  const [state, setState] = useState<PermissionStatusValue>(() => {
    const support = gpsSupport();
    return support === 'ok' ? 'unknown' : support;
  });
  useEffect(() => {
    if (gpsSupport() !== 'ok' || !navigator.permissions?.query) return;
    let status: PermissionStatus | null = null;
    const update = () => status && setState(status.state as PermissionStatusValue);
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        status = s;
        update();
        s.addEventListener('change', update);
      })
      .catch(() => undefined);
    return () => status?.removeEventListener('change', update);
  }, []);
  return state;
}

export type GpsState = 'off' | 'starting' | 'tracking' | 'searching' | 'denied' | 'unsupported' | 'insecure';

export interface GpsStatus {
  state: GpsState;
  message: string | null;
  lastFixAt: number | null;
  accuracyM: number | null;
}

const STALE_AFTER_MS = 30_000;

function toReading(pos: GeolocationPosition): PositionReading {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracyM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
    timestamp: pos.timestamp || Date.now(),
  };
}

/**
 * Continuously watches the device position while `enabled`. Temporary
 * failures (no signal, timeouts) keep the watch alive and are reported as
 * "searching"; a denied permission stops it until `retry()` is called.
 */
export function useGeolocationWatch(enabled: boolean, onReading: (reading: PositionReading) => void) {
  const [status, setStatus] = useState<GpsStatus>({ state: 'off', message: null, lastFixAt: null, accuracyM: null });
  const [attempt, setAttempt] = useState(0);
  const callback = useRef(onReading);
  callback.current = onReading;

  useEffect(() => {
    if (!enabled) {
      setStatus((s) => ({ ...s, state: 'off', message: null }));
      return;
    }
    const support = gpsSupport();
    if (support !== 'ok') {
      setStatus({ state: support, message: GPS_HELP[support], lastFixAt: null, accuracyM: null });
      return;
    }
    setStatus((s) => ({ ...s, state: 'starting', message: 'Finding your location…' }));

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const reading = toReading(pos);
        setStatus({ state: 'tracking', message: null, lastFixAt: Date.now(), accuracyM: reading.accuracyM });
        callback.current(reading);
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setStatus((s) => ({ ...s, state: 'denied', message: GPS_HELP.denied }));
          return;
        }
        if (err.code === err.POSITION_UNAVAILABLE) reportClientError('GPS position unavailable', { message: err.message });
        setStatus((s) => ({
          ...s,
          state: 'searching',
          message:
            err.code === err.TIMEOUT
              ? 'Still waiting for a GPS fix. Move near a window or outdoors.'
              : 'Location is temporarily unavailable. BUSIFY keeps trying.',
        }));
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20_000 },
    );

    const watchdog = window.setInterval(() => {
      setStatus((s) =>
        s.state === 'tracking' && s.lastFixAt && Date.now() - s.lastFixAt > STALE_AFTER_MS
          ? { ...s, state: 'searching', message: 'No GPS update for 30 seconds. Alerts resume when the signal returns.' }
          : s,
      );
    }, 5000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearInterval(watchdog);
    };
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { ...status, retry };
}

/** One-off location lookup for the dashboard (nearby stops, centring the map). */
export function useCurrentPosition(autoRequest: boolean) {
  const [position, setPosition] = useState<PositionReading | null>(null);
  const [state, setState] = useState<'idle' | 'locating' | 'ok' | 'denied' | 'error' | GpsSupport>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const request = useCallback(() => {
    const support = gpsSupport();
    if (support !== 'ok') {
      setState(support);
      setMessage(GPS_HELP[support]);
      return;
    }
    setState('locating');
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition(toReading(pos));
        setState('ok');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState('denied');
          setMessage(GPS_HELP.denied);
        } else {
          setState('error');
          setMessage('Could not get your location right now. Try again in a moment.');
        }
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 15_000 },
    );
  }, []);

  useEffect(() => {
    if (autoRequest) request();
  }, [autoRequest, request]);

  return { position, state, message, request };
}
