import { Router, type Request } from 'express';
import type { JourneyStatus } from '@prisma/client';
import { z } from 'zod';
import {
  ERROR_CODES,
  journeyAlertSchema,
  journeyProgressSchema,
  journeyResetAlertSchema,
  journeyUpdateSchema,
  PERMISSIONS,
  startJourneySchema,
} from '@busify/shared';
import { badRequest, conflict, idParam, notFound, parse } from '../lib/http';
import { prisma } from '../lib/prisma';
import { getSettings } from '../lib/settings';
import { requirePermission } from '../middleware/auth';
import { loadRoute, toRouteDetail } from '../services/routeService';
import { findOpenJourney, findOwnJourney, journeyInclude, toJourney } from '../services/journeyService';

export const journeysRouter = Router();
journeysRouter.use(requirePermission(PERMISSIONS.JOURNEYS_USE));

async function assertRadiusAllowed(radiusM: number) {
  const s = await getSettings();
  if (radiusM < s.minAlertRadiusM || radiusM > s.maxAlertRadiusM) {
    throw badRequest(`Alert distance must be between ${s.minAlertRadiusM} and ${s.maxAlertRadiusM} m.`, [
      { path: 'alertRadiusM', message: `Choose ${s.minAlertRadiusM}–${s.maxAlertRadiusM} m` },
    ]);
  }
}

async function ownJourneyOr404(req: Request) {
  const journey = await findOwnJourney(req.auth!.user.id, idParam(req.params.id, 'Journey'));
  if (!journey) throw notFound('Journey');
  return journey;
}

function invalidState(status: JourneyStatus, action: string) {
  return conflict(`Cannot ${action} a journey that is ${status.toLowerCase()}.`);
}

/** GET /api/journeys/active — the running journey plus its route (stops in order) for the map. */
journeysRouter.get('/active', async (req, res) => {
  const journey = await findOpenJourney(req.auth!.user.id);
  if (!journey) return res.json({ journey: null, route: null });
  const route = journey.routeId ? await loadRoute(journey.routeId) : null;
  res.json({ journey: toJourney(journey), route: route ? toRouteDetail(route) : null });
});

const historyQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) });

/** GET /api/journeys — the passenger's own journey history, newest first. */
journeysRouter.get('/', async (req, res) => {
  const { limit } = parse(historyQuery, req.query);
  const journeys = await prisma.journey.findMany({
    where: { userId: req.auth!.user.id },
    include: journeyInclude,
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
  res.json({ journeys: journeys.map(toJourney) });
});

/**
 * POST /api/journeys — starts tracking towards a destination stop.
 * Only one journey may be running per passenger; send replaceActive=true to end the old one.
 */
journeysRouter.post('/', async (req, res) => {
  const input = parse(startJourneySchema, req.body);
  const userId = req.auth!.user.id;

  const route = await loadRoute(input.routeId);
  if (!route || route.status !== 'ACTIVE') throw badRequest('That route is not in service.');
  const destination = route.stops.find((rs) => rs.stop.id === input.destinationStopId)?.stop;
  if (!destination) {
    throw badRequest(`That stop is not on route ${route.number}.`, [
      { path: 'destinationStopId', message: 'Choose a stop on the selected route' },
    ]);
  }

  const userSettings = await prisma.userSettings.findUnique({ where: { userId }, select: { alertRadiusM: true } });
  const alertRadiusM = input.alertRadiusM ?? userSettings?.alertRadiusM ?? (await getSettings()).defaultAlertRadiusM;
  await assertRadiusAllowed(alertRadiusM);

  const journey = await prisma.$transaction(async (tx) => {
    const open = await tx.journey.findFirst({
      where: { userId, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { id: true, destinationName: true },
    });
    if (open && !input.replaceActive) {
      throw conflict(
        `You already have a journey to ${open.destinationName}. End it before starting another.`,
        ERROR_CODES.ACTIVE_JOURNEY_EXISTS,
        { journeyId: open.id },
      );
    }
    if (open) {
      await tx.journey.update({
        where: { id: open.id },
        data: { status: 'CANCELLED', endedAt: new Date(), endReason: 'REPLACED' },
      });
    }
    return tx.journey.create({
      data: {
        userId,
        routeId: route.id,
        destinationStopId: destination.id,
        routeNumber: route.number,
        routeName: route.name,
        destinationName: destination.name,
        destinationLat: destination.latitude,
        destinationLng: destination.longitude,
        alertRadiusM,
      },
      include: journeyInclude,
    });
  });

  res.status(201).json({ journey: toJourney(journey), route: toRouteDetail(route) });
});

/** PATCH /api/journeys/:id — change the alert distance of a running journey. */
journeysRouter.patch('/:id', async (req, res) => {
  const journey = await ownJourneyOr404(req);
  if (journey.status !== 'ACTIVE' && journey.status !== 'PAUSED') throw invalidState(journey.status, 'change');
  const { alertRadiusM } = parse(journeyUpdateSchema, req.body);
  await assertRadiusAllowed(alertRadiusM);
  const updated = await prisma.journey.update({
    where: { id: journey.id },
    data: { alertRadiusM },
    include: journeyInclude,
  });
  res.json({ journey: toJourney(updated) });
});

const transitions: Record<string, { from: JourneyStatus[]; verb: string; data: () => Record<string, unknown> }> = {
  pause: { from: ['ACTIVE'], verb: 'pause', data: () => ({ status: 'PAUSED', pausedAt: new Date() }) },
  resume: { from: ['PAUSED'], verb: 'resume', data: () => ({ status: 'ACTIVE', pausedAt: null }) },
  cancel: {
    from: ['ACTIVE', 'PAUSED'],
    verb: 'cancel',
    data: () => ({ status: 'CANCELLED', endedAt: new Date(), endReason: 'CANCELLED_BY_USER' }),
  },
  complete: {
    from: ['ACTIVE', 'PAUSED'],
    verb: 'complete',
    data: () => ({ status: 'COMPLETED', endedAt: new Date(), endReason: 'ARRIVED' }),
  },
};

/** POST /api/journeys/:id/pause | resume | cancel | complete */
for (const [action, t] of Object.entries(transitions)) {
  journeysRouter.post(`/:id/${action}`, async (req, res) => {
    const journey = await ownJourneyOr404(req);
    if (!t.from.includes(journey.status)) throw invalidState(journey.status, t.verb);
    const updated = await prisma.journey.update({
      where: { id: journey.id },
      data: t.data(),
      include: journeyInclude,
    });
    res.json({ journey: toJourney(updated) });
  });
}

/** POST /api/journeys/:id/progress — periodic heartbeat with the latest distance (no raw coordinates stored). */
journeysRouter.post('/:id/progress', async (req, res) => {
  const journey = await ownJourneyOr404(req);
  if (journey.status !== 'ACTIVE') throw invalidState(journey.status, 'update');
  const input = parse(journeyProgressSchema, req.body);
  const updated = await prisma.journey.update({
    where: { id: journey.id },
    data: {
      lastDistanceM: input.distanceM,
      lastAccuracyM: input.accuracyM ?? null,
      lastPositionAt: new Date(),
      usedSimulation: journey.usedSimulation || input.simulated,
      ...(input.alertArmed !== undefined && !journey.alertTriggeredAt ? { alertRearmPending: !input.alertArmed } : {}),
    },
    include: journeyInclude,
  });
  res.json({ journey: toJourney(updated) });
});

/**
 * POST /api/journeys/:id/alert — records that the approach alert fired.
 * Idempotent: a repeated call (e.g. two tabs, a retry, GPS jitter) never counts a second alert.
 */
journeysRouter.post('/:id/alert', async (req, res) => {
  const journey = await ownJourneyOr404(req);
  if (journey.status !== 'ACTIVE') throw invalidState(journey.status, 'alert on');
  const input = parse(journeyAlertSchema, req.body);
  if (input.distanceM > journey.alertRadiusM * 1.5 + 50) {
    throw badRequest('The reported distance is well outside the alert radius.');
  }

  const result = await prisma.journey.updateMany({
    where: { id: journey.id, status: 'ACTIVE', alertTriggeredAt: null },
    data: {
      alertTriggeredAt: new Date(),
      alertDistanceM: input.distanceM,
      alertCount: { increment: 1 },
      alertRearmPending: false,
      lastDistanceM: input.distanceM,
      lastAccuracyM: input.accuracyM ?? null,
      lastPositionAt: new Date(),
      usedSimulation: journey.usedSimulation || input.simulated,
    },
  });
  const updated = await prisma.journey.findUniqueOrThrow({ where: { id: journey.id }, include: journeyInclude });
  res.json({ journey: toJourney(updated), duplicate: result.count === 0 });
});

/** POST /api/journeys/:id/reset-alert — re-arms the alert (after moving away if still near the stop). */
journeysRouter.post('/:id/reset-alert', async (req, res) => {
  const journey = await ownJourneyOr404(req);
  if (journey.status !== 'ACTIVE' && journey.status !== 'PAUSED') throw invalidState(journey.status, 'reset');
  if (!journey.alertTriggeredAt) throw conflict('The alert has not fired yet, so there is nothing to reset.');
  const { stillNearStop } = parse(journeyResetAlertSchema, req.body);
  const updated = await prisma.journey.update({
    where: { id: journey.id },
    data: { alertTriggeredAt: null, alertRearmPending: stillNearStop },
    include: journeyInclude,
  });
  res.json({ journey: toJourney(updated) });
});
