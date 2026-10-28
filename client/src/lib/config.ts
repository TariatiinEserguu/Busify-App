/** Build-time configuration from VITE_* variables in the project .env file. */

function parseCenter(value: string | undefined): [number, number] {
  const [lat, lng] = (value ?? '').split(',').map((v) => Number(v.trim()));
  if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return [lat, lng];
  return [47.9185, 106.9177];
}

export const appConfig = {
  /** Relative by default so phones on the LAN call the computer that served the page. */
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, ''),
  tileUrl: import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution:
    import.meta.env.VITE_MAP_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  defaultCenter: parseCenter(import.meta.env.VITE_MAP_DEFAULT_CENTER),
  defaultZoom: Number(import.meta.env.VITE_MAP_DEFAULT_ZOOM) || 13,
};
