import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, routeSchema, routeStopsSchema } from '@busify/shared';
import { audit } from '../lib/audit';
import { badRequest, conflict, idParam, notFound, parse } from '../lib/http';
import { prisma } from '../lib/prisma';
import { hasPermission, requireAuth, requirePermission } from '../middleware/auth';
import {
  loadRoute,
  normalizeSearch,
  routeWithStopsInclude,
  toRouteDetail,
  toRouteSummary,
} from '../services/routeService';

export const busRoutesRouter = Router();

const listQuery = z.object({
  search: z.string().max(100).optional(),
  includeInactive: z.enum(['true', 'false']).optional(),
});

/**
 * GET /api/routes?search=&includeInactive=true
 * Passengers see routes in service; route managers may include suspended and draft routes.
 * Search matches route number, route name or the name of any stop on the route.
 */
busRoutesRouter.get('/', requireAuth, async (req, res) => {
  const query = parse(listQuery, req.query);
  const includeInactive = query.includeInactive === 'true' && hasPermission(req, PERMISSIONS.ROUTES_MANAGE);
  const routes = await prisma.route.findMany({
    where: includeInactive ? {} : { status: 'ACTIVE' },
    include: routeWithStopsInclude,
    orderBy: [{ number: 'asc' }],
  });

  const term = query.search ? normalizeSearch(query.search) : '';
  const matched = term
    ? routes.filter(
        (r) =>
          normalizeSearch(r.number).includes(term) ||
          normalizeSearch(r.name).includes(term) ||
          r.stops.some((s) => normalizeSearch(s.stop.name).includes(term)),
      )
    : routes;

  // Natural sort so "2" comes before "10".
  matched.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
  res.json({ routes: matched.map(toRouteSummary) });
});

/** GET /api/routes/:id — route with its stops in order. */
busRoutesRouter.get('/:id', requireAuth, async (req, res) => {
  const route = await loadRoute(idParam(req.params.id, 'Route'));
  if (!route || (route.status !== 'ACTIVE' && !hasPermission(req, PERMISSIONS.ROUTES_MANAGE))) {
    throw notFound('Route');
  }
  res.json({ route: toRouteDetail(route) });
});

function routeData(input: z.output<typeof routeSchema>) {
  return {
    number: input.number.toUpperCase(),
    name: input.name,
    description: input.description ?? '',
    status: input.status,
    color: input.color.toLowerCase(),
    firstDeparture: input.firstDeparture || null,
    lastDeparture: input.lastDeparture || null,
    headwayMinutes: input.headwayMinutes ?? null,
  };
}

async function assertNumberFree(number: string, exceptId?: number) {
  const existing = await prisma.route.findUnique({ where: { number: number.toUpperCase() }, select: { id: true } });
  if (existing && existing.id !== exceptId) {
    throw conflict(`Route number ${number.toUpperCase()} is already used by another route.`, 'CONFLICT', {
      issues: [{ path: 'number', message: 'This route number is already in use' }],
    });
  }
}

/** POST /api/routes */
busRoutesRouter.post('/', requirePermission(PERMISSIONS.ROUTES_MANAGE), async (req, res) => {
  const input = parse(routeSchema, req.body);
  await assertNumberFree(input.number);
  const created = await prisma.route.create({ data: routeData(input) });
  await audit(req, {
    action: 'route.create',
    entityType: 'route',
    entityId: created.id,
    summary: `Created route ${created.number} — ${created.name}`,
  });
  res.status(201).json({ route: toRouteDetail((await loadRoute(created.id))!) });
});

/** PUT /api/routes/:id */
busRoutesRouter.put('/:id', requirePermission(PERMISSIONS.ROUTES_MANAGE), async (req, res) => {
  const id = idParam(req.params.id, 'Route');
  const before = await prisma.route.findUnique({ where: { id } });
  if (!before) throw notFound('Route');
  const input = parse(routeSchema, req.body);
  await assertNumberFree(input.number, id);
  const data = routeData(input);
  await prisma.route.update({ where: { id }, data });

  const changed = (Object.keys(data) as Array<keyof typeof data>).filter((k) => before[k] !== data[k]);
  await audit(req, {
    action: 'route.update',
    entityType: 'route',
    entityId: id,
    summary: `Updated route ${data.number}${changed.length ? ` (${changed.join(', ')})` : ''}`,
    metadata: Object.fromEntries(changed.map((k) => [k, { from: before[k], to: data[k] }])),
  });
  res.json({ route: toRouteDetail((await loadRoute(id))!) });
});

/** PUT /api/routes/:id/stops — replaces the ordered stop list. */
busRoutesRouter.put('/:id/stops', requirePermission(PERMISSIONS.ROUTES_MANAGE), async (req, res) => {
  const id = idParam(req.params.id, 'Route');
  const route = await prisma.route.findUnique({ where: { id }, select: { id: true, number: true } });
  if (!route) throw notFound('Route');
  const { stopIds } = parse(routeStopsSchema, req.body);

  const found = await prisma.stop.findMany({ where: { id: { in: stopIds } }, select: { id: true } });
  if (found.length !== stopIds.length) {
    const known = new Set(found.map((s) => s.id));
    throw badRequest(`Unknown stop id(s): ${stopIds.filter((s) => !known.has(s)).join(', ')}`);
  }

  await prisma.$transaction([
    prisma.routeStop.deleteMany({ where: { routeId: id } }),
    prisma.routeStop.createMany({ data: stopIds.map((stopId, i) => ({ routeId: id, stopId, position: i + 1 })) }),
    prisma.route.update({ where: { id }, data: { updatedAt: new Date() } }),
  ]);
  await audit(req, {
    action: 'route.stops_update',
    entityType: 'route',
    entityId: id,
    summary: `Set ${stopIds.length} stops on route ${route.number}`,
    metadata: { stopIds },
  });
  res.json({ route: toRouteDetail((await loadRoute(id))!) });
});

/** DELETE /api/routes/:id — journeys keep their history; active ones on this route are ended. */
busRoutesRouter.delete('/:id', requirePermission(PERMISSIONS.ROUTES_MANAGE), async (req, res) => {
  const id = idParam(req.params.id, 'Route');
  const route = await prisma.route.findUnique({ where: { id }, select: { id: true, number: true, name: true } });
  if (!route) throw notFound('Route');

  const [ended] = await prisma.$transaction([
    prisma.journey.updateMany({
      where: { routeId: id, status: { in: ['ACTIVE', 'PAUSED'] } },
      data: { status: 'CANCELLED', endedAt: new Date(), endReason: 'ROUTE_REMOVED' },
    }),
    prisma.route.delete({ where: { id } }),
  ]);
  await audit(req, {
    action: 'route.delete',
    entityType: 'route',
    entityId: id,
    summary: `Deleted route ${route.number} — ${route.name}${ended.count ? `; ended ${ended.count} active journey(s)` : ''}`,
  });
  res.status(204).end();
});
