import { describe, expect, it } from 'vitest';
import { createAlertConfig, createAlertState, evaluateReading, haversineDistanceM } from '@busify/shared';
import { buildSimulationPath, seededRandom, simulatedReading, SIM_TICK_MS } from './simulator';

// Five stops ~700 m apart heading north.
const stops = Array.from({ length: 5 }, (_, i) => ({ latitude: 47.9 + i * 0.0063, longitude: 106.9 }));
const dest = (i: number) => ({ lat: stops[i].latitude, lng: stops[i].longitude });

describe('buildSimulationPath', () => {
  it('runs from the start stop through the destination and slightly beyond', () => {
    const { path, destinationAlongM, totalM } = buildSimulationPath(stops, 0, 3, 300);
    expect(path).toHaveLength(5);
    expect(path[3]).toEqual(dest(3));
    expect(destinationAlongM).toBeGreaterThan(2000);
    expect(totalM - destinationAlongM).toBeCloseTo(300, 0);
  });

  it('extends past the last stop of the route', () => {
    const { path, destinationAlongM, totalM } = buildSimulationPath(stops, 2, 4, 250);
    expect(path).toHaveLength(4);
    expect(totalM - destinationAlongM).toBeCloseTo(250, 0);
    expect(path[3].lat).toBeGreaterThan(dest(4).lat); // still heading north
  });

  it('approaches the first stop from behind when there is no earlier stop', () => {
    const { path, destinationAlongM } = buildSimulationPath(stops, 0, 0);
    expect(destinationAlongM).toBeCloseTo(1200, 0);
    expect(path[0].lat).toBeLessThan(dest(0).lat); // starts south, opposite to the next stop
    expect(path[1]).toEqual(dest(0));
  });

  it('rejects a destination outside the route', () => {
    expect(() => buildSimulationPath(stops, 0, 9)).toThrow(RangeError);
  });
});

describe('simulatedReading', () => {
  const { path } = buildSimulationPath(stops, 0, 3);

  it('stays on the path without jitter', () => {
    const r = simulatedReading(path, 700, 0);
    expect(haversineDistanceM(r, dest(1))).toBeLessThan(5);
    expect(r.accuracyM).toBe(5);
  });

  it('scatters readings within the jitter radius and reports matching accuracy', () => {
    const random = seededRandom(7);
    for (let i = 0; i < 50; i++) {
      const exact = simulatedReading(path, 500, 0);
      const noisy = simulatedReading(path, 500, 30, random);
      expect(haversineDistanceM(exact, noisy)).toBeLessThanOrEqual(30.5);
      expect(noisy.accuracyM).toBe(36);
    }
  });
});

describe('simulated trip through the alert engine', () => {
  it.each([20, 40, 180])('alerts exactly once, before reaching the stop, at %i km/h with GPS jitter', (kmh) => {
    const { path, destinationAlongM, totalM } = buildSimulationPath(stops, 0, 4);
    const config = createAlertConfig({ radiusM: 200, maxAccuracyM: 150, confirmReadings: 2 });
    const random = seededRandom(kmh);
    const step = (kmh / 3.6) * (SIM_TICK_MS / 1000);
    let state = createAlertState();
    let triggers = 0;
    let triggeredAt = Number.NaN;
    let t = 1_700_000_000_000;
    for (let along = 0; along <= totalM; along += step) {
      const reading = simulatedReading(path, along, 25, random, (t += SIM_TICK_MS));
      const result = evaluateReading(state, reading, dest(4), config);
      state = result.state;
      if (result.outcome === 'triggered') {
        triggers += 1;
        triggeredAt = along;
      }
    }
    expect(triggers).toBe(1);
    expect(triggeredAt).toBeLessThan(destinationAlongM);
    expect(destinationAlongM - triggeredAt).toBeLessThanOrEqual(200 + 25 + step);
  });
});
