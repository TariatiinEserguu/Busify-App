import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const routeWithStopsInclude = {
  stops: {
    orderBy: { position: 'asc' },
    include: {
      stop: {
        select: { id: true, name: true, code: true, description: true, latitude: true, longitude: true, isDemo: true },
      },
    },
  },
} satisfies Prisma.RouteInclude;

type RouteWithStops = Prisma.RouteGetPayload<{ include: typeof routeWithStopsInclude }>;

export function toRouteSummary(route: RouteWithStops) {
  const first = route.stops[0]?.stop;
  const last = route.stops[route.stops.length - 1]?.stop;
  return {
    id: route.id,
    number: route.number,
    name: route.name,
    description: route.description,
    status: route.status,
    color: route.color,
    firstDeparture: route.firstDeparture,
    lastDeparture: route.lastDeparture,
    headwayMinutes: route.headwayMinutes,
    isDemo: route.isDemo,
    stopCount: route.stops.length,
    firstStopName: first?.name ?? null,
    lastStopName: last?.name ?? null,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
  };
}

export function toRouteDetail(route: RouteWithStops) {
  return {
    ...toRouteSummary(route),
    stops: route.stops.map((rs) => ({ position: rs.position, ...rs.stop })),
  };
}

export async function loadRoute(id: number) {
  return prisma.route.findUnique({ where: { id }, include: routeWithStopsInclude });
}

/** Lower-cased, accent-insensitive text for searching (handles Cyrillic too). */
export function normalizeSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .trim();
}

/** Renumbers a route's stops 1..n in their current order (after a stop was removed). */
export async function compactRoutePositions(tx: Prisma.TransactionClient, routeId: number) {
  const rows = await tx.routeStop.findMany({ where: { routeId }, orderBy: { position: 'asc' } });
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].position !== i + 1) {
      await tx.routeStop.update({ where: { id: rows[i].id }, data: { position: i + 1 } });
    }
  }
}
