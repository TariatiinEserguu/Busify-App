/**
 * GPS simulator: produces position readings that move along a route at a
 * chosen speed, so the alert can be demonstrated without travelling.
 * Movement follows straight lines between stops (real roads are not known).
 * Readings go through exactly the same alert engine as real GPS fixes.
 */
import {
  EARTH_RADIUS_M,
  haversineDistanceM,
  offsetPoint,
  pathLengthM,
  pointAlongPath,
  toRadians,
  type LatLng,
  type PositionReading,
} from '@busify/shared';

export interface SimStop {
  latitude: number;
  longitude: number;
}

export const SIM_SPEEDS = [
  { kmh: 20, label: 'Slow traffic · 20 km/h' },
  { kmh: 40, label: 'City bus · 40 km/h' },
  { kmh: 60, label: 'Express · 60 km/h' },
  { kmh: 180, label: 'Fast-forward · 180 km/h' },
] as const;

export const SIM_TICK_MS = 1000;
const APPROACH_M = 1200;

const toLatLng = (s: SimStop): LatLng => ({ lat: s.latitude, lng: s.longitude });

/** The point `distanceM` metres beyond `b`, continuing in the direction a → b. */
export function extendBeyond(a: LatLng, b: LatLng, distanceM: number): LatLng {
  const north = toRadians(b.lat - a.lat) * EARTH_RADIUS_M;
  const east = toRadians(b.lng - a.lng) * EARTH_RADIUS_M * Math.cos(toRadians(b.lat));
  const length = Math.hypot(north, east);
  if (length === 0) return offsetPoint(b, distanceM, 0);
  return offsetPoint(b, (north / length) * distanceM, (east / length) * distanceM);
}

export interface SimulationPath {
  path: LatLng[];
  /** Distance along `path` at which the destination stop is reached. */
  destinationAlongM: number;
  totalM: number;
}

/**
 * Path from the chosen starting stop to the destination, continuing a little
 * past it (as a bus would if nobody got off).
 */
export function buildSimulationPath(
  stops: SimStop[],
  startIndex: number,
  destinationIndex: number,
  overshootM = 300,
): SimulationPath {
  if (stops.length === 0 || destinationIndex < 0 || destinationIndex >= stops.length) {
    throw new RangeError('buildSimulationPath: destination is not on the route');
  }
  const dest = toLatLng(stops[destinationIndex]);
  let path: LatLng[];

  if (startIndex >= 0 && startIndex < destinationIndex) {
    path = stops.slice(startIndex, destinationIndex + 1).map(toLatLng);
  } else {
    // No earlier stop to start from: approach from behind the destination,
    // on the opposite side from the next stop the bus is heading to.
    const next = destinationIndex + 1 < stops.length ? toLatLng(stops[destinationIndex + 1]) : null;
    const start = next ? extendBeyond(next, dest, APPROACH_M) : offsetPoint(dest, -APPROACH_M, 0);
    path = [start, dest];
  }

  const destinationAlongM = pathLengthM(path);
  const next = stops[destinationIndex + 1];
  let overshoot: LatLng;
  if (next) {
    const nextPoint = toLatLng(next);
    const segment = haversineDistanceM(dest, nextPoint);
    overshoot = pointAlongPath([dest, nextPoint], Math.min(overshootM, segment)).point;
  } else {
    overshoot = extendBeyond(path[path.length - 2], dest, overshootM);
  }
  path.push(overshoot);
  return { path, destinationAlongM, totalM: pathLengthM(path) };
}

/** A fake GPS fix `distanceAlongM` along the path, scattered by up to `jitterM` metres. */
export function simulatedReading(
  path: LatLng[],
  distanceAlongM: number,
  jitterM: number,
  random: () => number = Math.random,
  timestamp = Date.now(),
): PositionReading & { finished: boolean } {
  const { point, finished } = pointAlongPath(path, distanceAlongM);
  let lat = point.lat;
  let lng = point.lng;
  if (jitterM > 0) {
    const r = jitterM * Math.sqrt(random());
    const theta = random() * 2 * Math.PI;
    const p = offsetPoint(point, r * Math.cos(theta), r * Math.sin(theta));
    lat = p.lat;
    lng = p.lng;
  }
  return { lat, lng, accuracyM: jitterM > 0 ? Math.round(jitterM * 1.2) : 5, timestamp, finished };
}

/** Small deterministic random generator for repeatable tests. */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
