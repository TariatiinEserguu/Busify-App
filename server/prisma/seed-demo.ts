/**
 * `npm run db:seed:demo` — adds DEMONSTRATION data for local testing:
 * demo accounts, invented routes and stops, and a little history so the
 * dashboards are not empty. Everything is flagged (isDemo / isDemoAccount)
 * and can be removed with `npm run db:remove-demo`.
 *
 * Refuses to run unless DEMO_MODE=true.
 */
import type { Prisma } from '@prisma/client';
import { env } from '../src/config/env';
import { hashPassword } from '../src/lib/password';
import { prisma } from '../src/lib/prisma';
import { seedBaseData } from '../src/lib/seedBase';
import { DEMO_ACCOUNTS, DEMO_ROUTES, DEMO_STOPS } from './demo-data';

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000);

async function main() {
  if (!env.DEMO_MODE) {
    throw new Error('Demo data can only be added when DEMO_MODE=true in .env (it is meant for local demonstrations).');
  }
  if (!env.DEMO_ACCOUNT_PASSWORD || env.DEMO_ACCOUNT_PASSWORD.length < 8) {
    throw new Error('Set DEMO_ACCOUNT_PASSWORD (8+ characters) in .env before adding demo accounts.');
  }

  await seedBaseData(prisma);
  const roles = new Map((await prisma.role.findMany()).map((r) => [r.name, r.id]));

  // --- Accounts -------------------------------------------------------------
  const passwordHash = await hashPassword(env.DEMO_ACCOUNT_PASSWORD);
  const users: Record<string, number> = {};
  for (const account of DEMO_ACCOUNTS) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      create: {
        email: account.email,
        name: account.name,
        passwordHash,
        roleId: roles.get(account.role)!,
        isDemoAccount: true,
        settings: { create: {} },
      },
      // Re-running the demo seed keeps demo passwords in sync with .env.
      update: { isDemoAccount: true, passwordHash, status: 'ACTIVE' },
    });
    users[account.key] = user.id;
  }

  // --- Stops and routes -----------------------------------------------------
  const stopIds = new Map<string, number>();
  for (const s of DEMO_STOPS) {
    const stop = await prisma.stop.upsert({
      where: { code: s.code },
      create: { code: s.code, name: s.name, latitude: s.lat, longitude: s.lng, description: s.description ?? '', isDemo: true },
      update: {},
    });
    stopIds.set(s.code, stop.id);
  }

  for (const r of DEMO_ROUTES) {
    const existing = await prisma.route.findUnique({ where: { number: r.number } });
    if (existing) continue;
    await prisma.route.create({
      data: {
        number: r.number,
        name: r.name,
        description: r.description,
        status: r.status,
        color: r.color,
        firstDeparture: r.firstDeparture ?? null,
        lastDeparture: r.lastDeparture ?? null,
        headwayMinutes: r.headwayMinutes ?? null,
        isDemo: true,
        stops: { create: r.stops.map((code, i) => ({ stopId: stopIds.get(code)!, position: i + 1 })) },
      },
    });
  }

  // --- Sample history (only once) ------------------------------------------
  const alreadyHasHistory = await prisma.journey.count({ where: { userId: users.passenger } });
  if (alreadyHasHistory === 0) {
    const d1 = await prisma.route.findUniqueOrThrow({ where: { number: 'D1' } });
    const d2 = await prisma.route.findUniqueOrThrow({ where: { number: 'D2' } });
    const d3 = await prisma.route.findUniqueOrThrow({ where: { number: 'D3' } });
    const stop = (code: string) => DEMO_STOPS.find((s) => s.code === code)!;

    const past: Array<{
      user: number;
      route: typeof d1;
      dest: string;
      startedHoursAgo: number;
      minutes: number;
      outcome: 'COMPLETED' | 'CANCELLED';
      alerted: boolean;
    }> = [
      { user: users.passenger, route: d1, dest: 'DEMO-09', startedHoursAgo: 2 * 24 + 5, minutes: 22, outcome: 'COMPLETED', alerted: true },
      { user: users.passenger, route: d3, dest: 'DEMO-32', startedHoursAgo: 4 * 24 + 3, minutes: 14, outcome: 'COMPLETED', alerted: true },
      { user: users.passenger, route: d2, dest: 'DEMO-26', startedHoursAgo: 6 * 24 + 8, minutes: 9, outcome: 'CANCELLED', alerted: false },
      { user: users.passenger, route: d1, dest: 'DEMO-12', startedHoursAgo: 9 * 24 + 2, minutes: 31, outcome: 'COMPLETED', alerted: true },
      { user: users.rider, route: d1, dest: 'DEMO-04', startedHoursAgo: 1 * 24 + 4, minutes: 17, outcome: 'COMPLETED', alerted: true },
      { user: users.rider, route: d2, dest: 'DEMO-22', startedHoursAgo: 3 * 24 + 1, minutes: 12, outcome: 'COMPLETED', alerted: true },
      { user: users.rider, route: d3, dest: 'DEMO-31', startedHoursAgo: 12 * 24, minutes: 6, outcome: 'CANCELLED', alerted: false },
    ];
    const journeyIds: number[] = [];
    for (const p of past) {
      const s = stop(p.dest);
      const startedAt = hoursAgo(p.startedHoursAgo);
      const endedAt = new Date(startedAt.getTime() + p.minutes * 60_000);
      const alertAt = new Date(endedAt.getTime() - 60_000);
      const j = await prisma.journey.create({
        data: {
          userId: p.user,
          routeId: p.route.id,
          destinationStopId: stopIds.get(p.dest)!,
          routeNumber: p.route.number,
          routeName: p.route.name,
          destinationName: s.name,
          destinationLat: s.lat,
          destinationLng: s.lng,
          alertRadiusM: 200,
          status: p.outcome,
          startedAt,
          endedAt,
          endReason: p.outcome === 'COMPLETED' ? 'ARRIVED' : 'CANCELLED_BY_USER',
          alertTriggeredAt: p.alerted ? alertAt : null,
          alertDistanceM: p.alerted ? 185 : null,
          alertCount: p.alerted ? 1 : 0,
          lastDistanceM: p.alerted ? 40 : 1450,
          lastAccuracyM: 12,
          lastPositionAt: endedAt,
          usedSimulation: true,
        },
      });
      journeyIds.push(j.id);
    }

    // --- Support tickets ----------------------------------------------------
    type TicketSeed = {
      data: Omit<Prisma.SupportTicketUncheckedCreateInput, 'createdAt'>;
      createdHoursAgo: number;
      responses?: Array<{ author: number; message: string; internal?: boolean; hoursAgo: number }>;
      events?: Array<Omit<Prisma.TicketEventUncheckedCreateInput, 'ticketId' | 'createdAt'> & { hoursAgo: number }>;
    };
    const tickets: TicketSeed[] = [
      {
        createdHoursAgo: 50,
        data: {
          userId: users.passenger,
          subject: 'Alert felt late before University Gate',
          description:
            'On my D1 trip the alert went off when the bus was already slowing down for University Gate. Could the default distance be larger?',
          category: 'COMPLAINT',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          routeId: d1.id,
          journeyId: journeyIds[0],
          assignedToId: users.support,
        },
        responses: [
          {
            author: users.support,
            message:
              'Thanks for reporting this. You can raise the alert distance under Settings → Alert distance (for example 350 m). We are also checking the stop position.',
            hoursAgo: 46,
          },
          { author: users.support, message: 'Journey shows the alert fired at ~185 m. Stop coordinates look fine.', internal: true, hoursAgo: 45 },
        ],
        events: [
          { actorId: users.passenger, type: 'CREATED', toStatus: 'OPEN', hoursAgo: 50 },
          { actorId: users.support, type: 'RESPONSE_ADDED', hoursAgo: 46 },
          { actorId: users.support, type: 'STATUS_CHANGED', fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', hoursAgo: 46 },
          { actorId: users.support, type: 'INTERNAL_NOTE', hoursAgo: 45 },
        ],
      },
      {
        createdHoursAgo: 20,
        data: {
          userId: users.passenger,
          subject: 'Please add a stop near the dormitories',
          description: 'The campus shuttle would be easier to use with an extra stop at the north side of the dormitories.',
          category: 'FEEDBACK',
          status: 'OPEN',
          routeId: d3.id,
        },
        events: [{ actorId: users.passenger, type: 'CREATED', toStatus: 'OPEN', hoursAgo: 20 }],
      },
      {
        createdHoursAgo: 30,
        data: {
          userId: users.rider,
          subject: 'Old Market stop is on the wrong side of the road',
          description: 'The Old Market (demo) marker is about 50 m from where the bus actually stops, so the alert distance is off.',
          category: 'ROUTE_DATA',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          routeId: d1.id,
          journeyId: journeyIds[4],
          assignedToId: users.support,
          escalated: true,
          escalatedAt: hoursAgo(28),
          escalatedById: users.support,
          escalationReason: 'Stop coordinates need to be corrected by an administrator.',
        },
        responses: [
          { author: users.support, message: 'Thank you! I have passed this to an administrator who can correct stop locations.', hoursAgo: 28 },
        ],
        events: [
          { actorId: users.rider, type: 'CREATED', toStatus: 'OPEN', hoursAgo: 30 },
          { actorId: users.support, type: 'RESPONSE_ADDED', hoursAgo: 28 },
          { actorId: users.support, type: 'STATUS_CHANGED', fromStatus: 'OPEN', toStatus: 'IN_PROGRESS', hoursAgo: 28 },
          { actorId: users.support, type: 'ESCALATED', note: 'Stop coordinates need to be corrected by an administrator.', hoursAgo: 28 },
        ],
      },
      {
        createdHoursAgo: 8 * 24,
        data: {
          userId: users.rider,
          subject: 'How do I change the alert distance?',
          description: 'I would like to be warned earlier. Where can I change how far from the stop the alert goes off?',
          category: 'QUESTION',
          status: 'RESOLVED',
          assignedToId: users.support,
          resolvedAt: hoursAgo(8 * 24 - 3),
        },
        responses: [
          { author: users.support, message: 'Open Settings and move the "Alert distance" slider, then press Save. It applies to new journeys.', hoursAgo: 8 * 24 - 3 },
        ],
        events: [
          { actorId: users.rider, type: 'CREATED', toStatus: 'OPEN', hoursAgo: 8 * 24 },
          { actorId: users.support, type: 'RESPONSE_ADDED', hoursAgo: 8 * 24 - 3 },
          { actorId: users.support, type: 'STATUS_CHANGED', fromStatus: 'OPEN', toStatus: 'RESOLVED', hoursAgo: 8 * 24 - 3 },
        ],
      },
    ];

    for (const t of tickets) {
      const ticket = await prisma.supportTicket.create({
        data: { ...t.data, createdAt: hoursAgo(t.createdHoursAgo) },
      });
      for (const r of t.responses ?? []) {
        await prisma.supportResponse.create({
          data: { ticketId: ticket.id, authorId: r.author, message: r.message, isInternal: !!r.internal, createdAt: hoursAgo(r.hoursAgo) },
        });
      }
      for (const { hoursAgo: h, ...e } of t.events ?? []) {
        await prisma.ticketEvent.create({ data: { ...e, ticketId: ticket.id, createdAt: hoursAgo(h) } });
      }
      if (t.data.escalated) {
        await prisma.notification.create({
          data: {
            userId: users.admin,
            type: 'ticket.escalated',
            title: `Ticket #${ticket.id} escalated to administrators`,
            body: `${t.data.subject} — ${t.data.escalationReason}`,
            link: `/desk/tickets/${ticket.id}`,
          },
        });
      }
    }

    await prisma.auditLog.createMany({
      data: [
        { actorId: null, action: 'system.demo_seed', entityType: 'system', summary: 'Demonstration data loaded (routes D1–D4, D9; demo accounts)' },
        {
          actorId: users.support,
          action: 'ticket.escalate',
          entityType: 'ticket',
          summary: 'Escalated a stop-location report to administrators',
          createdAt: hoursAgo(28),
        },
      ],
    });
  }

  console.log('✔ Demo data ready (DEMONSTRATION ONLY — invented routes and stops):');
  console.log(`  ${DEMO_ROUTES.length} routes, ${DEMO_STOPS.length} stops, ${DEMO_ACCOUNTS.length} demo accounts`);
  for (const a of DEMO_ACCOUNTS) console.log(`    ${a.role.padEnd(9)} ${a.email}`);
  console.log('  Password: the DEMO_ACCOUNT_PASSWORD value from your .env file.');
}

main()
  .catch((err) => {
    console.error('✖ Demo seed failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
