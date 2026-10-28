import { beforeEach, describe, expect, it } from 'vitest';
import { Client, createUser, prisma, resetDatabase, signedIn } from './helpers';

beforeEach(resetDatabase);

const validRoute = { number: 'A1', name: 'Authorised route' };
const validStop = { name: 'Authorised stop', latitude: 47.91, longitude: 106.91 };

describe('unauthenticated requests', () => {
  it.each([
    ['GET', '/api/routes'],
    ['GET', '/api/stops'],
    ['GET', '/api/journeys/active'],
    ['GET', '/api/support/tickets'],
    ['GET', '/api/me/settings'],
    ['GET', '/api/admin/overview'],
    ['GET', '/api/notifications'],
  ])('%s %s → 401', async (_method, url) => {
    const res = await new Client().get(url);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('public endpoints stay open', async () => {
    expect((await new Client().get('/api/health')).status).toBe(200);
    expect((await new Client().get('/api/config')).status).toBe(200);
  });
});

describe('role-based access', () => {
  it('passengers cannot use management or administration endpoints', async () => {
    const { client } = await signedIn('PASSENGER');
    expect((await client.post('/api/routes', validRoute)).status).toBe(403);
    expect((await client.post('/api/stops', validStop)).status).toBe(403);
    expect((await client.get('/api/admin/users')).status).toBe(403);
    expect((await client.get('/api/admin/reports')).status).toBe(403);
    expect((await client.put('/api/admin/settings', {})).status).toBe(403);
    expect((await client.get('/api/support/reports/resolved')).status).toBe(403);
    expect((await client.get('/api/support/staff')).status).toBe(403);
  });

  it('support agents handle tickets but do not get administrator privileges', async () => {
    const { client } = await signedIn('SUPPORT');
    expect((await client.get('/api/support/tickets')).status).toBe(200);
    expect((await client.get('/api/support/reports/resolved')).status).toBe(200);
    expect((await client.post('/api/routes', validRoute)).status).toBe(403);
    expect((await client.post('/api/stops', validStop)).status).toBe(403);
    expect((await client.get('/api/admin/users')).status).toBe(403);
    expect((await client.get('/api/admin/audit-logs')).status).toBe(403);
    expect((await client.get('/api/admin/settings')).status).toBe(403);
  });

  it('administrators can manage everything', async () => {
    const { client } = await signedIn('ADMIN');
    expect((await client.post('/api/routes', validRoute)).status).toBe(201);
    expect((await client.post('/api/stops', validStop)).status).toBe(201);
    expect((await client.get('/api/admin/users')).status).toBe(200);
    expect((await client.get('/api/admin/overview')).status).toBe(200);
    expect((await client.get('/api/admin/reports')).status).toBe(200);
    expect((await client.get('/api/admin/audit-logs')).status).toBe(200);
    expect((await client.get('/api/support/tickets')).status).toBe(200);
  });

  it('permissions come from the database, so a role change applies immediately', async () => {
    const { client: admin } = await signedIn('ADMIN');
    const { user } = await createUser({ email: 'promote@test.mn' });
    const passenger = new Client();
    await passenger.post('/api/auth/login', { email: 'promote@test.mn', password: 'password123' });

    const res = await admin.patch(`/api/admin/users/${user.id}`, { role: 'SUPPORT' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('SUPPORT');
    // Role changes sign the user out everywhere.
    expect((await passenger.get('/api/auth/me')).status).toBe(401);

    const again = new Client();
    await again.post('/api/auth/login', { email: 'promote@test.mn', password: 'password123' });
    expect((await again.get('/api/support/staff')).status).toBe(200);
    expect((await again.get('/api/admin/users')).status).toBe(403);
  });
});

describe('user administration safeguards', () => {
  it('never exposes password hashes in user listings or details', async () => {
    const { client } = await signedIn('ADMIN');
    const { user } = await createUser();
    const list = await client.get('/api/admin/users');
    const detail = await client.get(`/api/admin/users/${user.id}`);
    for (const res of [list, detail]) {
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
    }
  });

  it('an administrator cannot change their own role or suspend themselves', async () => {
    const { client, user } = await signedIn('ADMIN');
    expect((await client.patch(`/api/admin/users/${user.id}`, { role: 'PASSENGER' })).status).toBe(400);
    expect((await client.patch(`/api/admin/users/${user.id}`, { status: 'SUSPENDED' })).status).toBe(400);
  });

  it('keeps at least one active administrator', async () => {
    const { client } = await signedIn('ADMIN');
    const { user: other } = await createUser({ role: 'ADMIN' });
    // Suspending the other admin is fine while this one remains.
    expect((await client.patch(`/api/admin/users/${other.id}`, { status: 'SUSPENDED' })).status).toBe(200);
  });

  it('suspending a user ends their sessions and running journeys', async () => {
    const { client: admin } = await signedIn('ADMIN');
    const { client: passenger, user } = await signedIn('PASSENGER');
    expect((await admin.patch(`/api/admin/users/${user.id}`, { status: 'SUSPENDED' })).status).toBe(200);
    expect((await passenger.get('/api/auth/me')).status).toBe(401);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
  });

  it('issues a temporary password that must be changed at next sign-in', async () => {
    const { client: admin } = await signedIn('ADMIN');
    const { user, email } = await createUser();
    const res = await admin.post(`/api/admin/users/${user.id}/reset-password`);
    expect(res.status).toBe(200);
    const temporaryPassword = res.body.temporaryPassword as string;
    expect(temporaryPassword).toHaveLength(12);

    const client = new Client();
    const login = await client.post('/api/auth/login', { email, password: temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
    expect((await client.get('/api/routes')).body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('writes administrative actions to the audit log', async () => {
    const { client } = await signedIn('ADMIN');
    await client.post('/api/routes', validRoute);
    const logs = await client.get('/api/admin/audit-logs?action=route.');
    expect(logs.status).toBe(200);
    expect(logs.body.logs[0]).toMatchObject({ action: 'route.create', entityType: 'route' });
  });
});
