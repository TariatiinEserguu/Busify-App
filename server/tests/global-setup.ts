import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** A dedicated SQLite file so tests never touch the real database. */
export const TEST_DATABASE_URL = 'file:../data/test.db';

export default function setup() {
  const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  for (const file of ['test.db', 'test.db-journal']) {
    rmSync(path.join(serverRoot, 'data', file), { force: true });
  }
  execSync('npx prisma migrate deploy', {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
