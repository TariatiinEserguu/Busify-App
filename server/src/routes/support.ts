import { Router, type Request } from 'express';
import type { Prisma, TicketStatus } from '@prisma/client';
import { z } from 'zod';
import {
  createTicketSchema,
  escalateTicketSchema,
  PERMISSIONS,
  TICKET_CATEGORIES,
  TICKET_STATUS_LABELS,
  TICKET_STATUSES,
  ticketResponseSchema,
  ticketUpdateSchema,
} from '@busify/shared';
import { audit } from '../lib/audit';
import { parseDateRange } from '../lib/dates';
import { badRequest, conflict, idParam, notFound, parse } from '../lib/http';
import { notifyAdmins, notifyUsers } from '../lib/notifications';
import { prisma } from '../lib/prisma';
import { hasPermission, requireAuth, requirePermission } from '../middleware/auth';
import { journeyInclude, toJourney } from '../services/journeyService';
import { normalizeSearch } from '../services/routeService';

export const supportRouter = Router();
supportRouter.use(requireAuth);

const personSelect = { id: true, name: true, role: { select: { name: true } } } as const;

const ticketListInclude = {
  user: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true } },
  route: { select: { id: true, number: true, name: true } },
  _count: { select: { responses: true } },
} satisfies Prisma.SupportTicketInclude;

type TicketListRow = Prisma.SupportTicketGetPayload<{ include: typeof ticketListInclude }>;

function toTicketSummary(t: TicketListRow, staff: boolean) {
  return {
    id: t.id,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    escalated: t.escalated,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    resolvedAt: t.resolvedAt,
    passenger: t.user,
    assignedTo: t.assignedTo,
    route: t.route,
    responseCount: staff ? t._count.responses : undefined,
  };
}

function isStaff(req: Request) {
  return hasPermission(req, PERMISSIONS.TICKETS_MANAGE);
}

/** Loads a ticket the current user may see: staff see all, passengers only their own. */
async function visibleTicketOr404(req: Request) {
  const id = idParam(req.params.id, 'Support request');
  const ticket = await prisma.supportTicket.findUnique({ where: { id }, select: { id: true, userId: true, status: true, subject: true, escalated: true, assignedToId: true } });
  if (!ticket || (!isStaff(req) && ticket.userId !== req.auth!.user.id)) throw notFound('Support request');
  return ticket;
}

async function ticketDetail(id: number, staff: boolean) {
  const t = await prisma.supportTicket.findUniqueOrThrow({
    where: { id },
    include: {
      ...ticketListInclude,
      escalatedBy: { select: { id: true, name: true } },
      journey: { include: journeyInclude },
      responses: {
        where: staff ? {} : { isInternal: false },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: personSelect } },
      },
      events: {
        where: staff ? {} : { type: { notIn: ['INTERNAL_NOTE', 'ASSIGNED', 'PRIORITY_CHANGED'] } },
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: personSelect } },
      },
    },
  });
  const person = (p: { id: number; name: string; role: { name: string } } | null) =>
    p ? { id: p.id, name: p.name, role: p.role.name } : null;
  return {
    ...toTicketSummary(t, staff),
    description: t.description,
    journey: t.journey ? toJourney(t.journey) : null,
    escalatedAt: t.escalatedAt,
    escalatedBy: staff ? t.escalatedBy : undefined,
    escalationReason: staff ? t.escalationReason : undefined,
    responses: t.responses.map((r) => ({
      id: r.id,
      message: r.message,
      isInternal: r.isInternal,
      createdAt: r.createdAt,
      author: person(r.author),
    })),
    events: t.events.map((e) => ({
      id: e.id,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: staff || e.type !== 'ESCALATED' ? e.note : null,
      createdAt: e.createdAt,
      actor: person(e.actor),
    })),
  };
}

const listQuery = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  escalated: z.enum(['true', 'false']).optional(),
  assigned: z.enum(['me', 'unassigned']).optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** GET /api/support/tickets — staff see every request; passengers only their own. */
supportRouter.get('/tickets', async (req, res) => {
  const q = parse(listQuery, req.query);
  const staff = isStaff(req);
  const scope: Prisma.SupportTicketWhereInput = staff ? {} : { userId: req.auth!.user.id };
  const where: Prisma.SupportTicketWhereInput = {
    ...scope,
    ...(q.status ? { status: q.status } : {}),
    ...(q.category ? { category: q.category } : {}),
    ...(q.escalated ? { escalated: q.escalated === 'true' } : {}),
    ...(staff && q.assigned === 'me' ? { assignedToId: req.auth!.user.id } : {}),
    ...(staff && q.assigned === 'unassigned' ? { assignedToId: null } : {}),
  };

  let rows = await prisma.supportTicket.findMany({
    where,
    include: ticketListInclude,
    orderBy: [{ updatedAt: 'desc' }],
  });
  if (q.search) {
    const term = normalizeSearch(q.search);
    rows = rows.filter(
      (t) =>
        normalizeSearch(t.subject).includes(term) ||
        String(t.id) === term.replace('#', '') ||
        (staff && (normalizeSearch(t.user.name).includes(term) || t.user.email.includes(term))),
    );
  }

  const total = rows.length;
  const pageRows = rows.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
  const grouped = await prisma.supportTicket.groupBy({ by: ['status'], where: scope, _count: { _all: true } });
  const counts = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>;
  for (const g of grouped) counts[g.status] = g._count._all;
  const escalatedOpen = staff
    ? await prisma.supportTicket.count({ where: { escalated: true, status: { not: 'RESOLVED' } } })
    : undefined;

  res.json({
    tickets: pageRows.map((t) => toTicketSummary(t, staff)),
    total,
    page: q.page,
    pageSize: q.pageSize,
    counts,
    escalatedOpen,
  });
});

/** POST /api/support/tickets — a passenger submits a complaint, question or feedback. */
supportRouter.post('/tickets', requirePermission(PERMISSIONS.TICKETS_CREATE), async (req, res) => {
  const input = parse(createTicketSchema, req.body);
  const userId = req.auth!.user.id;

  let routeId = input.routeId ?? null;
  if (input.journeyId) {
    const journey = await prisma.journey.findFirst({ where: { id: input.journeyId, userId }, select: { routeId: true } });
    if (!journey) throw badRequest('That journey was not found in your history.', [{ path: 'journeyId', message: 'Unknown journey' }]);
    routeId ??= journey.routeId;
  }
  if (routeId) {
    const route = await prisma.route.findUnique({ where: { id: routeId }, select: { id: true } });
    if (!route) throw badRequest('That route does not exist.', [{ path: 'routeId', message: 'Unknown route' }]);
  }

  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.supportTicket.create({
      data: {
        userId,
        subject: input.subject,
        description: input.description,
        category: input.category,
        priority: input.category === 'COMPLAINT' ? 'HIGH' : 'NORMAL',
        journeyId: input.journeyId ?? null,
        routeId,
      },
    });
    await tx.ticketEvent.create({ data: { ticketId: created.id, actorId: userId, type: 'CREATED', toStatus: 'OPEN' } });
    const agents = await tx.user.findMany({
      where: { status: 'ACTIVE', role: { name: 'SUPPORT' } },
      select: { id: true },
    });
    await notifyUsers(
      agents.map((a) => a.id),
      {
        type: 'ticket.created',
        title: `New support request #${created.id}`,
        body: input.subject,
        link: `/desk/tickets/${created.id}`,
      },
      tx,
    );
    return created;
  });

  res.status(201).json({ ticket: await ticketDetail(ticket.id, false) });
});

/** GET /api/support/tickets/:id */
supportRouter.get('/tickets/:id', async (req, res) => {
  const ticket = await visibleTicketOr404(req);
  res.json({ ticket: await ticketDetail(ticket.id, isStaff(req)) });
});

/**
 * POST /api/support/tickets/:id/responses
 * Passengers can reply on their own request (re-opening it if resolved).
 * Staff can reply or add internal notes; the first public reply moves an open request to In progress.
 */
supportRouter.post('/tickets/:id/responses', async (req, res) => {
  const ticket = await visibleTicketOr404(req);
  const staff = isStaff(req);
  const input = parse(ticketResponseSchema, req.body);
  const internal = staff && input.internal;
  const actorId = req.auth!.user.id;

  await prisma.$transaction(async (tx) => {
    await tx.supportResponse.create({
      data: { ticketId: ticket.id, authorId: actorId, message: input.message, isInternal: internal },
    });
    await tx.ticketEvent.create({
      data: { ticketId: ticket.id, actorId, type: internal ? 'INTERNAL_NOTE' : 'RESPONSE_ADDED' },
    });

    if (!staff && ticket.status === 'RESOLVED') {
      await tx.supportTicket.update({ where: { id: ticket.id }, data: { status: 'OPEN', resolvedAt: null } });
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId, type: 'REOPENED', fromStatus: 'RESOLVED', toStatus: 'OPEN' },
      });
    } else if (staff && !internal && ticket.status === 'OPEN') {
      await tx.supportTicket.update({
        where: { id: ticket.id },
        // The agent who picks up an unassigned request becomes its owner.
        data: { status: 'IN_PROGRESS', assignedToId: ticket.assignedToId ?? actorId },
      });
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId, type: 'STATUS_CHANGED', fromStatus: 'OPEN', toStatus: 'IN_PROGRESS' },
      });
    } else {
      await tx.supportTicket.update({ where: { id: ticket.id }, data: { updatedAt: new Date() } });
    }

    if (staff && !internal) {
      await notifyUsers(
        [ticket.userId],
        {
          type: 'ticket.reply',
          title: 'Support replied to your request',
          body: ticket.subject,
          link: `/support/${ticket.id}`,
        },
        tx,
      );
    }
  });

  if (staff) {
    await audit(req, {
      action: internal ? 'ticket.internal_note' : 'ticket.respond',
      entityType: 'ticket',
      entityId: ticket.id,
      summary: `${internal ? 'Internal note on' : 'Replied to'} ticket #${ticket.id}`,
    });
  }
  res.status(201).json({ ticket: await ticketDetail(ticket.id, staff) });
});

/** PATCH /api/support/tickets/:id — staff change status, priority or assignee. */
supportRouter.patch('/tickets/:id', requirePermission(PERMISSIONS.TICKETS_MANAGE), async (req, res) => {
  const ticket = await visibleTicketOr404(req);
  const input = parse(ticketUpdateSchema, req.body);
  const actorId = req.auth!.user.id;
  const current = await prisma.supportTicket.findUniqueOrThrow({ where: { id: ticket.id } });

  if (input.assignedToId) {
    const assignee = await prisma.user.findUnique({
      where: { id: input.assignedToId },
      select: { status: true, role: { select: { permissions: { select: { permission: { select: { key: true } } } } } } },
    });
    const canHandle = assignee?.role.permissions.some((p) => p.permission.key === PERMISSIONS.TICKETS_MANAGE);
    if (!assignee || assignee.status !== 'ACTIVE' || !canHandle) {
      throw badRequest('Tickets can only be assigned to active support staff.', [
        { path: 'assignedToId', message: 'Choose a support agent or administrator' },
      ]);
    }
  }

  const changes: string[] = [];
  await prisma.$transaction(async (tx) => {
    const data: Prisma.SupportTicketUncheckedUpdateInput = {};
    if (input.status && input.status !== current.status) {
      data.status = input.status;
      data.resolvedAt = input.status === 'RESOLVED' ? new Date() : null;
      changes.push(`status ${TICKET_STATUS_LABELS[current.status]} → ${TICKET_STATUS_LABELS[input.status]}`);
      await tx.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          actorId,
          type: 'STATUS_CHANGED',
          fromStatus: current.status,
          toStatus: input.status,
          note: input.note || null,
        },
      });
    }
    if (input.priority && input.priority !== current.priority) {
      data.priority = input.priority;
      changes.push(`priority ${current.priority} → ${input.priority}`);
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId, type: 'PRIORITY_CHANGED', note: `${current.priority} → ${input.priority}` },
      });
    }
    if (input.assignedToId !== undefined && input.assignedToId !== current.assignedToId) {
      data.assignedToId = input.assignedToId;
      changes.push(input.assignedToId ? `assigned to user ${input.assignedToId}` : 'unassigned');
      await tx.ticketEvent.create({
        data: { ticketId: ticket.id, actorId, type: 'ASSIGNED', note: input.assignedToId ? `user:${input.assignedToId}` : 'unassigned' },
      });
    }
    if (Object.keys(data).length === 0) return;
    await tx.supportTicket.update({ where: { id: ticket.id }, data });

    if (data.status) {
      await notifyUsers(
        [current.userId],
        {
          type: 'ticket.status',
          title: `Your request is now ${TICKET_STATUS_LABELS[data.status as TicketStatus].toLowerCase()}`,
          body: current.subject,
          link: `/support/${ticket.id}`,
        },
        tx,
      );
    }
  });

  if (changes.length > 0) {
    await audit(req, {
      action: 'ticket.update',
      entityType: 'ticket',
      entityId: ticket.id,
      summary: `Ticket #${ticket.id}: ${changes.join(', ')}`,
    });
  }
  res.json({ ticket: await ticketDetail(ticket.id, true) });
});

/** POST /api/support/tickets/:id/escalate — hand an unresolved issue to the administrators. */
supportRouter.post('/tickets/:id/escalate', requirePermission(PERMISSIONS.TICKETS_ESCALATE), async (req, res) => {
  const ticket = await visibleTicketOr404(req);
  if (ticket.escalated) throw conflict('This request has already been escalated to an administrator.');
  if (ticket.status === 'RESOLVED') throw conflict('Resolved requests cannot be escalated. Re-open it first.');
  const { reason } = parse(escalateTicketSchema, req.body);
  const actorId = req.auth!.user.id;

  await prisma.$transaction(async (tx) => {
    await tx.supportTicket.update({
      where: { id: ticket.id },
      data: {
        escalated: true,
        escalatedAt: new Date(),
        escalatedById: actorId,
        escalationReason: reason,
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : undefined,
        priority: 'HIGH',
      },
    });
    await tx.ticketEvent.create({ data: { ticketId: ticket.id, actorId, type: 'ESCALATED', note: reason } });
    await notifyAdmins(
      {
        type: 'ticket.escalated',
        title: `Ticket #${ticket.id} escalated to administrators`,
        body: `${ticket.subject} — ${reason}`.slice(0, 280),
        link: `/desk/tickets/${ticket.id}`,
      },
      tx,
    );
  });
  await audit(req, {
    action: 'ticket.escalate',
    entityType: 'ticket',
    entityId: ticket.id,
    summary: `Escalated ticket #${ticket.id} to administrators`,
    metadata: { reason },
  });
  res.json({ ticket: await ticketDetail(ticket.id, true) });
});

/** GET /api/support/tickets/:id/passenger-journeys — journey history of the passenger who raised the request. */
supportRouter.get(
  '/tickets/:id/passenger-journeys',
  requirePermission(PERMISSIONS.PASSENGER_HISTORY_VIEW),
  async (req, res) => {
    const ticket = await visibleTicketOr404(req);
    const journeys = await prisma.journey.findMany({
      where: { userId: ticket.userId },
      include: journeyInclude,
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    await audit(req, {
      action: 'passenger.history_view',
      entityType: 'user',
      entityId: ticket.userId,
      summary: `Viewed journey history of passenger ${ticket.userId} for ticket #${ticket.id}`,
    });
    res.json({ journeys: journeys.map(toJourney) });
  },
);

/** GET /api/support/staff — people a ticket can be assigned to. */
supportRouter.get('/staff', requirePermission(PERMISSIONS.TICKETS_MANAGE), async (_req, res) => {
  const staff = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { name: { in: ['SUPPORT', 'ADMIN'] } } },
    select: { id: true, name: true, role: { select: { name: true } } },
    orderBy: { name: 'asc' },
  });
  res.json({ staff: staff.map((s) => ({ id: s.id, name: s.name, role: s.role.name })) });
});

/** GET /api/support/reports/resolved?from=&to= — resolved-case report for a period. */
supportRouter.get('/reports/resolved', requirePermission(PERMISSIONS.SUPPORT_REPORTS), async (req, res) => {
  const range = parseDateRange(req.query, 30);
  const resolved = await prisma.supportTicket.findMany({
    where: { status: 'RESOLVED', resolvedAt: { gte: range.from, lte: range.to } },
    include: {
      user: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
      route: { select: { number: true } },
    },
    orderBy: { resolvedAt: 'desc' },
  });
  const opened = await prisma.supportTicket.count({ where: { createdAt: { gte: range.from, lte: range.to } } });

  const hours = resolved.map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000);
  const sorted = [...hours].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
  const byCategory = Object.fromEntries(TICKET_CATEGORIES.map((c) => [c, 0]));
  const byAgent = new Map<string, number>();
  for (const t of resolved) {
    byCategory[t.category] += 1;
    const agent = t.assignedTo?.name ?? 'Unassigned';
    byAgent.set(agent, (byAgent.get(agent) ?? 0) + 1);
  }

  res.json({
    from: range.from,
    to: range.to,
    summary: {
      opened,
      resolved: resolved.length,
      escalated: resolved.filter((t) => t.escalated).length,
      averageResolutionHours: hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : null,
      medianResolutionHours: median,
    },
    byCategory,
    byAgent: [...byAgent.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    tickets: resolved.map((t, i) => ({
      id: t.id,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      escalated: t.escalated,
      passenger: t.user,
      assignedTo: t.assignedTo,
      routeNumber: t.route?.number ?? null,
      createdAt: t.createdAt,
      resolvedAt: t.resolvedAt,
      resolutionHours: hours[i],
    })),
  });
});
