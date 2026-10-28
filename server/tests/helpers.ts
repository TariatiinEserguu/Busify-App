import request from 'supertest';
import type { RoleName } from '@busify/shared';
import { createApp } from '../src/app';
import { hashPassword } from '../src/lib/password';
import { prisma } from '../src/lib/prisma';
import { seedBaseData } from '../src/lib/seedBase';
import { clearSettingsCache } from '../src/lib/settings';

export { prisma };
export const app = createApp();

/** Empties every table and re-creates roles, permissions and default settings. */
export async function resetDatabase() {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.ticketEvent.deleteMany(),
    prisma.supportResponse.deleteMany(),
    prisma.supportTicket.deleteMany(),
    prisma.journey.deleteMany(),
    prisma.routeStop.deleteMany(),
    prisma.route.deleteMany(),
    prisma.stop.deleteMany(),
    prisma.session.deleteMany(),
    prisma.userSettings.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.errorLog.deleteMany(),
    prisma.user.deleteMany(),
    prisma.systemSetting.deleteMany(),
  ]);
  clearSettingsCache();
  await seedBaseData(prisma);
}

/** A browser-like client: keeps cookies and sends the CSRF header on writes. */
export class Client {
  readonly agent = request.agent(app);
  get(url: string) {
    return this.agent.get(url);
  }
  post(url: string, body: object = {}) {
    return this.agent.post(url).set('X-Busify-Client', 'test').send(body);
  }
  put(url: string, body: object = {}) {
    return this.agent.put(url).set('X-Busify-Client', 'test').send(body);
  }
  patch(url: string, body: object = {}) {
    return this.agent.patch(url).set('X-Busify-Client', 'test').send(body);
  }
  delete(url: string) {
    return this.agent.delete(url).set('X-Busify-Client', 'test');
  }
}

let counter = 0;

export async function createUser(
  opts: {
    role?: RoleName;
    email?: string;
    password?: string;
    status?: 'ACTIVE' | 'SUSPENDED';
    isDemoAccount?: boolean;
    mustChangePassword?: boolean;
  } = {},
) {
  counter += 1;
  const role = await prisma.role.findUniqueOrThrow({ where: { name: opts.role ?? 'PASSENGER' } });
  const email = opts.email ?? `user${counter}@test.mn`;
  const password = opts.password ?? 'password123';
  const user = await prisma.user.create({
    data: {
      email,
      name: `Test User ${counter}`,
      passwordHash: await hashPassword(password),
      roleId: role.id,
      status: opts.status ?? 'ACTIVE',
      isDemoAccount: !!opts.isDemoAccount,
      mustChangePassword: !!opts.mustChangePassword,
    },
  });
  return { user, email, password };
}

/** Creates a user of the given role and returns a client signed in as them. */
export async function signedIn(role: RoleName = 'PASSENGER') {
  const { user, email, password } = await createUser({ role });
  const client = new Client();
  const res = await client.post('/api/auth/login', { email, password });
  if (res.status !== 200) throw new Error(`Login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { client, user };
}

/** Inserts a route with stops spaced roughly 700 m apart along a line. */
export async function createRoute(opts: { number?: string; status?: 'ACTIVE' | 'INACTIVE' | 'DRAFT'; stops?: number } = {}) {
  counter += 1;
  const count = opts.stops ?? 4;
  const stops = [];
  for (let i = 0; i < count; i++) {
    stops.push(
      await prisma.stop.create({
        data: { name: `Stop ${counter}-${i + 1}`, latitude: 47.9 + i * 0.0063, longitude: 106.9 },
      }),
    );
  }
  const route = await prisma.route.create({
    data: {
      number: opts.number ?? `T${counter}`,
      name: `Test route ${counter}`,
      status: opts.status ?? 'ACTIVE',
      stops: { create: stops.map((s, i) => ({ stopId: s.id, position: i + 1 })) },
    },
  });
  return { route, stops };
}
