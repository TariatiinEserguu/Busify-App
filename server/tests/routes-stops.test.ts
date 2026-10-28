import { beforeEach, describe, expect, it } from 'vitest';
import { createRoute, prisma, resetDatabase, signedIn } from './helpers';

beforeEach(resetDatabase);

describe('stop validation', () => {
  it('creates a stop with valid coordinates', async () => {
    const { client } = await signedIn('ADMIN');
    const res = await client.post('/api/stops', {
      name: 'Central Plaza',
      code: 'cp-01',
      latitude: '47.9187',
      longitude: 106.908,
      description: 'North side',
    });
    expect(res.status).toBe(201);
    expect(res.body.stop).toMatchObject({ name: 'Central Plaza', code: 'CP-01', latitude: 47.9187, longitude: 106.908 });
  });

  it.each([
    [{ latitude: 91, longitude: 106.9 }, 'latitude'],
    [{ latitude: -90.5, longitude: 106.9 }, 'latitude'],
    [{ latitude: 47.9, longitude: 180.01 }, 'longitude'],
    [{ latitude: 'abc', longitude: 106.9 }, 'latitude'],
    [{ latitude: 0, longitude: 0 }, 'latitude'],
  ])('rejects invalid coordinates %o', async (coords, path) => {
    const { client } = await signedIn('ADMIN');
    const res = await client.post('/api/stops', { name: 'Bad stop', ...coords });
    expect(res.status).toBe(400);
    expect(res.body.error.issues.map((i: { path: string }) => i.path)).toContain(path);
  });

  it('requires a name and rejects duplicate stop codes', async () => {
    const { client } = await signedIn('ADMIN');
    expect((await client.post('/api/stops', { name: '', latitude: 47.9, longitude: 106.9 })).status).toBe(400);
    expect((await client.post('/api/stops', { name: 'One', code: 'X1', latitude: 47.9, longitude: 106.9 })).status).toBe(201);
    const dup = await client.post('/api/stops', { name: 'Two', code: 'x1', latitude: 47.91, longitude: 106.9 });
    expect(dup.status).toBe(409);
    expect(dup.body.error.issues[0].path).toBe('code');
  });

  it('updates coordinates and records the change in the audit log', async () => {
    const { client } = await signedIn('ADMIN');
    const created = await client.post('/api/stops', { name: 'Move me', latitude: 47.9, longitude: 106.9 });
    const res = await client.put(`/api/stops/${created.body.stop.id}`, { name: 'Move me', latitude: 47.905, longitude: 106.9 });
    expect(res.status).toBe(200);
    expect(res.body.stop.latitude).toBe(47.905);
    const log = await prisma.auditLog.findFirst({ where: { action: 'stop.update' } });
    expect(log?.summary).toMatch(/latitude/);
  });
});

describe('route validation and stop order', () => {
  it('creates a route with defaults and rejects bad fields', async () => {
    const { client } = await signedIn('ADMIN');
    const ok = await client.post('/api/routes', { number: 'd1', name: 'Demo line', headwayMinutes: 10, firstDeparture: '06:00' });
    expect(ok.status).toBe(201);
    expect(ok.body.route).toMatchObject({ number: 'D1', status: 'ACTIVE', headwayMinutes: 10, stops: [] });

    const bad = await client.post('/api/routes', { number: 'D 2', name: 'x', color: 'red', status: 'MAYBE', lastDeparture: '24:10' });
    expect(bad.status).toBe(400);
    const paths = bad.body.error.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['number', 'name', 'color', 'status', 'lastDeparture']));
  });

  it('rejects a duplicate route number', async () => {
    const { client } = await signedIn('ADMIN');
    await client.post('/api/routes', { number: 'D1', name: 'First' });
    const dup = await client.post('/api/routes', { number: 'd1', name: 'Second' });
    expect(dup.status).toBe(409);
  });

  it('stores and returns stops in the given order', async () => {
    const { client } = await signedIn('ADMIN');
    const route = (await client.post('/api/routes', { number: 'R1', name: 'Ordered' })).body.route;
    const ids: number[] = [];
    for (const [i, name] of ['Alpha', 'Bravo', 'Charlie'].entries()) {
      ids.push((await client.post('/api/stops', { name, latitude: 47.9 + i / 100, longitude: 106.9 })).body.stop.id);
    }
    const order = [ids[2], ids[0], ids[1]];
    const res = await client.put(`/api/routes/${route.id}/stops`, { stopIds: order });
    expect(res.status).toBe(200);
    expect(res.body.route.stops.map((s: { name: string }) => s.name)).toEqual(['Charlie', 'Alpha', 'Bravo']);
    expect(res.body.route.stops.map((s: { position: number }) => s.position)).toEqual([1, 2, 3]);

    const reread = await client.get(`/api/routes/${route.id}`);
    expect(reread.body.route.stops.map((s: { id: number }) => s.id)).toEqual(order);
  });

  it('rejects duplicate and unknown stops in the order', async () => {
    const { client } = await signedIn('ADMIN');
    const { route, stops } = await createRoute();
    expect((await client.put(`/api/routes/${route.id}/stops`, { stopIds: [stops[0].id, stops[0].id] })).status).toBe(400);
    expect((await client.put(`/api/routes/${route.id}/stops`, { stopIds: [stops[0].id, 99_999] })).status).toBe(400);
  });

  it('closes the gap in stop order when a stop is deleted', async () => {
    const { client } = await signedIn('ADMIN');
    const { route, stops } = await createRoute({ stops: 4 });
    expect((await client.delete(`/api/stops/${stops[1].id}`)).status).toBe(204);
    const res = await client.get(`/api/routes/${route.id}`);
    expect(res.body.route.stops.map((s: { position: number }) => s.position)).toEqual([1, 2, 3]);
    expect(res.body.route.stops.map((s: { id: number }) => s.id)).toEqual([stops[0].id, stops[2].id, stops[3].id]);
  });
});

describe('what passengers can see', () => {
  it('lists only routes in service and hides others by id', async () => {
    const active = await createRoute({ number: 'P1' });
    const suspended = await createRoute({ number: 'P2', status: 'INACTIVE' });
    const draft = await createRoute({ number: 'P3', status: 'DRAFT' });
    const { client } = await signedIn('PASSENGER');

    const list = await client.get('/api/routes?includeInactive=true');
    expect(list.body.routes.map((r: { number: string }) => r.number)).toEqual(['P1']);
    expect((await client.get(`/api/routes/${active.route.id}`)).status).toBe(200);
    expect((await client.get(`/api/routes/${suspended.route.id}`)).status).toBe(404);
    expect((await client.get(`/api/routes/${draft.route.id}`)).status).toBe(404);

    const { client: admin } = await signedIn('ADMIN');
    const all = await admin.get('/api/routes?includeInactive=true');
    expect(all.body.routes).toHaveLength(3);
  });

  it('searches by route number, route name and stop name', async () => {
    const { route } = await createRoute({ number: '12A' });
    await prisma.route.update({ where: { id: route.id }, data: { name: 'Төв талбай чиглэл' } });
    const { stops } = await createRoute({ number: '30' });
    await prisma.stop.update({ where: { id: stops[2].id }, data: { name: 'University Gate' } });
    const { client } = await signedIn('PASSENGER');

    const byNumber = await client.get('/api/routes?search=12a');
    expect(byNumber.body.routes.map((r: { number: string }) => r.number)).toEqual(['12A']);
    const byCyrillicName = await client.get(`/api/routes?search=${encodeURIComponent('ТӨВ')}`);
    expect(byCyrillicName.body.routes.map((r: { number: string }) => r.number)).toEqual(['12A']);
    const byStop = await client.get('/api/routes?search=university');
    expect(byStop.body.routes.map((r: { number: string }) => r.number)).toEqual(['30']);
  });

  it('finds nearby stops sorted by distance', async () => {
    await createRoute({ stops: 5 });
    const { client } = await signedIn('PASSENGER');
    const res = await client.get('/api/stops/nearby?lat=47.9&lng=106.9&radiusM=1500');
    expect(res.status).toBe(200);
    const distances = res.body.stops.map((s: { distanceM: number }) => s.distanceM);
    expect(distances.length).toBeGreaterThanOrEqual(2);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
    expect(distances.every((d: number) => d <= 1500)).toBe(true);
    expect((await client.get('/api/stops/nearby?lat=200&lng=106.9')).status).toBe(400);
  });
});

describe('deleting a route', () => {
  it('ends active journeys but keeps their history', async () => {
    const { route, stops } = await createRoute();
    const { client: passenger } = await signedIn('PASSENGER');
    const started = await passenger.post('/api/journeys', { routeId: route.id, destinationStopId: stops[3].id });
    expect(started.status).toBe(201);

    const { client: admin } = await signedIn('ADMIN');
    expect((await admin.delete(`/api/routes/${route.id}`)).status).toBe(204);

    const journey = await prisma.journey.findUniqueOrThrow({ where: { id: started.body.journey.id } });
    expect(journey).toMatchObject({ status: 'CANCELLED', endReason: 'ROUTE_REMOVED', routeId: null });
    expect(journey.routeNumber).toBe(route.number);
    expect((await passenger.get('/api/journeys/active')).body.journey).toBeNull();
  });
});
