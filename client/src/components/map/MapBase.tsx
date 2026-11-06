import { useEffect, useRef } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { WifiOff } from 'lucide-react';
import type { LatLng } from '@busify/shared';
import { appConfig } from '@/lib/config';
import { reportClientError } from '@/lib/reportError';
import { t } from '@/lib/i18n';
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
      subdomains="abcd"
      detectRetina={false}
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
      <div className="pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl bg-surface/95 px-3 py-2 text-xs text-ink shadow-float animate-slide-up">
        <WifiOff className="mt-0.5 size-4 shrink-0 text-accent-700" aria-hidden />
        <p>
          <span className="font-semibold">{t('Map background unavailable.')}</span>{' '}
          {t('Map tiles need an internet connection. Stops, distances and alerts still work.')}
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
    map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng] as [number, number])), { padding: [56, 56], maxZoom, animate: false });
  }, [fitKey, map, maxZoom]);
  return null;
}

/** Pans just enough to keep a moving position on screen. */
export function FollowPoint({ point }: { point: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.panInside([point.lat, point.lng], { padding: [90, 90], animate: true, duration: 0.6 });
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

const BUS_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffc233" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>`;

/** The passenger's position: a plain pulsing dot while planning, the bus tile during a journey. */
export const userIcon = (simulated: boolean, bus = false) =>
  bus
    ? L.divIcon({
        className: '',
        html: `<div class="busify-bus${simulated ? ' is-simulated' : ''}"><div class="tile">${BUS_SVG}</div></div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      })
    : L.divIcon({
        className: '',
        html: `<div class="busify-user-dot"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });

/** Destination stop: amber disc with a check mark. */
export const destinationIcon = L.divIcon({
  className: '',
  html: `<div class="busify-destination"><div class="disc"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10162c" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></div></div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  tooltipAnchor: [0, -20],
});

export const pickerIcon = L.divIcon({
  className: 'busify-picker-pin',
  html: `<svg width="30" height="40" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 1C8.2 1 1 8 1 16.7 1 28.4 17 43 17 43s16-14.6 16-26.3C33 8 25.8 1 17 1Z" fill="#ffc233" stroke="#10162c" stroke-width="2.5"/>
    <circle cx="17" cy="16.5" r="6" fill="#10162c"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});
