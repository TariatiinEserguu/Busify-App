/**
 * Server-side sessions. The browser holds a random 256-bit token in an
 * httpOnly cookie; the database stores only its SHA-256 hash, so a leaked
 * database cannot be used to hijack sessions. Logging out deletes the row.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import type { PermissionKey } from '@busify/shared';
import { cookieSecure, env } from '../config/env';
import { prisma } from './prisma';
import { publicUserSelect, toPublicUser, type AuthContext } from './users';

export const SESSION_COOKIE = 'busify_session';

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: number, req: Request) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 3600 * 1000);
  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      expiresAt,
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
      ipAddress: req.ip ?? null,
    },
  });
  return { token, expiresAt };
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: cookieSecure,
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'strict', secure: cookieSecure, path: '/' });
}

const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/** Resolves a cookie token to the user, role and permissions loaded fresh from the database. */
export async function resolveSession(token: string): Promise<AuthContext | null> {
  const id = hashToken(token);
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          ...publicUserSelect,
          role: {
            select: {
              name: true,
              label: true,
              permissions: { select: { permission: { select: { key: true } } } },
            },
          },
        },
      },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    prisma.session.update({ where: { id }, data: { lastUsedAt: new Date() } }).catch(() => undefined);
  }
  const permissions = new Set(session.user.role.permissions.map((rp) => rp.permission.key as PermissionKey));
  return { sessionId: id, user: toPublicUser(session.user), permissions };
}

export function destroySession(sessionId: string) {
  return prisma.session.deleteMany({ where: { id: sessionId } });
}

export function destroyUserSessions(userId: number, exceptSessionId?: string) {
  return prisma.session.deleteMany({
    where: { userId, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
  });
}

export function purgeExpiredSessions() {
  return prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
