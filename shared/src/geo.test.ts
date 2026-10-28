import { describe, expect, it } from 'vitest';
import {
  boundingBox,
  formatDistance,
  haversineDistanceM,
  isValidCoordinate,
  offsetPoint,
  pathLengthM,
  pointAlongPath,
} from './geo';

describe('haversineDistanceM', () => {
  it('returns 0 for identical points', () => {
    const p = { lat: 47.9185, lng: 106.9177 };
    expect(haversineDistanceM(p, p)).toBe(0);
  });

  it('matches the known length of one degree of latitude (~111.2 km)', () => {
    const d = haversineDistanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111_150);
    expect(d).toBeLessThan(111_250);
  });

  it('matches a known city-pair distance (London to Paris ≈ 343.5 km)', () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };
    expect(haversineDistanceM(london, paris) / 1000).toBeCloseTo(343.5, 0);
  });

  it('is symmetric', () => {
    const a = { lat: 47.91, lng: 106.88 };
    const b = { lat: 47.93, lng: 106.95 };
    expect(haversineDistanceM(a, b)).toBeCloseTo(haversineDistanceM(b, a), 6);
  });

  it('handles the antimeridian', () => {
    const d = haversineDistanceM({ lat: 0, lng: 179.999 }, { lat: 0, lng: -179.999 });
    expect(d).toBeLessThan(300);
  });

  it('measures short bus-stop scale distances precisely', () => {
    const stop = { lat: 47.9185, lng: 106.9177 };
    const north200 = offsetPoint(stop, 200, 0);
    expect(haversineDistanceM(stop, north200)).toBeCloseTo(200, 0);
    const east150 = offsetPoint(stop, 0, 150);
    expect(haversineDistanceM(stop, east150)).toBeCloseTo(150, 0);
  });

  it('rejects invalid coordinates', () => {
    expect(() => haversineDistanceM({ lat: 91, lng: 0 }, { lat: 0, lng: 0 })).toThrow(RangeError);
    expect(() => haversineDistanceM({ lat: Number.NaN, lng: 0 }, { lat: 0, lng: 0 })).toThrow(RangeError);
  });
});

describe('isValidCoordinate', () => {
  it('accepts valid and rejects out-of-range values', () => {
    expect(isValidCoordinate({ lat: 47.9, lng: 106.9 })).toBe(true);
    expect(isValidCoordinate({ lat: -90, lng: 180 })).toBe(true);
    expect(isValidCoordinate({ lat: 90.0001, lng: 0 })).toBe(false);
    expect(isValidCoordinate({ lat: 0, lng: -180.5 })).toBe(false);
    expect(isValidCoordinate({ lat: 0 })).toBe(false);
    expect(isValidCoordinate(null)).toBe(false);
  });
});

describe('formatDistance', () => {
  it('formats metres and kilometres', () => {
    expect(formatDistance(35.4)).toBe('35 m');
    expect(formatDistance(847)).toBe('850 m');
    expect(formatDistance(1234)).toBe('1.2 km');
    expect(formatDistance(15_400)).toBe('15 km');
    expect(formatDistance(null)).toBe('—');
  });
});

describe('paths', () => {
  const a = { lat: 47.9, lng: 106.9 };
  const b = offsetPoint(a, 0, 1000);
  const c = offsetPoint(b, 500, 0);

  it('sums segment lengths', () => {
    expect(pathLengthM([a, b, c])).toBeCloseTo(1500, 0);
  });

  it('finds a point along the path', () => {
    const mid = pointAlongPath([a, b, c], 500);
    expect(mid.segmentIndex).toBe(0);
    expect(haversineDistanceM(a, mid.point)).toBeCloseTo(500, 0);
    const second = pointAlongPath([a, b, c], 1250);
    expect(second.segmentIndex).toBe(1);
    expect(haversineDistanceM(b, second.point)).toBeCloseTo(250, 0);
  });

  it('clamps to the end and reports finished', () => {
    const end = pointAlongPath([a, b, c], 99_999);
    expect(end.finished).toBe(true);
    expect(end.point).toEqual(c);
  });

  it('builds a bounding box that contains the radius', () => {
    const box = boundingBox(a, 1000);
    expect(box.minLat).toBeLessThan(a.lat);
    expect(box.maxLng).toBeGreaterThan(a.lng);
    expect(haversineDistanceM(a, { lat: box.maxLat, lng: a.lng })).toBeCloseTo(1000, 0);
  });
});
