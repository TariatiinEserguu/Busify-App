/**
 * `npm run create-admin` — creates (or promotes) a real administrator account.
 * Use this instead of the demo accounts for anything beyond a classroom demo.
 *
 *   npm run create-admin
 *   npm run create-admin -- --email you@example.com --name "Your Name"
 */
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { emailSchema, passwordSchema } from '@busify/shared';
import { audit } from '../lib/audit';
import { hashPassword } from '../lib/password';
import { prisma } from '../lib/prisma';
import { seedBaseData } from '../lib/seedBase';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

let muted = false;
const output = new Writable({
  write(chunk, _enc, cb) {
    if (!muted) process.stdout.write(chunk);
    cb();
  },
});
const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
const ask = (q: string) => new Promise<string>((resolve) => rl.question(q, resolve));

async function askHidden(q: string) {
  process.stdout.write(q);
  muted = true;
  const answer = await ask('');
  muted = false;
  process.stdout.write('\n');
  return answer;
}

async function main() {
  await seedBaseData(prisma);

  const email = emailSchema.parse(arg('email') ?? (await ask('Administrator email: ')));
  const name = (arg('name') ?? (await ask('Full name: '))).trim() || 'Administrator';
  let password = process.env.ADMIN_PASSWORD ?? '';
  while (!passwordSchema.safeParse(password).success) {
    if (password) console.log(`  ${passwordSchema.safeParse(password).error?.issues[0]?.message}`);
    password = await askHidden('Password (8+ characters, letters and numbers): ');
    const confirm = await askHidden('Repeat password: ');
    if (password !== confirm) {
      console.log('  Passwords do not match.');
      password = '';
    }
  }

  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, roleId: role.id, settings: { create: {} } },
    update: { name, passwordHash, roleId: role.id, status: 'ACTIVE', isDemoAccount: false, mustChangePassword: false },
  });
  await prisma.session.deleteMany({ where: { userId: user.id } });
  await audit(null, {
    actorId: null,
    action: 'user.create_admin',
    entityType: 'user',
    entityId: user.id,
    summary: `Administrator ${email} created from the command line`,
  });
  console.log(`✔ Administrator ready: ${email}`);
}

main()
  .catch((err) => {
    console.error('✖', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
