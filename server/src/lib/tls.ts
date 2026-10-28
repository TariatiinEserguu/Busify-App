import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import selfsigned from 'selfsigned';
import { env, SERVER_ROOT } from '../config/env';
import { lanIPv4Addresses } from './network';
import { logger } from './logger';

const CERT_DIR = path.join(SERVER_ROOT, 'certs');

/**
 * Returns the HTTPS key and certificate: the configured files, or a
 * self-signed certificate for localhost and this computer's LAN addresses
 * (regenerated whenever those addresses change).
 */
export function loadTlsCredentials(): { key: string; cert: string } {
  if (env.HTTPS_CERT_FILE && env.HTTPS_KEY_FILE) {
    return { cert: readFileSync(env.HTTPS_CERT_FILE, 'utf8'), key: readFileSync(env.HTTPS_KEY_FILE, 'utf8') };
  }

  const ips = ['127.0.0.1', ...lanIPv4Addresses().map((a) => a.address)].sort();
  const certFile = path.join(CERT_DIR, 'busify-selfsigned.crt');
  const keyFile = path.join(CERT_DIR, 'busify-selfsigned.key');
  const metaFile = path.join(CERT_DIR, 'busify-selfsigned.json');

  if (existsSync(certFile) && existsSync(keyFile) && existsSync(metaFile)) {
    try {
      const meta = JSON.parse(readFileSync(metaFile, 'utf8')) as { ips: string[]; expires: string };
      if (meta.ips.join(',') === ips.join(',') && new Date(meta.expires) > new Date()) {
        return { cert: readFileSync(certFile, 'utf8'), key: readFileSync(keyFile, 'utf8') };
      }
    } catch {
      // Fall through and regenerate.
    }
  }

  logger.info(`Generating a self-signed HTTPS certificate for: localhost, ${ips.join(', ')}`);
  const days = 365;
  const pems = selfsigned.generate([{ name: 'commonName', value: 'BUSIFY local server' }], {
    days,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true },
      {
        name: 'subjectAltName',
        altNames: [{ type: 2, value: 'localhost' }, ...ips.map((ip) => ({ type: 7, ip }))],
      },
    ],
  });
  mkdirSync(CERT_DIR, { recursive: true });
  writeFileSync(certFile, pems.cert);
  writeFileSync(keyFile, pems.private, { mode: 0o600 });
  writeFileSync(metaFile, JSON.stringify({ ips, expires: new Date(Date.now() + days * 86_400_000).toISOString() }));
  return { cert: pems.cert, key: pems.private };
}
