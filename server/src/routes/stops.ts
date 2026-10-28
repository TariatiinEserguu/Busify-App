import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  boundingBox,
  haversineDistanceM,
  latitudeSchema,
  longitudeSchema,
  PERMISSIONS,
  stopSchema,
} from '@busify/shared';
import { audit } from '../lib/audit';
import { conflict, idParam, notFound, parse } from '../lib/http';
import { prisma } from '../lib/prisma';
import { hasPermission, requireAuth, requirePermission } from '../middleware/auth';
import { compactRoutePositions, normalizeSearch } from '../services/routeService';

export const stopsRouter = Router();

const stopInclude = {
  routes: {
    include: { route: { select: { id: true, number: true, name: true, color: true, status: true } } },
    orderBy: { route: { number: 'asc' } },
  },
} satisfies Prisma.StopInclude;

type StopRow = Prisma.StopGetPayload<{ include: typeof stopInclude }>;

function toStop(stop: StopRow, showAllRoutes: boolean) {
  return {
    id: stop.id,
    code: stop.code,
    name: stop.name,
    description: stop.description,
    latitude: stop.latitude,
    longitude: stop.longitude,
    isDemo: stop.isDemo,
    createdAt: stop.createdAt,
    updatedAt: stop.updatedAt,
    routes: stop.routes
      .filter((rs) => showAllRoutes || rs.route.status === 'ACTIVE')
      .map((rs) => ({ ...rs.route, position: rs.position })),
  };
}

const listQuery = z.object({ search: z.string().max(100).optional() });

/** GET /api/stops?search= — all stops with the routes that serve them. */
stopsRouter.get('/', requireAuth, async (req, res) => {
  const { search } = parse(listQuery, req.query);
  const showAll = hasPermission(req, PERMISSIONS.STOPS_MANAGE);
  const stops = await prisma.stop.findMany({ include: stopInclude, orderBy: { name: 'asc' } });
  const term = search ? normalizeSearch(search) : '';
  const filtered = term
    ? stops.filter((s) => normalizeSearch(s.name).includes(term) || (s.code && normalizeSearch(s.code).includes(term)))
    : stops;
  res.json({ stops: filtered.map((s) => toStop(s, showAll)) });
});

const nearbyQuery = z.object({
  lat: latitudeSchema,
  lng: longitudeSchema,
  radiusM: z.coerce.number().int().min(50).max(20_000).default(1500),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

/** GET /api/stops/nearby?lat=&lng=&radiusM=&limit= — closest stops, nearest first. */
stopsRouter.get('/nearby', requireAuth, async (req, res) => {
  const q = parse(nearbyQuery, req.query);
  const center = { lat: q.lat, lng: q.lng };
  const box = boundingBox(center, q.radiusM);
  const candidates = await prisma.stop.findMany({
    where: {
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
    },
    include: stopInclude,
  });
  const showAll = hasPermission(req, PERMISSIONS.STOPS_MANAGE);
  const stops = candidates
    .map((s) => ({ ...toStop(s, showAll), distanceM: haversineDistanceM(center, { lat: s.latitude, lng: s.longitude }) }))
    .filter((s) => s.distanceM <= q.radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, q.limit);
  res.json({ stops });
});

/** GET /api/stops/:id */
stopsRouter.get('/:id', requireAuth, async (req, res) => {
  const stop = await prisma.stop.findUnique({ where: { id: idParam(req.params.id, 'Stop') }, include: stopInclude });
  if (!stop) throw notFound('Stop');
  res.json({ stop: toStop(stop, hasPermission(req, PERMISSIONS.STOPS_MANAGE)) });
});

async function assertCodeFree(code: string | null, exceptId?: number) {
  if (!code) return;
  const existing = await prisma.stop.findUnique({ where: { code }, select: { id: true } });
  if (existing && existing.id !== exceptId) {
    throw conflict(`Stop code ${code} is already used by another stop.`, 'CONFLICT', {
      issues: [{ path: 'code', message: 'This stop code is already in use' }],
    });
  }
}

function stopData(input: z.output<typeof stopSchema>) {
  return {
    name: input.name,
    code: input.code ? input.code.toUpperCase() : null,
    description: input.description ?? '',
    latitude: Number(input.latitude.toFixed(7)),
    longitude: Number(input.longitude.toFixed(7)),
  };
}

/** POST /api/stops */
stopsRouter.post('/', requirePermission(PERMISSIONS.STOPS_MANAGE), async (req, res) => {
  const data = stopData(parse(stopSchema, req.body));
  await assertCodeFree(data.code);
  const stop = await prisma.stop.create({ data, include: stopInclude });
  await audit(req, {
    action: 'stop.create',
    entityType: 'stop',
    entityId: stop.id,
    summary: `Created stop ${stop.name} (${stop.latitude}, ${stop.longitude})`,
  });
  res.status(201).json({ stop: toStop(stop, true) });
});

/** PUT /api/stops/:id */
stopsRouter.put('/:id', requirePermission(PERMISSIONS.STOPS_MANAGE), async (req, res) => {
  const id = idParam(req.params.id, 'Stop');
  const before = await prisma.stop.findUnique({ where: { id } });
  if (!before) throw notFound('Stop');
  const data = stopData(parse(stopSchema, req.body));
  await assertCodeFree(data.code, id);
  const stop = await prisma.stop.update({ where: { id }, data, include: stopInclude });
  const changed = (Object.keys(data) as Array<keyof typeof data>).filter((k) => before[k] !== data[k]);
  await audit(req, {
    action: 'stop.update',
    entityType: 'stop',
    entityId: id,
    summary: `Updated stop ${stop.name}${changed.length ? ` (${changed.join(', ')})` : ''}`,
    metadata: Object.fromEntries(changed.map((k) => [k, { from: before[k], to: data[k] }])),
  });
  res.json({ stop: toStop(stop, true) });
});

/** DELETE /api/stops/:id — removes it from every route and closes the gap in stop order. */
stopsRouter.delete('/:id', requirePermission(PERMISSIONS.STOPS_MANAGE), async (req, res) => {
  const id = idParam(req.params.id, 'Stop');
  const stop = await prisma.stop.findUnique({ where: { id }, include: { routes: { select: { routeId: true } } } });
  if (!stop) throw notFound('Stop');
  const routeIds = stop.routes.map((r) => r.routeId);
  await prisma.$transaction(async (tx) => {
    await tx.stop.delete({ where: { id } });
    for (const routeId of routeIds) await compactRoutePositions(tx, routeId);
  });
  await audit(req, {
    action: 'stop.delete',
    entityType: 'stop',
    entityId: id,
    summary: `Deleted stop ${stop.name}${routeIds.length ? `; removed from ${routeIds.length} route(s)` : ''}`,
  });
  res.status(204).end();
});
