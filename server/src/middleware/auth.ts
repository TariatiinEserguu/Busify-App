import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES, type PermissionKey } from '@busify/shared';
import { env } from '../config/env';
import { forbidden, unauthorized } from '../lib/http';
import { clearSessionCookie, destroySession, resolveSession, SESSION_COOKIE } from '../lib/sessions';

/**
 * Attaches `req.auth` when the request carries a valid session cookie.
 * Suspended users and (outside DEMO_MODE) demo accounts lose their session.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return next();

  const auth = await resolveSession(token);
  if (!auth) {
    clearSessionCookie(res);
    return next();
  }
  if (auth.user.status !== 'ACTIVE' || (auth.user.isDemoAccount && !env.DEMO_MODE)) {
    await destroySession(auth.sessionId);
    clearSessionCookie(res);
    return next();
  }
  req.auth = auth;
  next();
}

/** Signed in, even if a password change is pending (used by /auth endpoints). */
export function requireSession(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  next();
}

/** Signed in with no pending forced password change. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) return next(unauthorized());
  if (req.auth.user.mustChangePassword) {
    return next(
      forbidden('You must choose a new password before continuing.', ERROR_CODES.PASSWORD_CHANGE_REQUIRED),
    );
  }
  next();
}

/** Signed in and the user's role grants every listed permission. */
export function requirePermission(...keys: PermissionKey[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, (err?: unknown) => {
      if (err) return next(err);
      const missing = keys.filter((k) => !req.auth!.permissions.has(k));
      if (missing.length > 0) return next(forbidden());
      next();
    });
  };
}

export function hasPermission(req: Request, key: PermissionKey): boolean {
  return !!req.auth?.permissions.has(key);
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence: state-changing requests must carry the X-Busify-Client header.
 * Browsers cannot add custom headers to cross-site requests without a CORS
 * preflight, which this server only grants to configured origins. Together
 * with SameSite=Strict cookies this blocks cross-site request forgery.
 */
export function requireClientHeader(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.get('x-busify-client')) {
    return next(forbidden('Missing X-Busify-Client header.', ERROR_CODES.CSRF));
  }
  next();
}
