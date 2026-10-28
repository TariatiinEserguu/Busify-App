import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { changePasswordSchema, ERROR_CODES, loginSchema, registerSchema } from '@busify/shared';
import { env } from '../config/env';
import { audit } from '../lib/audit';
import { conflict, forbidden, HttpError, parse, unauthorized } from '../lib/http';
import { dummyPasswordHash, hashPassword, verifyPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import {
  clearSessionCookie,
  createSession,
  destroySession,
  destroyUserSessions,
  setSessionCookie,
} from '../lib/sessions';
import { getSettings } from '../lib/settings';
import { publicUserSelect, toPublicUser } from '../lib/users';
import { requireSession } from '../middleware/auth';

export const authRouter = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: { code: ERROR_CODES.RATE_LIMITED, message: 'Too many attempts. Please wait a few minutes and try again.' },
    });
  },
});

async function sessionPayload(userId: number) {
  const row = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      ...publicUserSelect,
      role: { select: { name: true, label: true, permissions: { select: { permission: { select: { key: true } } } } } },
    },
  });
  return {
    user: toPublicUser(row),
    permissions: row.role.permissions.map((p) => p.permission.key).sort(),
  };
}

async function signIn(req: Request, res: Response, userId: number) {
  const { token, expiresAt } = await createSession(userId, req);
  setSessionCookie(res, token, expiresAt);
}

/** POST /api/auth/register — creates a passenger account. Any role sent by the client is ignored. */
authRouter.post('/register', authLimiter, async (req, res) => {
  const settings = await getSettings();
  if (!settings.registrationOpen) {
    throw forbidden('New registrations are currently closed by the administrator.', ERROR_CODES.REGISTRATION_CLOSED);
  }
  const input = parse(registerSchema, req.body);

  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict('An account with this email already exists. Try signing in instead.');

  const passengerRole = await prisma.role.findUnique({ where: { name: 'PASSENGER' } });
  if (!passengerRole) {
    throw new HttpError(503, ERROR_CODES.INTERNAL, 'Roles are not set up yet. Run `npm run db:seed` on the server.');
  }

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      roleId: passengerRole.id,
      lastLoginAt: new Date(),
      settings: { create: { alertRadiusM: settings.defaultAlertRadiusM } },
    },
    select: { id: true, email: true },
  });

  await audit(req, {
    actorId: user.id,
    action: 'auth.register',
    entityType: 'user',
    entityId: user.id,
    summary: `New passenger account ${user.email}`,
  });
  await signIn(req, res, user.id);
  res.status(201).json(await sessionPayload(user.id));
});

/** POST /api/auth/login */
authRouter.post('/login', authLimiter, async (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, passwordHash: true, status: true, isDemoAccount: true },
  });

  if (!user) {
    await verifyPassword(input.password, await dummyPasswordHash());
    throw unauthorized('Email or password is incorrect.');
  }
  if (!(await verifyPassword(input.password, user.passwordHash))) {
    await audit(req, {
      actorId: user.id,
      action: 'auth.login_failed',
      entityType: 'user',
      entityId: user.id,
      summary: `Failed sign-in for ${user.email}`,
    });
    throw unauthorized('Email or password is incorrect.');
  }
  if (user.status !== 'ACTIVE') {
    throw forbidden('This account is suspended. Contact the administrator.', ERROR_CODES.ACCOUNT_SUSPENDED);
  }
  if (user.isDemoAccount && !env.DEMO_MODE) {
    throw forbidden(
      'Demonstration accounts are disabled on this server (DEMO_MODE=false).',
      ERROR_CODES.DEMO_ACCOUNT_DISABLED,
    );
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(req, {
    actorId: user.id,
    action: 'auth.login',
    entityType: 'user',
    entityId: user.id,
    summary: `Signed in: ${user.email}`,
  });
  await signIn(req, res, user.id);
  res.json(await sessionPayload(user.id));
});

/** POST /api/auth/logout — deletes the server-side session and clears the cookie. */
authRouter.post('/logout', async (req, res) => {
  if (req.auth) {
    await destroySession(req.auth.sessionId);
    await audit(req, {
      action: 'auth.logout',
      entityType: 'user',
      entityId: req.auth.user.id,
      summary: `Signed out: ${req.auth.user.email}`,
    });
  }
  clearSessionCookie(res);
  res.status(204).end();
});

/** GET /api/auth/me — the signed-in user and their permissions. */
authRouter.get('/me', requireSession, async (req, res) => {
  res.json(await sessionPayload(req.auth!.user.id));
});

/** POST /api/auth/change-password — also signs out every other session. */
authRouter.post('/change-password', requireSession, authLimiter, async (req, res) => {
  const input = parse(changePasswordSchema, req.body);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.user.id },
    select: { id: true, passwordHash: true },
  });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new HttpError(400, ERROR_CODES.VALIDATION, 'Current password is incorrect.', {
      issues: [{ path: 'currentPassword', message: 'Current password is incorrect.' }],
    });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword), mustChangePassword: false },
  });
  await destroyUserSessions(user.id, req.auth!.sessionId);
  await audit(req, {
    action: 'auth.password_change',
    entityType: 'user',
    entityId: user.id,
    summary: 'Password changed; other sessions signed out',
  });
  res.json(await sessionPayload(user.id));
});
