import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { Prisma } from '@prisma/client';
import { env, sqliteFilePath } from '../config/env';
import { logger } from './logger';
import { prisma } from './prisma';

export class StartupError extends Error {}

/** Verifies the database is reachable, migrated and seeded before the server accepts requests. */
export async function checkDatabase() {
  const file = sqliteFilePath();
  mkdirSync(path.dirname(file), { recursive: true });
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    throw new StartupError(
      `Cannot open the SQLite database at ${file}.\n` +
        `  ${err instanceof Error ? err.message.trim().split('\n').pop() : String(err)}\n` +
        '  Check DATABASE_URL in .env, then run `npm run setup`.',
    );
  }

  let roles: number;
  try {
    roles = await prisma.role.count();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && (err.code === 'P2021' || err.code === 'P2022')) {
      throw new StartupError(
        `The database at ${file} has no BUSIFY tables yet (or an old schema).\n  Run \`npm run setup\` (or \`npm run db:migrate\`).`,
      );
    }
    throw err;
  }
  if (roles === 0) {
    throw new StartupError('The database has no roles. Run `npm run db:seed` (npm run setup does this for you).');
  }

  const admins = await prisma.user.count({ where: { role: { name: 'ADMIN' }, status: 'ACTIVE' } });
  if (admins === 0) {
    logger.warn('There is no administrator account yet. Create one with `npm run create-admin`.');
  }

  const demoAccounts = await prisma.user.count({ where: { isDemoAccount: true } });
  if (demoAccounts > 0 && !env.DEMO_MODE) {
    logger.warn(
      `${demoAccounts} demo account(s) exist but DEMO_MODE=false, so they cannot sign in. ` +
        'Remove demo data with `npm run db:remove-demo`.',
    );
  } else if (demoAccounts > 0) {
    logger.warn('DEMO_MODE=true: demonstration accounts can sign in. Turn it off for any real deployment.');
  }
  return { file };
}
