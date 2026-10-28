import { Router } from 'express';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';

export const healthRouter = Router();

const startedAt = Date.now();

/** GET /api/health — liveness plus a real database round-trip. */
healthRouter.get('/', async (_req, res) => {
  let database: 'ok' | 'error' = 'ok';
  let databaseError: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    database = 'error';
    databaseError = err instanceof Error ? err.message.split('\n').slice(-1)[0] : 'unknown';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    database,
    ...(databaseError && env.NODE_ENV !== 'production' ? { databaseError } : {}),
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    demoMode: env.DEMO_MODE,
  });
});
