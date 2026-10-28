import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const journeyInclude = {
  route: { select: { color: true, status: true } },
} satisfies Prisma.JourneyInclude;

type JourneyRow = Prisma.JourneyGetPayload<{ include: typeof journeyInclude }>;

export function toJourney(j: JourneyRow) {
  return {
    id: j.id,
    userId: j.userId,
    status: j.status,
    routeId: j.routeId,
    routeNumber: j.routeNumber,
    routeName: j.routeName,
    routeColor: j.route?.color ?? '#1d4ed8',
    destinationStopId: j.destinationStopId,
    destinationName: j.destinationName,
    destinationLat: j.destinationLat,
    destinationLng: j.destinationLng,
    alertRadiusM: j.alertRadiusM,
    startedAt: j.startedAt,
    pausedAt: j.pausedAt,
    endedAt: j.endedAt,
    endReason: j.endReason,
    alertTriggeredAt: j.alertTriggeredAt,
    alertDistanceM: j.alertDistanceM,
    alertCount: j.alertCount,
    alertRearmPending: j.alertRearmPending,
    lastDistanceM: j.lastDistanceM,
    lastAccuracyM: j.lastAccuracyM,
    lastPositionAt: j.lastPositionAt,
    usedSimulation: j.usedSimulation,
    updatedAt: j.updatedAt,
  };
}

export const OPEN_JOURNEY_STATUSES = ['ACTIVE', 'PAUSED'] as const;

/** The passenger's journey that is still running (active or paused), if any. */
export function findOpenJourney(userId: number) {
  return prisma.journey.findFirst({
    where: { userId, status: { in: [...OPEN_JOURNEY_STATUSES] } },
    include: journeyInclude,
    orderBy: { startedAt: 'desc' },
  });
}

/** Loads a journey only if it belongs to the user (404 otherwise, so ids cannot be probed). */
export function findOwnJourney(userId: number, id: number) {
  return prisma.journey.findFirst({ where: { id, userId }, include: journeyInclude });
}
