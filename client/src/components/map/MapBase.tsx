import { useEffect, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { WifiOff } from 'lucide-react';
import type { LatLng } from '@busify/shared';
import { appConfig } from '@/lib/config';
import { reportClientError } from '@/lib/reportError';
import { cn } from '@/lib/utils';

/**
 * OpenStreetMap tiles with failure detection. Tiles need internet access;
 * when they cannot load, `onFailure` lets the page show a fallback message.
 */
export function Tiles({ onFailure }: { onFailure: (failed: boolean) => void }) {
  const counts = useRef({ ok: 0, failed: 0 });
  return (
    <TileLayer
      url={appConfig.tileUrl}
      attribution={appConfig.tileAttribution}
      maxZoom={19}
      eventHandlers={{
        tileload: () => {
          counts.current.ok += 1;
          onFailure(false);
        },
        tileerror: () => {
          counts.current.failed += 1;
          if (counts.current.failed >= 4 && counts.current.ok === 0) {
            onFailure(true);
            reportClientError('Map tiles failed to load', { tileUrl: appConfig.tileUrl, online: navigator.onLine });
          }
        },
      }}
    />
  );
}

export function TileFailureNotice({ show, className }: { show: boolean; className?: string }) {
  if (!show) return null;
  return (
    <div className={cn('pointer-events-none absolute left-3 right-15 top-3 z-[500] flex justify-center', className)}>
      <div className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/95 px-3 py-2 text-xs text-amber-950 shadow">
        <WifiOff className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
        <p>
          <span className="font-semibold">Map background unavailable.</span> OpenStreetMap tiles need an internet connection.
          Stops, distances and alerts still work — use the stop list instead.
        </p>
      </div>
    </div>
  );
}

/** Fits the view to the given points whenever `fitKey` changes. */
export function FitBounds({ points, fitKey, maxZoom = 16 }: { points: LatLng[]; fitKey: string | number | undefined; maxZoom?: number }) {
  const map = useMap();
  const latest = useRef(points);
  latest.current = points;
  useEffect(() => {
    const pts = latest.current;
    if (pts.length === 0) return;
    // Not animated: a second fit arriving mid-animation would otherwise be dropped.
    map.invalidateSize(false);
    if (pts.length === 1) {
      map.setView([pts[0].lat, pts[0].lng], Math.max(map.getZoom(), 15), { animate: false });
      return;
    }
    map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [48, 48], maxZoom, animate: false });
  }, [fitKey, map, maxZoom]);
  return null;
}

/** Pans just enough to keep a moving position on screen. */
export function FollowPoint({ point }: { point: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.panInside([point.lat, point.lng], { padding: [70, 70] });
  }, [point?.lat, point?.lng, map]);
  return null;
}

/** Keeps Leaflet's size in sync when the container is resized (e.g. panels opening). */
export function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

export const userIcon = (simulated: boolean) =>
  L.divIcon({
    className: '',
    html: `<div class="busify-user-dot${simulated ? ' is-simulated' : ''}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

export const destinationIcon = L.divIcon({
  className: 'busify-destination-pin',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 1C8.2 1 1 8 1 16.7 1 28.4 17 43 17 43s16-14.6 16-26.3C33 8 25.8 1 17 1Z" fill="#f59e0b" stroke="#fff" stroke-width="2"/>
    <circle cx="17" cy="16.5" r="6.5" fill="#fff"/>
  </svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
  tooltipAnchor: [0, -38],
});

export const pickerIcon = L.divIcon({
  className: 'busify-destination-pin',
  html: `<svg width="30" height="40" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 1C8.2 1 1 8 1 16.7 1 28.4 17 43 17 43s16-14.6 16-26.3C33 8 25.8 1 17 1Z" fill="#1d41d8" stroke="#fff" stroke-width="2"/>
    <circle cx="17" cy="16.5" r="6" fill="#fff"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});
