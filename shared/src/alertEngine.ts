/**
 * Bus stop alert engine.
 *
 * A pure state machine: feed it GPS readings and it decides when the
 * "Your bus stop is approaching!" alert must fire. It never uses timers or
 * estimated arrival times — only the passenger's measured position and the
 * destination stop's coordinates.
 *
 * Guarantees:
 *  - Fires at most once per journey. Later readings, however they fluctuate
 *    around the radius, report `already-triggered`.
 *  - Readings that are too inaccurate or arrive out of order are ignored.
 *  - A reading that is only *possibly* inside the radius (its accuracy circle
 *    crosses the boundary) needs `confirmReadings` consecutive inside readings,
 *    so a single jittery fix at the edge does not set it off. A reading that is
 *    confidently inside (distance + accuracy <= radius) fires immediately.
 *  - After the passenger resets the alert while still near the stop, it only
 *    re-arms once they move clearly outside the radius (hysteresis), so a reset
 *    never causes an instant repeat.
 */
import { haversineDistanceM, type LatLng } from './geo';

export const DEFAULT_ALERT_RADIUS_M = 200;
export const MIN_ALERT_RADIUS_M = 50;
export const MAX_ALERT_RADIUS_M = 2000;
export const DEFAULT_MAX_ACCURACY_M = 150;
export const DEFAULT_CONFIRM_READINGS = 2;

export interface AlertConfig {
  /** Alert when the passenger is within this many metres of the stop. */
  radiusM: number;
  /** Readings with a worse (larger) accuracy radius are ignored. */
  maxAccuracyM: number;
  /** Consecutive "possibly inside" readings needed before firing. */
  confirmReadings: number;
}

export interface PositionReading extends LatLng {
  /** Reported accuracy radius in metres (68% confidence), if known. */
  accuracyM: number | null;
  /** Epoch milliseconds when the fix was taken. */
  timestamp: number;
}

export interface AlertState {
  /** The alert has fired for this journey and has not been reset. */
  triggered: boolean;
  /** False after a reset near the stop, until the passenger moves away again. */
  armed: boolean;
  consecutiveInside: number;
  lastDistanceM: number | null;
  lastAccuracyM: number | null;
  lastFixAt: number | null;
  closestDistanceM: number | null;
}

export type AlertOutcome =
  | 'ignored-inaccurate'
  | 'ignored-stale'
  | 'outside'
  | 'pending-confirmation'
  | 'triggered'
  | 'already-triggered'
  | 'waiting-to-rearm'
  | 'rearmed';

export interface AlertEvaluation {
  state: AlertState;
  outcome: AlertOutcome;
  /** Distance to the stop for this reading (also set for ignored-inaccurate readings). */
  distanceM: number | null;
}

export function clampRadius(
  radiusM: number,
  min = MIN_ALERT_RADIUS_M,
  max = MAX_ALERT_RADIUS_M,
): number {
  if (!Number.isFinite(radiusM)) return DEFAULT_ALERT_RADIUS_M;
  return Math.round(Math.min(max, Math.max(min, radiusM)));
}

export function createAlertConfig(partial: Partial<AlertConfig> = {}): AlertConfig {
  return {
    radiusM: clampRadius(partial.radiusM ?? DEFAULT_ALERT_RADIUS_M),
    maxAccuracyM: Math.max(1, partial.maxAccuracyM ?? DEFAULT_MAX_ACCURACY_M),
    confirmReadings: Math.max(1, Math.round(partial.confirmReadings ?? DEFAULT_CONFIRM_READINGS)),
  };
}

/** Distance the passenger must move beyond before a reset alert can fire again. */
export function rearmDistanceM(radiusM: number): number {
  return radiusM + Math.max(30, radiusM * 0.25);
}

export function createAlertState(options: { triggered?: boolean; armed?: boolean } = {}): AlertState {
  return {
    triggered: options.triggered ?? false,
    armed: options.armed ?? true,
    consecutiveInside: 0,
    lastDistanceM: null,
    lastAccuracyM: null,
    lastFixAt: null,
    closestDistanceM: null,
  };
}

export function evaluateReading(
  state: AlertState,
  reading: PositionReading,
  destination: LatLng,
  config: AlertConfig,
): AlertEvaluation {
  if (state.lastFixAt != null && reading.timestamp < state.lastFixAt) {
    return { state, outcome: 'ignored-stale', distanceM: state.lastDistanceM };
  }

  const distanceM = haversineDistanceM(reading, destination);
  const accuracy = reading.accuracyM != null && Number.isFinite(reading.accuracyM) ? Math.max(0, reading.accuracyM) : null;

  if (accuracy != null && accuracy > config.maxAccuracyM) {
    // Keep the counter as it is: a bad fix is neither evidence for nor against being inside.
    return {
      state: { ...state, lastAccuracyM: accuracy },
      outcome: 'ignored-inaccurate',
      distanceM,
    };
  }

  const base: AlertState = {
    ...state,
    lastDistanceM: distanceM,
    lastAccuracyM: accuracy,
    lastFixAt: reading.timestamp,
    closestDistanceM: state.closestDistanceM == null ? distanceM : Math.min(state.closestDistanceM, distanceM),
  };

  if (state.triggered) {
    return { state: { ...base, consecutiveInside: 0 }, outcome: 'already-triggered', distanceM };
  }

  if (!state.armed) {
    if (distanceM > rearmDistanceM(config.radiusM)) {
      return { state: { ...base, armed: true, consecutiveInside: 0 }, outcome: 'rearmed', distanceM };
    }
    return { state: { ...base, consecutiveInside: 0 }, outcome: 'waiting-to-rearm', distanceM };
  }

  if (distanceM > config.radiusM) {
    return { state: { ...base, consecutiveInside: 0 }, outcome: 'outside', distanceM };
  }

  const consecutiveInside = state.consecutiveInside + 1;
  const confidentlyInside = distanceM + (accuracy ?? 0) <= config.radiusM;
  if (confidentlyInside || consecutiveInside >= config.confirmReadings) {
    return {
      state: { ...base, triggered: true, consecutiveInside: 0 },
      outcome: 'triggered',
      distanceM,
    };
  }
  return { state: { ...base, consecutiveInside }, outcome: 'pending-confirmation', distanceM };
}

/**
 * Re-arms the alert after the passenger dismissed it and asked to be alerted
 * again. If they are still near the stop, it waits until they move away first.
 */
export function resetAlert(state: AlertState, config: AlertConfig): AlertState {
  const stillNear = state.lastDistanceM != null && state.lastDistanceM <= rearmDistanceM(config.radiusM);
  return { ...state, triggered: false, armed: !stillNear, consecutiveInside: 0 };
}

/** Called when a paused journey resumes: earlier inside readings no longer count. */
export function resumeAlertState(state: AlertState): AlertState {
  return { ...state, consecutiveInside: 0 };
}
