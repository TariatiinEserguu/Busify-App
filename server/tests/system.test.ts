import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { Client, resetDatabase, signedIn } from './helpers';

beforeEach(resetDatabase);

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Starts the real server entry point with a controlled environment and returns its output. */
function startServer(extraEnv: Record<string, string | undefined>) {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    BUSIFY_ENV_FILE: 'none',
    NODE_ENV: 'test',
    LOG_LEVEL_TEST: '1',
    PORT: '0',
  };
  for (const [k, v] of Object.entries(extraEnv)) if (v !== undefined) env[k] = v;
  const tsx = path.join(serverRoot, '..', 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
  const result = spawnSync(tsx, ['src/index.ts'], { cwd: serverRoot, env, encoding: 'utf8', timeout: 30_000, shell: process.platform === 'win32' });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

describe('health and errors', () => {
  it('GET /api/health reports the database status', async () => {
    const res = await new Client().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'ok' });
  });

  it('unknown API paths return a JSON 404', async () => {
    const res = await new Client().get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('records client-side errors for the admin error report', async () => {
    const { client } = await signedIn('PASSENGER');
    expect((await client.post('/api/client-errors', { message: 'Map tiles failed to load', context: { tiles: 12 } })).status).toBe(202);
    const { client: admin } = await signedIn('ADMIN');
    const res = await admin.get('/api/admin/errors?source=CLIENT');
    expect(res.body.errors[0]).toMatchObject({ source: 'CLIENT', message: 'Map tiles failed to load' });
  });

  it('validates system settings and exposes the public part', async () => {
    const { client: admin } = await signedIn('ADMIN');
    const settings = (await admin.get('/api/admin/settings')).body.settings;
    expect(settings.defaultAlertRadiusM).toBe(200);
    const bad = await admin.put('/api/admin/settings', { ...settings, minAlertRadiusM: 900, maxAlertRadiusM: 100 });
    expect(bad.status).toBe(400);
    const ok = await admin.put('/api/admin/settings', { ...settings, defaultAlertRadiusM: 300, announcement: 'Demo week!' });
    expect(ok.status).toBe(200);
    const config = await new Client().get('/api/config');
    expect(config.body).toMatchObject({ announcement: 'Demo week!', alert: { defaultRadiusM: 300 } });
  });
});

describe('startup checks', () => {
  it('exits with a clear message when DATABASE_URL is missing', () => {
    const { code, output } = startServer({});
    expect(code).toBe(1);
    expect(output).toMatch(/DATABASE_URL is missing/);
    expect(output).toMatch(/npm run setup/);
  });

  it('exits with a clear message for an invalid setting', () => {
    const { code, output } = startServer({ DATABASE_URL: 'file:../data/test.db', PORT: 'not-a-port' });
    expect(code).toBe(1);
    expect(output).toMatch(/PORT/);
  });

  it('explains how to fix a database that has not been migrated', () => {
    const empty = path.join(serverRoot, 'data', 'empty-test.db');
    rmSync(empty, { force: true });
    const { code, output } = startServer({ DATABASE_URL: 'file:../data/empty-test.db' });
    rmSync(empty, { force: true });
    expect(code).toBe(1);
    expect(output).toMatch(/no BUSIFY tables|npm run setup/);
  });
});
