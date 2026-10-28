import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ERROR_CODES } from '@busify/shared';
import { HttpError } from '../lib/http';
import { logger } from '../lib/logger';
import { recordError } from '../lib/errorLog';

export function apiNotFound(req: Request, res: Response) {
  res.status(404).json({ error: { code: ERROR_CODES.NOT_FOUND, message: `No API endpoint ${req.method} ${req.path}` } });
}

function send(res: Response, status: number, code: string, message: string, extra?: Record<string, unknown>) {
  res.status(status).json({ error: { code, message, ...extra } });
}

/** Converts any thrown error into a consistent JSON response and records unexpected ones. */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return send(res, err.status, err.code, err.message, err.details);
  }

  const e = err as { type?: string; status?: number; message?: string };
  if (e?.type === 'entity.parse.failed') {
    return send(res, 400, ERROR_CODES.VALIDATION, 'The request body is not valid JSON.');
  }
  if (e?.type === 'entity.too.large') {
    return send(res, 413, ERROR_CODES.VALIDATION, 'The request body is too large.');
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | string | undefined) ?? 'value';
      return send(res, 409, ERROR_CODES.CONFLICT, `A record with this ${String(target)} already exists.`);
    }
    if (err.code === 'P2025') return send(res, 404, ERROR_CODES.NOT_FOUND, 'Record not found.');
    if (err.code === 'P2003') {
      return send(res, 409, ERROR_CODES.CONFLICT, 'This record is linked to other data and cannot be changed that way.');
    }
    if (err.code === 'P2021' || err.code === 'P2022') {
      logger.error('Database schema is missing or out of date. Run `npm run db:migrate`.', err.message);
      return send(res, 503, ERROR_CODES.INTERNAL, 'The database is not initialised. Ask the administrator to run setup.');
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    logger.error('Cannot open the database', err.message);
    return send(res, 503, ERROR_CODES.INTERNAL, 'The database is unavailable right now. Please try again shortly.');
  }

  const error = err instanceof Error ? err : new Error(String(err));
  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, error);
  void recordError({
    source: 'SERVER',
    message: error.message || 'Unknown error',
    stack: error.stack,
    method: req.method,
    path: req.originalUrl,
    statusCode: 500,
    userId: req.auth?.user.id ?? null,
    userAgent: req.get('user-agent') ?? null,
  });
  send(res, 500, ERROR_CODES.INTERNAL, 'Something went wrong on the server. The error has been logged.');
}
