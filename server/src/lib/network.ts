import os from 'node:os';

/** IPv4 addresses of this computer's LAN interfaces (Wi-Fi, Ethernet). */
export function lanIPv4Addresses(): Array<{ name: string; address: string }> {
  const result: Array<{ name: string; address: string }> = [];
  for (const [name, infos] of Object.entries(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      if (info.family === 'IPv4' && !info.internal) result.push({ name, address: info.address });
    }
  }
  return result;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

const PRIVATE_V4: Array<[string, number]> = [
  ['127.0.0.0', 8], // loopback
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16], // includes Windows Mobile Hotspot (192.168.137.x)
  ['169.254.0.0', 16], // link-local
  ['100.64.0.0', 10], // carrier-grade NAT / phone hotspots / VPN overlays
];

/** True for loopback and private-network addresses (IPv4 and IPv6). */
export function isPrivateAddress(raw: string | undefined | null): boolean {
  if (!raw) return false;
  let ip = raw.trim().toLowerCase();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
  if (ip === '::1') return true;
  if (ip.includes(':')) {
    return ip.startsWith('fc') || ip.startsWith('fd') || /^fe[89ab]/.test(ip);
  }
  const value = ipv4ToInt(ip);
  if (value == null) return false;
  return PRIVATE_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (value & mask) >>> 0 === (ipv4ToInt(base)! & mask) >>> 0;
  });
}
