import type { Prisma } from '@prisma/client';
import { logger } from './logger';
import { prisma } from './prisma';

export interface ErrorEntry {
  source: 'SERVER' | 'CLIENT';
  message: string;
  stack?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  userId?: number | null;
  userAgent?: string | null;
  context?: Prisma.InputJsonValue;
}

/** Stores an error for the admin error report. Best effort — if the database is down we only log. */
export async function recordError(entry: ErrorEntry) {
  try {
    await prisma.errorLog.create({
      data: {
        source: entry.source,
        message: entry.message.slice(0, 1000),
        stack: entry.stack?.slice(0, 5000) ?? null,
        method: entry.method ?? null,
        path: entry.path?.slice(0, 500) ?? null,
        statusCode: entry.statusCode ?? null,
        userId: entry.userId ?? null,
        userAgent: entry.userAgent?.slice(0, 300) ?? null,
        context: entry.context,
      },
    });
  } catch (err) {
    logger.warn('Could not store error log entry', err instanceof Error ? err.message : err);
  }
}
