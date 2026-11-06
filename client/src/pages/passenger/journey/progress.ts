import { haversineDistanceM, type LatLng } from '@busify/shared';
import type { RouteStopItem } from '@/lib/types';

/**
 * Where the passenger is along the route: the nearest stop, how many stops
 * remain before the destination and a 0–1 progress value for the bar.
 */
export function journeyProgress(stops: RouteStopItem[], destinationId: number | null, position: LatLng | null, distanceM: number | null) {
  const destIndex = stops.findIndex((s) => s.id === destinationId);
  if (destIndex < 0) return { destIndex, nearIndex: -1, stopsLeft: null as number | null, progress: 0, upcoming: [] as RouteStopItem[] };
  let nearIndex = -1;
  if (position) {
    let best = Infinity;
    stops.forEach((s, i) => {
      if (i > destIndex) return;
      const d = haversineDistanceM(position, { lat: s.latitude, lng: s.longitude });
      if (d < best) {
        best = d;
        nearIndex = i;
      }
    });
  }
  // Cumulative distance along the line of stops.
  let total = 0;
  for (let i = 1; i <= destIndex; i++) {
    total += haversineDistanceM({ lat: stops[i - 1].latitude, lng: stops[i - 1].longitude }, { lat: stops[i].latitude, lng: stops[i].longitude });
  }
  const progress = distanceM != null && total > 0 ? Math.min(1, Math.max(0.03, 1 - distanceM / total)) : nearIndex >= 0 && destIndex > 0 ? nearIndex / destIndex : 0.03;
  const stopsLeft = nearIndex >= 0 ? Math.max(0, destIndex - nearIndex) : null;
  const start = Math.max(0, destIndex - 3);
  return { destIndex, nearIndex, stopsLeft, progress, upcoming: stops.slice(start, destIndex + 1) };
}
