import { describe, expect, it } from 'vitest';
import {
  clampRadius,
  createAlertConfig,
  createAlertState,
  evaluateReading,
  rearmDistanceM,
  resetAlert,
  resumeAlertState,
  type AlertConfig,
  type AlertOutcome,
  type AlertState,
  type PositionReading,
} from './alertEngine';
import { offsetPoint } from './geo';

const stop = { lat: 47.9185, lng: 106.9177 };
let clock = 1_700_000_000_000;

/** A reading `metersSouth` metres south of the stop with the given accuracy. */
function reading(metersSouth: number, accuracyM: number | null = 5): PositionReading {
  clock += 1000;
  return { ...offsetPoint(stop, -metersSouth, 0), accuracyM, timestamp: clock };
}

/** Feeds readings through the engine and returns the outcomes plus final state. */
function run(distances: Array<number | [number, number | null]>, config: AlertConfig, initial?: AlertState) {
  let state = initial ?? createAlertState();
  const outcomes: AlertOutcome[] = [];
  for (const item of distances) {
    const [d, acc] = Array.isArray(item) ? item : [item, 5];
    const result = evaluateReading(state, reading(d, acc), stop, config);
    state = result.state;
    outcomes.push(result.outcome);
  }
  return { state, outcomes, triggers: outcomes.filter((o) => o === 'triggered').length };
}

const config = createAlertConfig({ radiusM: 200, maxAccuracyM: 100, confirmReadings: 2 });

describe('alert radius', () => {
  it('uses 200 m by default', () => {
    expect(createAlertConfig().radiusM).toBe(200);
  });

  it('clamps configured radius into the allowed range', () => {
    expect(clampRadius(10)).toBe(50);
    expect(clampRadius(99_999)).toBe(2000);
    expect(clampRadius(Number.NaN)).toBe(200);
    expect(clampRadius(333.4)).toBe(333);
  });

  it('does not trigger while the passenger is outside the radius', () => {
    const { outcomes, state } = run([1500, 900, 400, 201], config);
    expect(outcomes).toEqual(['outside', 'outside', 'outside', 'outside']);
    expect(state.triggered).toBe(false);
  });

  it('triggers as soon as a reading is confidently inside the radius', () => {
    const { outcomes, state } = run([800, 400, 180], config);
    expect(outcomes).toEqual(['outside', 'outside', 'triggered']);
    expect(state.triggered).toBe(true);
  });

  it('respects a custom radius', () => {
    const wide = createAlertConfig({ radiusM: 500, maxAccuracyM: 100 });
    expect(run([700, 480], wide).outcomes).toEqual(['outside', 'triggered']);
    const narrow = createAlertConfig({ radiusM: 100, maxAccuracyM: 100 });
    expect(run([700, 180, 90], narrow).outcomes).toEqual(['outside', 'outside', 'triggered']);
  });

  it('requires confirmation when the accuracy circle crosses the boundary', () => {
    // 195 m away with ±20 m accuracy might really be 215 m away.
    const { outcomes } = run([[195, 20], [190, 20]], config);
    expect(outcomes).toEqual(['pending-confirmation', 'triggered']);
  });
});

describe('duplicate alert protection', () => {
  it('fires only once when readings fluctuate around the radius', () => {
    const fluctuating: Array<[number, number]> = [
      [205, 20], [195, 20], [210, 20], [190, 20], [185, 20], [205, 20], [180, 20], [215, 20], [150, 20], [220, 20], [100, 20],
    ];
    const { triggers, outcomes, state } = run(fluctuating, config);
    expect(triggers).toBe(1);
    expect(state.triggered).toBe(true);
    // Everything after the single trigger is reported as already triggered.
    const after = outcomes.slice(outcomes.indexOf('triggered') + 1);
    expect(after.every((o) => o === 'already-triggered')).toBe(true);
  });

  it('a single jittery inside reading between outside readings never triggers', () => {
    const { triggers } = run([[205, 25], [195, 25], [205, 25], [198, 25], [206, 25]], config);
    expect(triggers).toBe(0);
  });

  it('does not re-trigger a journey restored as already alerted (e.g. after page refresh)', () => {
    const restored = createAlertState({ triggered: true });
    const { triggers, outcomes } = run([150, 100, 50, 10], config, restored);
    expect(triggers).toBe(0);
    expect(outcomes.every((o) => o === 'already-triggered')).toBe(true);
  });

  it('after a reset near the stop, waits until the passenger leaves before re-arming', () => {
    let { state } = run([100], config);
    expect(state.triggered).toBe(true);

    state = resetAlert(state, config);
    expect(state.triggered).toBe(false);
    expect(state.armed).toBe(false);

    const rearmAt = rearmDistanceM(config.radiusM); // 250 m for a 200 m radius
    const second = run([120, 90, 60, rearmAt - 10, rearmAt + 20, 300, 150], config, state);
    expect(second.outcomes).toEqual([
      'waiting-to-rearm',
      'waiting-to-rearm',
      'waiting-to-rearm',
      'waiting-to-rearm',
      'rearmed',
      'outside',
      'triggered',
    ]);
    expect(second.triggers).toBe(1);
  });

  it('a reset far from the stop re-arms immediately', () => {
    let { state } = run([150], config);
    state = run([900], config, state).state; // moved away after the alert
    state = resetAlert(state, config);
    expect(state.armed).toBe(true);
    expect(run([400, 150], config, state).outcomes).toEqual(['outside', 'triggered']);
  });
});

describe('GPS reliability handling', () => {
  it('ignores readings that are less accurate than the configured maximum', () => {
    const { outcomes, state } = run([[50, 500], [20, 120]], config);
    expect(outcomes).toEqual(['ignored-inaccurate', 'ignored-inaccurate']);
    expect(state.triggered).toBe(false);
    expect(state.lastFixAt).toBeNull();
  });

  it('inaccurate readings do not reset the confirmation count', () => {
    const { outcomes } = run([[195, 20], [10, 400], [190, 20]], config);
    expect(outcomes).toEqual(['pending-confirmation', 'ignored-inaccurate', 'triggered']);
  });

  it('ignores readings delivered out of order', () => {
    let state = createAlertState();
    const newer = reading(800);
    const older = { ...reading(100), timestamp: newer.timestamp - 5000 };
    state = evaluateReading(state, newer, stop, config).state;
    const result = evaluateReading(state, older, stop, config);
    expect(result.outcome).toBe('ignored-stale');
    expect(result.state.triggered).toBe(false);
  });

  it('treats readings without accuracy information at face value', () => {
    expect(run([[150, null]], config).outcomes).toEqual(['triggered']);
  });

  it('clears pending confirmations when a paused journey resumes', () => {
    const { state } = run([[195, 20]], config);
    expect(state.consecutiveInside).toBe(1);
    const resumed = resumeAlertState(state);
    expect(resumed.consecutiveInside).toBe(0);
    expect(run([[205, 20], [195, 20]], config, resumed).triggers).toBe(0);
  });

  it('tracks the latest and closest distance for display', () => {
    const { state } = run([900, 600, 450, 700], config);
    expect(state.lastDistanceM).toBeCloseTo(700, 0);
    expect(state.closestDistanceM).toBeCloseTo(450, 0);
  });
});
