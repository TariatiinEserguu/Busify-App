#!/usr/bin/env node
/**
 * Serves BUSIFY to other devices on your Wi-Fi from a single port.
 *
 *   npm run lan                 build, then listen on all interfaces (HTTP)
 *   npm run lan -- --https      same, with a self-signed HTTPS certificate (needed for GPS on phones)
 *   npm run lan -- --no-build   skip the build step
 *
 * Your .env file is not modified; HOST (and HTTPS_ENABLED) are overridden for this run only.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const isWindows = process.platform === 'win32';

if (!existsSync(path.join(root, '.env'))) {
  console.error('\n✖ No .env file found. Run `npm run setup` first.\n');
  process.exit(1);
}

if (!args.has('--no-build')) {
  console.log('▸ Building the web app and server…');
  const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: isWindows });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const env = { ...process.env, HOST: process.env.LAN_HOST || '0.0.0.0' };
if (args.has('--https')) env.HTTPS_ENABLED = 'true';

console.log(`▸ Starting BUSIFY for your local network${args.has('--https') ? ' (HTTPS)' : ''}. Press Ctrl+C to stop.\n`);
const server = spawn(process.execPath, [path.join(root, 'server', 'dist', 'index.js')], {
  cwd: path.join(root, 'server'),
  stdio: 'inherit',
  env,
});
const stop = () => server.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
