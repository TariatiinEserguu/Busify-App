import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/** One shared Prisma client for the whole process. */
export const prisma = new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
  log: env.LOG_LEVEL === 'debug' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});
