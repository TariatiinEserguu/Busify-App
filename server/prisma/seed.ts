/**
 * `npm run db:seed` — creates the roles, permissions and default settings
 * BUSIFY needs. It does not create any accounts, routes or stops.
 */
import { prisma } from '../src/lib/prisma';
import { seedBaseData } from '../src/lib/seedBase';

async function main() {
  const result = await seedBaseData(prisma);
  console.log(`✔ Base data ready: ${result.roles} roles, ${result.permissions} permissions, default settings.`);
}

main()
  .catch((err) => {
    console.error('✖ Seeding failed:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
