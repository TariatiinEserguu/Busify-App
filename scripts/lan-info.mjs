#!/usr/bin/env node
/** Prints this computer's LAN addresses and how to reach BUSIFY from a phone. */
import { readFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envText = existsSync(path.join(root, '.env')) ? readFileSync(path.join(root, '.env'), 'utf8') : '';
const read = (key, fallback) => envText.match(new RegExp(`^\\s*${key}\\s*=\\s*"?([^"\\r\\n#]*)`, 'm'))?.[1]?.trim() || fallback;
const port = read('PORT', '4000');
const devPort = read('CLIENT_DEV_PORT', '5173');

const addresses = [];
for (const [name, infos] of Object.entries(os.networkInterfaces())) {
  for (const info of infos ?? []) if (info.family === 'IPv4' && !info.internal) addresses.push({ name, address: info.address });
}

console.log('\nBUSIFY on your local network\n');
if (addresses.length === 0) {
  console.log('  No network connection found. Connect this computer to Wi-Fi or Ethernet first.\n');
} else {
  for (const { name, address } of addresses) {
    console.log(`  ${name.padEnd(28)} ${address}`);
    console.log(`      npm run lan          →  http://${address}:${port}`);
    console.log(`      npm run lan -- --https →  https://${address}:${port}   (GPS works on phones)`);
    console.log(`      npm run dev (CLIENT_DEV_HOST=0.0.0.0) →  http://${address}:${devPort}\n`);
  }
}
console.log(`Tips
  • The phone must be on the same Wi-Fi network as this computer.
  • On a phone "localhost" means the phone itself — always use the address above.
  • Windows asks "Allow Node.js to communicate on private networks?" the first time: choose Allow
    (Private networks only). If you missed it, see README → "Windows Firewall".
  • Phones only allow GPS on https:// pages. Use \`npm run lan -- --https\` and accept the
    certificate warning once, or use the built-in simulator to test alerts over plain http.
  • Never forward this port on your router: BUSIFY is meant for your local network only.
`);
