#!/usr/bin/env node
/**
 * One-time (and repeatable) local setup for BUSIFY. Works on Windows, macOS and Linux.
 *
 *   npm run setup            create .env if needed, migrate the database, seed it (+ demo data when DEMO_MODE=true)
 *   npm run setup -- --no-demo   skip the demonstration data
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const isWindows = process.platform === 'win32';

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function step(title) {
  console.log(`\n${bold('▸ ' + title)}`);
}

function fail(message) {
  console.error(`\n${red('✖ ' + message)}\n`);
  process.exit(1);
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { cwd: root, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) fail(`Command failed: ${command} ${commandArgs.join(' ')}`);
}

// 1. Node version -------------------------------------------------------------
step('Checking Node.js');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 20 || (major === 20 && minor < 19)) {
  fail(`Node.js ${process.versions.node} is too old. Install Node.js 22 LTS from https://nodejs.org and try again.`);
}
console.log(green(`✔ Node.js ${process.versions.node}`));

if (!existsSync(path.join(root, 'node_modules'))) {
  fail('Dependencies are not installed. Run `npm install` first.');
}

// 2. .env ----------------------------------------------------------------------
step('Preparing configuration (.env)');
const envFile = path.join(root, '.env');
if (!existsSync(envFile)) {
  copyFileSync(path.join(root, '.env.example'), envFile);
  console.log(green('✔ Created .env from .env.example — review it any time.'));
} else {
  console.log(green('✔ .env already exists (left unchanged)'));
}
const envText = readFileSync(envFile, 'utf8');
const demoMode = /^\s*DEMO_MODE\s*=\s*"?(true|1|yes|on)"?\s*$/im.test(envText);

// 3. Database ------------------------------------------------------------------
step('Creating / migrating the SQLite database');
mkdirSync(path.join(root, 'server', 'data'), { recursive: true });
run('npm', ['run', 'db:generate', '-w', 'server']);
run('npm', ['run', 'db:migrate', '-w', 'server']);

step('Adding required data (roles, permissions, settings)');
run('npm', ['run', 'db:seed', '-w', 'server']);

if (args.has('--no-demo')) {
  console.log(yellow('• Skipped demo data (--no-demo). Create an administrator with `npm run create-admin`.'));
} else if (demoMode) {
  step('Adding demonstration data (DEMO_MODE=true)');
  run('npm', ['run', 'db:seed:demo', '-w', 'server']);
} else {
  console.log(yellow('• DEMO_MODE is not true, so no demo data was added. Create an administrator with `npm run create-admin`.'));
}

console.log(`
${green(bold('✔ BUSIFY is ready.'))}

  Start the app (development):   ${bold('npm run dev')}      then open http://localhost:5173
  Serve on your Wi-Fi (LAN):     ${bold('npm run lan')}      see README → "Use BUSIFY from your phone"
  Run the tests:                 ${bold('npm test')}
`);
