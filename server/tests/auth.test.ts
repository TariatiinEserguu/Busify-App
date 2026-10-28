import { beforeEach, describe, expect, it } from 'vitest';
import { Client, createUser, prisma, resetDatabase } from './helpers';

beforeEach(resetDatabase);

const registration = { name: 'Saraa Bold', email: 'Saraa@Example.mn', password: 'secret123' };

describe('registration', () => {
  it('creates a passenger, signs them in with an httpOnly cookie and never returns the hash', async () => {
    const client = new Client();
    const res = await client.post('/api/auth/register', registration);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'saraa@example.mn', role: 'PASSENGER', name: 'Saraa Bold' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/busify_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);

    const me = await client.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.permissions).toContain('journeys:use');
    expect(me.body.permissions).not.toContain('routes:manage');
  });

  it('stores a bcrypt hash, not the password', async () => {
    await new Client().post('/api/auth/register', registration);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'saraa@example.mn' } });
    expect(user.passwordHash).not.toBe(registration.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('ignores a role sent by the client', async () => {
    const res = await new Client().post('/api/auth/register', { ...registration, role: 'ADMIN', roleId: 3 });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('PASSENGER');
  });

  it('rejects invalid input with field-level messages', async () => {
    const res = await new Client().post('/api/auth/register', { name: 'A', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('rejects a duplicate email', async () => {
    await new Client().post('/api/auth/register', registration);
    const res = await new Client().post('/api/auth/register', { ...registration, email: 'saraa@example.mn' });
    expect(res.status).toBe(409);
  });

  it('is refused when the administrator closed registration', async () => {
    await prisma.systemSetting.update({ where: { key: 'registrationOpen' }, data: { value: 'false' } });
    const { clearSettingsCache } = await import('../src/lib/settings');
    clearSettingsCache();
    const res = await new Client().post('/api/auth/register', registration);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('REGISTRATION_CLOSED');
  });
});

describe('login and logout', () => {
  it('signs in with the right password and out again, deleting the server session', async () => {
    const { email, password, user } = await createUser();
    const client = new Client();
    const login = await client.post('/api/auth/login', { email: email.toUpperCase(), password });
    expect(login.status).toBe(200);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(1);

    const logout = await client.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect((await client.get('/api/auth/me')).status).toBe(401);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { email } = await createUser();
    const wrong = await new Client().post('/api/auth/login', { email, password: 'wrong-password1' });
    const unknown = await new Client().post('/api/auth/login', { email: 'nobody@test.mn', password: 'whatever1' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('refuses suspended accounts', async () => {
    const { email, password } = await createUser({ status: 'SUSPENDED' });
    const res = await new Client().post('/api/auth/login', { email, password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('refuses demonstration accounts when DEMO_MODE is off', async () => {
    const { email, password } = await createUser({ isDemoAccount: true, role: 'ADMIN' });
    const res = await new Client().post('/api/auth/login', { email, password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('DEMO_ACCOUNT_DISABLED');
  });

  it('ignores a forged session cookie', async () => {
    const res = await new Client().agent.get('/api/auth/me').set('Cookie', 'busify_session=forged-token-value-1234567890');
    expect(res.status).toBe(401);
  });
});

describe('forced password change', () => {
  it('blocks everything except changing the password until it is changed', async () => {
    const { email, password } = await createUser({ mustChangePassword: true });
    const client = new Client();
    expect((await client.post('/api/auth/login', { email, password })).status).toBe(200);

    const blocked = await client.get('/api/routes');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await client.get('/api/auth/me')).status).toBe(200);

    const wrongCurrent = await client.post('/api/auth/change-password', { currentPassword: 'nope', newPassword: 'brandnew123' });
    expect(wrongCurrent.status).toBe(400);

    const changed = await client.post('/api/auth/change-password', { currentPassword: password, newPassword: 'brandnew123' });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect((await client.get('/api/routes')).status).toBe(200);
  });

  it('signs out other sessions after a password change', async () => {
    const { email, password, user } = await createUser();
    const phone = new Client();
    const laptop = new Client();
    await phone.post('/api/auth/login', { email, password });
    await laptop.post('/api/auth/login', { email, password });
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(2);

    await laptop.post('/api/auth/change-password', { currentPassword: password, newPassword: 'another123' });
    expect((await phone.get('/api/auth/me')).status).toBe(401);
    expect((await laptop.get('/api/auth/me')).status).toBe(200);
  });
});

describe('request protection', () => {
  it('rejects state-changing requests without the X-Busify-Client header (CSRF defence)', async () => {
    const res = await new Client().agent.post('/api/auth/login').send({ email: 'a@b.mn', password: 'x' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CSRF_HEADER_MISSING');
  });

  it('answers malformed JSON with a 400', async () => {
    const res = await new Client().agent
      .post('/api/auth/login')
      .set('X-Busify-Client', 'test')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
  });
});
