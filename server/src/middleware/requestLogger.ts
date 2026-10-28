import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';

/** Logs one line per API request: method, path, status, duration and user. */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api')) return next();
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const who = req.auth ? ` user=${req.auth.user.id}` : '';
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms${who}`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else if (req.path === '/api/health') logger.debug(line);
    else logger.info(line);
  });
  next();
}
