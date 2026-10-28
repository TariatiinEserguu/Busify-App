import { beforeEach, describe, expect, it } from 'vitest';
import { createRoute, prisma, resetDatabase, signedIn } from './helpers';

beforeEach(resetDatabase);

async function setup() {
  const network = await createRoute({ stops: 5 });
  const passenger = await signedIn('PASSENGER');
  return { ...network, ...passenger };
}

describe('starting a journey', () => {
  it('starts with the default 200 m radius and returns the route for the map', async () => {
    const { client, route, stops } = await setup();
    const res = await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id });
    expect(res.status).toBe(201);
    expect(res.body.journey).toMatchObject({
      status: 'ACTIVE',
      alertRadiusM: 200,
      destinationName: stops[4].name,
      destinationLat: stops[4].latitude,
      alertTriggeredAt: null,
    });
    expect(res.body.route.stops).toHaveLength(5);

    const active = await client.get('/api/journeys/active');
    expect(active.body.journey.id).toBe(res.body.journey.id);
    expect(active.body.route.id).toBe(route.id);
  });

  it('uses the radius from the passenger settings, or the one chosen for this journey', async () => {
    const { client, route, stops } = await setup();
    await client.put('/api/me/settings', {
      alertRadiusM: 350,
      soundEnabled: true,
      vibrationEnabled: false,
      notificationsEnabled: true,
      keepScreenAwake: true,
    });
    const fromSettings = await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[2].id });
    expect(fromSettings.body.journey.alertRadiusM).toBe(350);
    const custom = await client.post('/api/journeys', {
      routeId: route.id,
      destinationStopId: stops[3].id,
      alertRadiusM: 500,
      replaceActive: true,
    });
    expect(custom.body.journey.alertRadiusM).toBe(500);
  });

  it('rejects a destination that is not on the route and radii outside the allowed range', async () => {
    const { client, route } = await setup();
    const other = await createRoute();
    const wrongStop = await client.post('/api/journeys', { routeId: route.id, destinationStopId: other.stops[0].id });
    expect(wrongStop.status).toBe(400);
    expect(wrongStop.body.error.issues[0].path).toBe('destinationStopId');

    const tooSmall = await client.post('/api/journeys', { routeId: route.id, destinationStopId: (await prisma.routeStop.findFirstOrThrow({ where: { routeId: route.id } })).stopId, alertRadiusM: 10 });
    expect(tooSmall.status).toBe(400);
  });

  it('refuses routes that are not in service', async () => {
    const { client } = await setup();
    const inactive = await createRoute({ status: 'INACTIVE' });
    const res = await client.post('/api/journeys', { routeId: inactive.route.id, destinationStopId: inactive.stops[1].id });
    expect(res.status).toBe(400);
  });

  it('allows only one running journey per passenger', async () => {
    const { client, route, stops } = await setup();
    const first = await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[2].id });
    const second = await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[3].id });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ACTIVE_JOURNEY_EXISTS');

    const replaced = await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[3].id, replaceActive: true });
    expect(replaced.status).toBe(201);
    const old = await prisma.journey.findUniqueOrThrow({ where: { id: first.body.journey.id } });
    expect(old).toMatchObject({ status: 'CANCELLED', endReason: 'REPLACED' });
    expect(await prisma.journey.count({ where: { status: { in: ['ACTIVE', 'PAUSED'] } } })).toBe(1);
  });
});

describe('journey controls', () => {
  it('pauses, resumes and cancels, refusing invalid transitions', async () => {
    const { client, route, stops } = await setup();
    const id = (await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id })).body.journey.id;

    expect((await client.post(`/api/journeys/${id}/resume`)).status).toBe(409);
    const paused = await client.post(`/api/journeys/${id}/pause`);
    expect(paused.body.journey.status).toBe('PAUSED');
    expect((await client.post(`/api/journeys/${id}/progress`, { distanceM: 900 })).status).toBe(409);
    expect((await client.post(`/api/journeys/${id}/resume`)).body.journey.status).toBe('ACTIVE');
    const cancelled = await client.post(`/api/journeys/${id}/cancel`);
    expect(cancelled.body.journey).toMatchObject({ status: 'CANCELLED', endReason: 'CANCELLED_BY_USER' });
    expect((await client.post(`/api/journeys/${id}/pause`)).status).toBe(409);
    expect((await client.get('/api/journeys/active')).body.journey).toBeNull();
  });

  it('lets the passenger change the alert distance of a running journey', async () => {
    const { client, route, stops } = await setup();
    const id = (await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id })).body.journey.id;
    const res = await client.patch(`/api/journeys/${id}`, { alertRadiusM: 400 });
    expect(res.body.journey.alertRadiusM).toBe(400);
    expect((await client.patch(`/api/journeys/${id}`, { alertRadiusM: 5000 })).status).toBe(400);
  });

  it("hides other passengers' journeys", async () => {
    const { client, route, stops } = await setup();
    const id = (await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id })).body.journey.id;
    const { client: stranger } = await signedIn('PASSENGER');
    expect((await stranger.post(`/api/journeys/${id}/cancel`)).status).toBe(404);
    expect((await stranger.post(`/api/journeys/${id}/alert`, { distanceM: 100 })).status).toBe(404);
  });

  it('records progress heartbeats without storing raw coordinates', async () => {
    const { client, route, stops } = await setup();
    const id = (await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id })).body.journey.id;
    const res = await client.post(`/api/journeys/${id}/progress`, { distanceM: 812.5, accuracyM: 9, simulated: true });
    expect(res.body.journey).toMatchObject({ lastDistanceM: 812.5, lastAccuracyM: 9, usedSimulation: true });
  });
});

describe('alerts fire once per journey', () => {
  it('records the first alert and treats repeats as duplicates', async () => {
    const { client, route, stops } = await setup();
    const id = (await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id })).body.journey.id;

    const first = await client.post(`/api/journeys/${id}/alert`, { distanceM: 180, accuracyM: 8 });
    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBe(false);
    expect(first.body.journey.alertCount).toBe(1);
    expect(first.body.journey.alertTriggeredAt).not.toBeNull();

    // GPS jitter, a retry or a second tab reporting the same alert again:
    const repeats = await Promise.all([
      client.post(`/api/journeys/${id}/alert`, { distanceM: 150 }),
      client.post(`/api/journeys/${id}/alert`, { distanceM: 120 }),
    ]);
    for (const r of repeats) {
      expect(r.status).toBe(200);
      expect(r.body.duplicate).toBe(true);
    }
    const stored = await prisma.journey.findUniqueOrThrow({ where: { id } });
    expect(stored.alertCount).toBe(1);
    expect(stored.alertDistanceM).toBe(180);
  });

  it('can be re-armed explicitly, which allows exactly one more alert', async () => {
    const { client, route, stops } = await setup();
    const id = (await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id })).body.journey.id;
    expect((await client.post(`/api/journeys/${id}/reset-alert`)).status).toBe(409); // nothing to reset yet

    await client.post(`/api/journeys/${id}/alert`, { distanceM: 150 });
    const reset = await client.post(`/api/journeys/${id}/reset-alert`, { stillNearStop: true });
    expect(reset.body.journey).toMatchObject({ alertTriggeredAt: null, alertRearmPending: true });

    const again = await client.post(`/api/journeys/${id}/alert`, { distanceM: 140 });
    expect(again.body.duplicate).toBe(false);
    expect(again.body.journey.alertCount).toBe(2);
    expect((await client.post(`/api/journeys/${id}/alert`, { distanceM: 100 })).body.duplicate).toBe(true);
  });

  it('does not alert on a paused journey and rejects implausible distances', async () => {
    const { client, route, stops } = await setup();
    const id = (await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id })).body.journey.id;
    expect((await client.post(`/api/journeys/${id}/alert`, { distanceM: 5000 })).status).toBe(400);
    await client.post(`/api/journeys/${id}/pause`);
    expect((await client.post(`/api/journeys/${id}/alert`, { distanceM: 100 })).status).toBe(409);
  });

  it('keeps the alert state after a page refresh (it is stored on the server)', async () => {
    const { client, route, stops } = await setup();
    const id = (await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id })).body.journey.id;
    await client.post(`/api/journeys/${id}/alert`, { distanceM: 150 });
    const reloaded = await client.get('/api/journeys/active');
    expect(reloaded.body.journey.alertTriggeredAt).not.toBeNull();
  });

  it('completes the journey on arrival', async () => {
    const { client, route, stops } = await setup();
    const id = (await client.post('/api/journeys', { routeId: route.id, destinationStopId: stops[4].id })).body.journey.id;
    const done = await client.post(`/api/journeys/${id}/complete`);
    expect(done.body.journey).toMatchObject({ status: 'COMPLETED', endReason: 'ARRIVED' });
    const history = await client.get('/api/journeys');
    expect(history.body.journeys[0].id).toBe(id);
  });
});
