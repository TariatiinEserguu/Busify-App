/**
 * Geographic helpers used by both the browser (journey tracking, simulator)
 * and the server (nearby stops, validation).
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Mean Earth radius in metres (IUGG). */
export const EARTH_RADIUS_M = 6_371_008.8;

export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

export function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isValidCoordinate(point: Partial<LatLng> | null | undefined): point is LatLng {
  return !!point && isValidLatitude(point.lat) && isValidLongitude(point.lng);
}

/**
 * Great-circle distance between two points using the haversine formula.
 * Accurate to well under a metre at bus-stop scales, which is far better
 * than consumer GPS.
 */
export function haversineDistanceM(a: LatLng, b: LatLng): number {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) {
    throw new RangeError('haversineDistanceM: invalid coordinate');
  }
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  // Clamp protects against floating point drift pushing h slightly above 1.
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Human readable distance: "35 m", "850 m", "1.2 km", "12 km". */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return '—';
  if (meters < 1000) {
    const rounded = meters < 100 ? Math.round(meters) : Math.round(meters / 10) * 10;
    return `${rounded} m`;
  }
  const km = meters / 1000;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

/** Linear interpolation between two points. Fine for the short hops between stops. */
export function interpolate(a: LatLng, b: LatLng, t: number): LatLng {
  const k = Math.max(0, Math.min(1, t));
  return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
}

/** Moves a point by the given offsets in metres (north and east positive). */
export function offsetPoint(point: LatLng, northM: number, eastM: number): LatLng {
  const dLat = toDegrees(northM / EARTH_RADIUS_M);
  const dLng = toDegrees(eastM / (EARTH_RADIUS_M * Math.cos(toRadians(point.lat))));
  return { lat: point.lat + dLat, lng: point.lng + dLng };
}

/** Total length of a polyline in metres. */
export function pathLengthM(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineDistanceM(points[i - 1], points[i]);
  return total;
}

export interface PathPosition {
  point: LatLng;
  /** Index of the segment start the point lies on. */
  segmentIndex: number;
  /** True when distanceM reached or passed the end of the path. */
  finished: boolean;
}

/** Point located `distanceM` metres along a polyline (clamped to its ends). */
export function pointAlongPath(points: LatLng[], distanceM: number): PathPosition {
  if (points.length === 0) throw new RangeError('pointAlongPath: empty path');
  if (points.length === 1 || distanceM <= 0) {
    return { point: points[0], segmentIndex: 0, finished: points.length === 1 };
  }
  let remaining = distanceM;
  for (let i = 1; i < points.length; i++) {
    const segment = haversineDistanceM(points[i - 1], points[i]);
    if (remaining <= segment) {
      return {
        point: interpolate(points[i - 1], points[i], segment === 0 ? 1 : remaining / segment),
        segmentIndex: i - 1,
        finished: false,
      };
    }
    remaining -= segment;
  }
  return { point: points[points.length - 1], segmentIndex: points.length - 2, finished: true };
}

/** Axis-aligned bounding box around a point, used to pre-filter nearby stops in SQL. */
export function boundingBox(center: LatLng, radiusM: number) {
  const dLat = toDegrees(radiusM / EARTH_RADIUS_M);
  const dLng = toDegrees(radiusM / (EARTH_RADIUS_M * Math.max(Math.cos(toRadians(center.lat)), 1e-6)));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}
