import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  adminUserUpdateSchema,
  PERMISSIONS,
  ROLE_LABELS,
  ROLES,
  systemSettingsSchema,
  TICKET_CATEGORIES,
  TICKET_STATUSES,
  USER_STATUSES,
} from '@busify/shared';
import { audit } from '../lib/audit';
import { addDays, dayKey, dayKeys, parseDateRange, startOfDay } from '../lib/dates';
import { badRequest, conflict, idParam, notFound, parse } from '../lib/http';
import { generateTemporaryPassword, hashPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { destroyUserSessions } from '../lib/sessions';
import { getSettings, saveSettings } from '../lib/settings';
import { publicUserSelect, toPublicUser } from '../lib/users';
import { requirePermission } from '../middleware/auth';
import { journeyInclude, toJourney } from '../services/journeyService';
import { normalizeSearch } from '../services/routeService';

export const adminRouter = Router();

const actorSelect = { select: { id: true, name: true, email: true } } as const;

async function activeJourneys(take = 20) {
  const rows = await prisma.journey.findMany({
    where: { status: { in: ['ACTIVE', 'PAUSED'] } },
    include: { ...journeyInclude, user: { select: { id: true, name: true, email: true } } },
    orderBy: { startedAt: 'desc' },
    take,
  });
  return rows.map((j) => ({ ...toJourney(j), passenger: j.user }));
}

/** GET /api/admin/overview — headline numbers for the admin dashboard. */
adminRouter.get('/overview', requirePermission(PERMISSIONS.REPORTS_VIEW), async (_req, res) => {
  const todayStart = startOfDay(new Date());
  const weekStart = addDays(todayStart, -6);
  const dayAgo = new Date(Date.now() - 86_400_000);

  const [
    passengers,
    staff,
    suspended,
    routesTotal,
    routesActive,
    stops,
    openJourneys,
    journeysToday,
    alertsToday,
    openTickets,
    escalatedOpen,
    errors24h,
    recentActivity,
    recentErrors,
    weekJourneys,
    journeysLive,
  ] = await Promise.all([
    prisma.user.count({ where: { role: { name: 'PASSENGER' } } }),
    prisma.user.count({ where: { role: { name: { in: ['SUPPORT', 'ADMIN'] } } } }),
    prisma.user.count({ where: { status: 'SUSPENDED' } }),
    prisma.route.count(),
    prisma.route.count({ where: { status: 'ACTIVE' } }),
    prisma.stop.count(),
    prisma.journey.count({ where: { status: { in: ['ACTIVE', 'PAUSED'] } } }),
    prisma.journey.count({ where: { startedAt: { gte: todayStart } } }),
    prisma.journey.count({ where: { alertTriggeredAt: { gte: todayStart } } }),
    prisma.supportTicket.count({ where: { status: { not: 'RESOLVED' } } }),
    prisma.supportTicket.count({ where: { escalated: true, status: { not: 'RESOLVED' } } }),
    prisma.errorLog.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { actor: actorSelect } }),
    prisma.errorLog.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
    prisma.journey.findMany({ where: { startedAt: { gte: weekStart } }, select: { startedAt: true, alertTriggeredAt: true } }),
    activeJourneys(10),
  ]);

  const week = dayKeys(weekStart, new Date()).map((date) => ({ date, journeys: 0, alerts: 0 }));
  const index = new Map(week.map((d, i) => [d.date, i]));
  for (const j of weekJourneys) {
    const i = index.get(dayKey(j.startedAt));
    if (i !== undefined) {
      week[i].journeys += 1;
      if (j.alertTriggeredAt) week[i].alerts += 1;
    }
  }

  res.json({
    counts: {
      passengers,
      staff,
      suspended,
      routesTotal,
      routesActive,
      stops,
      activeJourneys: openJourneys,
      journeysToday,
      alertsToday,
      openTickets,
      escalatedOpen,
      errors24h,
    },
    week,
    activeJourneys: journeysLive,
    recentActivity,
    recentErrors,
  });
});

/** GET /api/admin/journeys/active — journeys currently being tracked. */
adminRouter.get('/journeys/active', requirePermission(PERMISSIONS.REPORTS_VIEW), async (_req, res) => {
  res.json({ journeys: await activeJourneys(100) });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

const userListQuery = z.object({
  search: z.string().max(100).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

/** GET /api/admin/users — never includes password hashes. */
adminRouter.get('/users', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  const q = parse(userListQuery, req.query);
  const where: Prisma.UserWhereInput = {
    ...(q.role ? { role: { name: q.role } } : {}),
    ...(q.status ? { status: q.status } : {}),
  };
  let users = await prisma.user.findMany({
    where,
    select: { ...publicUserSelect, _count: { select: { journeys: true, tickets: true } } },
    orderBy: { createdAt: 'desc' },
  });
  if (q.search) {
    const term = normalizeSearch(q.search);
    users = users.filter((u) => normalizeSearch(u.name).includes(term) || u.email.includes(term));
  }
  const total = users.length;
  const page = users.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
  res.json({
    users: page.map((u) => ({ ...toPublicUser(u), journeyCount: u._count.journeys, ticketCount: u._count.tickets })),
    total,
    page: q.page,
    pageSize: q.pageSize,
  });
});

/** GET /api/admin/users/:id — account details with recent activity. */
adminRouter.get('/users/:id', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  const id = idParam(req.params.id, 'User');
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...publicUserSelect,
      updatedAt: true,
      settings: { select: { alertRadiusM: true, soundEnabled: true, vibrationEnabled: true, notificationsEnabled: true } },
      _count: { select: { journeys: true, tickets: true, sessions: true } },
    },
  });
  if (!user) throw notFound('User');
  const [journeys, tickets, activity] = await Promise.all([
    prisma.journey.findMany({ where: { userId: id }, include: journeyInclude, orderBy: { startedAt: 'desc' }, take: 10 }),
    prisma.supportTicket.findMany({
      where: { userId: id },
      select: { id: true, subject: true, status: true, category: true, createdAt: true, escalated: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.auditLog.findMany({
      where: { OR: [{ actorId: id }, { entityType: 'user', entityId: String(id) }] },
      include: { actor: actorSelect },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);
  res.json({
    user: {
      ...toPublicUser(user),
      updatedAt: user.updatedAt,
      settings: user.settings,
      journeyCount: user._count.journeys,
      ticketCount: user._count.tickets,
      activeSessions: user._count.sessions,
    },
    journeys: journeys.map(toJourney),
    tickets,
    activity,
  });
});

async function assertNotLastAdmin(userId: number) {
  const remaining = await prisma.user.count({
    where: { id: { not: userId }, status: 'ACTIVE', role: { name: 'ADMIN' } },
  });
  if (remaining === 0) throw conflict('BUSIFY needs at least one active administrator.');
}

/** PATCH /api/admin/users/:id — change role or suspend/reactivate. */
adminRouter.patch('/users/:id', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  const id = idParam(req.params.id, 'User');
  const input = parse(adminUserUpdateSchema, req.body);
  if (id === req.auth!.user.id) throw badRequest('You cannot change your own role or status.');

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, status: true, role: { select: { name: true } } } });
  if (!user) throw notFound('User');

  const changes: string[] = [];
  const data: Prisma.UserUncheckedUpdateInput = {};
  if (input.role && input.role !== user.role.name) {
    if (user.role.name === 'ADMIN') await assertNotLastAdmin(id);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: input.role } });
    data.roleId = role.id;
    changes.push(`role ${ROLE_LABELS[user.role.name as keyof typeof ROLE_LABELS]} → ${role.label}`);
  }
  if (input.status && input.status !== user.status) {
    if (input.status === 'SUSPENDED' && user.role.name === 'ADMIN') await assertNotLastAdmin(id);
    data.status = input.status;
    changes.push(input.status === 'SUSPENDED' ? 'suspended' : 'reactivated');
  }
  if (changes.length === 0) {
    const unchanged = await prisma.user.findUniqueOrThrow({ where: { id }, select: publicUserSelect });
    return res.json({ user: toPublicUser(unchanged) });
  }

  const updated = await prisma.user.update({ where: { id }, data, select: publicUserSelect });
  // Role changes and suspensions take effect immediately: sign the user out everywhere.
  await destroyUserSessions(id);
  if (data.status === 'SUSPENDED') {
    await prisma.journey.updateMany({
      where: { userId: id, status: { in: ['ACTIVE', 'PAUSED'] } },
      data: { status: 'CANCELLED', endedAt: new Date(), endReason: 'ACCOUNT_SUSPENDED' },
    });
  }
  await audit(req, {
    action: data.roleId ? 'user.role_change' : 'user.status_change',
    entityType: 'user',
    entityId: id,
    summary: `${user.email}: ${changes.join(', ')}`,
  });
  res.json({ user: toPublicUser(updated) });
});

/** POST /api/admin/users/:id/reset-password — issues a one-time temporary password. */
adminRouter.post('/users/:id/reset-password', requirePermission(PERMISSIONS.USERS_MANAGE), async (req, res) => {
  const id = idParam(req.params.id, 'User');
  if (id === req.auth!.user.id) throw badRequest('Use Settings → Change password for your own account.');
  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
  if (!user) throw notFound('User');

  const temporaryPassword = generateTemporaryPassword();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true },
  });
  await destroyUserSessions(id);
  await audit(req, {
    action: 'user.password_reset',
    entityType: 'user',
    entityId: id,
    summary: `Issued a temporary password for ${user.email}`,
  });
  // Shown once to the administrator; only the hash is stored.
  res.json({ temporaryPassword });
});

/** GET /api/admin/roles — roles, their permissions and how many users hold each. */
adminRouter.get('/roles', requirePermission(PERMISSIONS.USERS_MANAGE), async (_req, res) => {
  const roles = await prisma.role.findMany({
    include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
    orderBy: { id: 'asc' },
  });
  const permissions = await prisma.permission.findMany({ orderBy: { key: 'asc' } });
  res.json({
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      label: r.label,
      description: r.description,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.key).sort(),
    })),
    permissions,
  });
});

// ---------------------------------------------------------------------------
// Audit log, error log and reports
// ---------------------------------------------------------------------------

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
};

/** GET /api/admin/audit-logs?entityType=&action=&search=&page= */
adminRouter.get('/audit-logs', requirePermission(PERMISSIONS.AUDIT_VIEW), async (req, res) => {
  const q = parse(
    z.object({
      entityType: z.string().max(40).optional(),
      action: z.string().max(60).optional(),
      search: z.string().max(100).optional(),
      ...pageQuery,
    }),
    req.query,
  );
  const where: Prisma.AuditLogWhereInput = {
    ...(q.entityType ? { entityType: q.entityType } : {}),
    ...(q.action ? { action: { startsWith: q.action } } : {}),
    ...(q.search ? { summary: { contains: q.search } } : {}),
  };
  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: actorSelect },
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  res.json({ logs, total, page: q.page, pageSize: q.pageSize });
});

/** GET /api/admin/errors?source=SERVER|CLIENT&page= */
adminRouter.get('/errors', requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
  const q = parse(z.object({ source: z.enum(['SERVER', 'CLIENT']).optional(), ...pageQuery }), req.query);
  const where: Prisma.ErrorLogWhereInput = q.source ? { source: q.source } : {};
  const [total, errors] = await Promise.all([
    prisma.errorLog.count({ where }),
    prisma.errorLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
  ]);
  res.json({ errors, total, page: q.page, pageSize: q.pageSize });
});

function countBy<T>(items: T[], key: (item: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

/** GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD — statistics and error report for a period. */
adminRouter.get('/reports', requirePermission(PERMISSIONS.REPORTS_VIEW), async (req, res) => {
  const range = parseDateRange(req.query, 30);
  const inRange = { gte: range.from, lte: range.to };

  const [users, journeys, ticketsCreated, ticketsResolved, errors] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: inRange }, select: { createdAt: true, role: { select: { name: true } } } }),
    prisma.journey.findMany({
      where: { startedAt: inRange },
      select: {
        startedAt: true,
        status: true,
        alertTriggeredAt: true,
        usedSimulation: true,
        destinationName: true,
        routeNumber: true,
        routeName: true,
        endReason: true,
      },
    }),
    prisma.supportTicket.findMany({ where: { createdAt: inRange }, select: { createdAt: true, category: true, status: true } }),
    prisma.supportTicket.findMany({ where: { resolvedAt: inRange }, select: { resolvedAt: true, createdAt: true } }),
    prisma.errorLog.findMany({ where: { createdAt: inRange }, select: { createdAt: true, source: true, message: true } }),
  ]);

  const keys = dayKeys(range.from, range.to);
  const series = keys.map((date) => ({
    date,
    newUsers: 0,
    journeys: 0,
    alerts: 0,
    ticketsOpened: 0,
    ticketsResolved: 0,
    errors: 0,
  }));
  const idx = new Map(keys.map((k, i) => [k, i]));
  const bump = (d: Date | null, field: keyof (typeof series)[number]) => {
    if (!d) return;
    const i = idx.get(dayKey(d));
    if (i !== undefined) (series[i][field] as number) += 1;
  };
  users.forEach((u) => bump(u.createdAt, 'newUsers'));
  journeys.forEach((j) => {
    bump(j.startedAt, 'journeys');
    if (j.alertTriggeredAt) bump(j.startedAt, 'alerts');
  });
  ticketsCreated.forEach((t) => bump(t.createdAt, 'ticketsOpened'));
  ticketsResolved.forEach((t) => bump(t.resolvedAt, 'ticketsResolved'));
  errors.forEach((e) => bump(e.createdAt, 'errors'));

  const withAlert = journeys.filter((j) => j.alertTriggeredAt).length;
  const resolutionHours = ticketsResolved.map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 3_600_000);

  const topErrors = new Map<string, { message: string; source: string; count: number; lastSeen: Date }>();
  for (const e of errors) {
    const k = `${e.source}:${e.message}`;
    const entry = topErrors.get(k) ?? { message: e.message, source: e.source, count: 0, lastSeen: e.createdAt };
    entry.count += 1;
    if (e.createdAt > entry.lastSeen) entry.lastSeen = e.createdAt;
    topErrors.set(k, entry);
  }

  res.json({
    from: range.from,
    to: range.to,
    days: range.days,
    totals: {
      newUsers: users.length,
      newPassengers: users.filter((u) => u.role.name === 'PASSENGER').length,
      journeys: journeys.length,
      alerts: withAlert,
      alertRate: journeys.length ? withAlert / journeys.length : null,
      simulatedJourneys: journeys.filter((j) => j.usedSimulation).length,
      ticketsOpened: ticketsCreated.length,
      ticketsResolved: ticketsResolved.length,
      averageResolutionHours: resolutionHours.length
        ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length
        : null,
      errors: errors.length,
      serverErrors: errors.filter((e) => e.source === 'SERVER').length,
      clientErrors: errors.filter((e) => e.source === 'CLIENT').length,
    },
    series,
    journeyOutcomes: {
      COMPLETED: journeys.filter((j) => j.status === 'COMPLETED').length,
      CANCELLED: journeys.filter((j) => j.status === 'CANCELLED').length,
      ACTIVE: journeys.filter((j) => j.status === 'ACTIVE').length,
      PAUSED: journeys.filter((j) => j.status === 'PAUSED').length,
    },
    topDestinations: countBy(journeys, (j) => j.destinationName).slice(0, 8),
    topRoutes: countBy(journeys, (j) => `${j.routeNumber} · ${j.routeName}`).slice(0, 8),
    ticketsByCategory: Object.fromEntries(
      TICKET_CATEGORIES.map((c) => [c, ticketsCreated.filter((t) => t.category === c).length]),
    ),
    ticketsByStatus: Object.fromEntries(TICKET_STATUSES.map((s) => [s, ticketsCreated.filter((t) => t.status === s).length])),
    topErrors: [...topErrors.values()].sort((a, b) => b.count - a.count).slice(0, 10),
  });
});

// ---------------------------------------------------------------------------
// System settings
// ---------------------------------------------------------------------------

/** GET /api/admin/settings */
adminRouter.get('/settings', requirePermission(PERMISSIONS.SETTINGS_MANAGE), async (_req, res) => {
  res.json({ settings: await getSettings() });
});

/** PUT /api/admin/settings */
adminRouter.put('/settings', requirePermission(PERMISSIONS.SETTINGS_MANAGE), async (req, res) => {
  const input = parse(systemSettingsSchema, req.body);
  const before = await getSettings();
  const settings = await saveSettings(input, req.auth!.user.id);
  const changed = (Object.keys(input) as Array<keyof typeof input>).filter((k) => before[k] !== input[k]);
  await audit(req, {
    action: 'settings.update',
    entityType: 'settings',
    summary: changed.length ? `Changed system settings: ${changed.join(', ')}` : 'Saved system settings (no changes)',
    metadata: Object.fromEntries(changed.map((k) => [k, { from: before[k], to: input[k] }])),
  });
  res.json({ settings });
});
