/**
 * `npm run db:remove-demo` — deletes everything created by the demo seed:
 * demo accounts (with their journeys, tickets and notifications) and demo
 * routes and stops. Real data entered through the admin dashboard is kept.
 */
import { prisma } from '../lib/prisma';
import { audit } from '../lib/audit';

async function main() {
  const users = await prisma.user.deleteMany({ where: { isDemoAccount: true } });
  const routes = await prisma.route.deleteMany({ where: { isDemo: true } });
  const stops = await prisma.stop.deleteMany({ where: { isDemo: true } });
  await audit(null, {
    actorId: null,
    action: 'system.demo_remove',
    entityType: 'system',
    summary: `Removed demo data: ${users.count} accounts, ${routes.count} routes, ${stops.count} stops`,
  });
  console.log(`✔ Removed ${users.count} demo accounts, ${routes.count} demo routes and ${stops.count} demo stops.`);
  const admins = await prisma.user.count({ where: { role: { name: 'ADMIN' }, status: 'ACTIVE' } });
  if (admins === 0) console.log('  No administrator remains — create one with `npm run create-admin`.');
}

main()
  .catch((err) => {
    console.error('✖', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
