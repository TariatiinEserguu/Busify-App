import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { Crosshair, Maximize2 } from 'lucide-react';
import type { LatLng } from '@busify/shared';
import { appConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import { destinationIcon, FitBounds, FollowPoint, InvalidateOnResize, TileFailureNotice, Tiles, userIcon } from './MapBase';

export interface MapStop {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface MapUser extends LatLng {
  accuracyM: number | null;
  simulated: boolean;
}

interface BusMapProps {
  /** Stops of the selected route, in order (drawn as a line). */
  stops?: MapStop[];
  routeColor?: string;
  /** Stops not on the selected route (e.g. nearby stops), drawn in grey. */
  otherStops?: MapStop[];
  destinationId?: number | null;
  /** Destination when the route itself is not available (e.g. deleted). */
  destinationPoint?: (LatLng & { name: string }) | null;
  alertRadiusM?: number | null;
  user?: MapUser | null;
  onStopClick?: (stopId: number) => void;
  onMapClick?: (point: LatLng) => void;
  /** Changing this value re-fits the map to the route, destination and user. */
  fitKey?: string | number;
  /** Keep the user's (moving) position in view. */
  followUser?: boolean;
  className?: string;
  overlay?: ReactNode;
  ariaLabel?: string;
}

function ClickHandler({ onClick }: { onClick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onClick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export function BusMap({
  stops = [],
  routeColor = '#1d41d8',
  otherStops = [],
  destinationId,
  destinationPoint,
  alertRadiusM,
  user,
  onStopClick,
  onMapClick,
  fitKey,
  followUser,
  className,
  overlay,
  ariaLabel = 'Map of the route and stops',
}: BusMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [tilesFailed, setTilesFailed] = useState(false);

  const destination = useMemo(() => {
    const s = stops.find((x) => x.id === destinationId) ?? otherStops.find((x) => x.id === destinationId);
    if (s) return { lat: s.latitude, lng: s.longitude, name: s.name };
    return destinationPoint ?? null;
  }, [stops, otherStops, destinationId, destinationPoint]);

  const fitPoints = useMemo(() => {
    const pts: LatLng[] = stops.map((s) => ({ lat: s.latitude, lng: s.longitude }));
    if (pts.length === 0) pts.push(...otherStops.map((s) => ({ lat: s.latitude, lng: s.longitude })));
    if (destination && pts.length === 0) pts.push(destination);
    if (user) pts.push(user);
    return pts;
  }, [stops, otherStops, destination, user]);

  const line = stops.map((s) => [s.latitude, s.longitude] as [number, number]);

  return (
    <div role="region" aria-label={ariaLabel} className={cn('relative isolate overflow-hidden bg-slate-200', className)}>
      <MapContainer
        ref={mapRef}
        center={appConfig.defaultCenter}
        zoom={appConfig.defaultZoom}
        className="h-full w-full"
        zoomControl={false}
        attributionControl
      >
        <Tiles onFailure={setTilesFailed} />
        <InvalidateOnResize />
        <FitBounds points={fitPoints} fitKey={fitKey} />
        {followUser && <FollowPoint point={user ?? null} />}
        {onMapClick && <ClickHandler onClick={onMapClick} />}

        {line.length > 1 && (
          <>
            <Polyline positions={line} pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9 }} />
            <Polyline positions={line} pathOptions={{ color: routeColor, weight: 5, opacity: 0.95 }} />
          </>
        )}

        {otherStops.map((s) => (
          <CircleMarker
            key={`o-${s.id}`}
            center={[s.latitude, s.longitude]}
            radius={5}
            pathOptions={{ color: '#64748b', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
            eventHandlers={onStopClick ? { click: () => onStopClick(s.id) } : undefined}
          >
            <Tooltip className="busify-tooltip" direction="top" offset={[0, -6]}>
              {s.name}
            </Tooltip>
          </CircleMarker>
        ))}

        {stops.map((s, i) => {
          const isDestination = s.id === destinationId;
          const isTerminus = i === 0 || i === stops.length - 1;
          return (
            <CircleMarker
              key={`s-${s.id}`}
              center={[s.latitude, s.longitude]}
              radius={isTerminus ? 7 : 6}
              pathOptions={{ color: routeColor, weight: 3, fillColor: '#ffffff', fillOpacity: 1 }}
              eventHandlers={onStopClick ? { click: () => onStopClick(s.id) } : undefined}
            >
              {!isDestination && (
                <Tooltip className="busify-tooltip" direction="top" offset={[0, -6]}>
                  {i + 1}. {s.name}
                </Tooltip>
              )}
            </CircleMarker>
          );
        })}

        {destination && alertRadiusM ? (
          <Circle
            center={[destination.lat, destination.lng]}
            radius={alertRadiusM}
            pathOptions={{ color: '#d97706', weight: 2, dashArray: '6 6', fillColor: '#f59e0b', fillOpacity: 0.08 }}
          />
        ) : null}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} keyboard={false}>
            <Tooltip className="busify-tooltip" direction="top" permanent>
              {destination.name}
            </Tooltip>
          </Marker>
        )}

        {user && (
          <>
            {user.accuracyM != null && user.accuracyM > 8 && (
              <Circle
                center={[user.lat, user.lng]}
                radius={user.accuracyM}
                pathOptions={{ color: user.simulated ? '#7c3aed' : '#2553eb', weight: 1, fillOpacity: 0.08, opacity: 0.4 }}
              />
            )}
            <Marker position={[user.lat, user.lng]} icon={userIcon(user.simulated)} keyboard={false} zIndexOffset={1000}>
              <Tooltip className="busify-tooltip" direction="right" offset={[10, 0]}>
                {user.simulated ? 'Simulated position' : 'You are here'}
              </Tooltip>
            </Marker>
          </>
        )}
      </MapContainer>

      <TileFailureNotice show={tilesFailed} />

      <div className="absolute right-3 top-3 z-[400] flex flex-col gap-1.5">
        <MapButton
          label="Zoom in"
          onClick={() => mapRef.current?.zoomIn()}
        >
          <span className="text-lg leading-none">+</span>
        </MapButton>
        <MapButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <span className="text-lg leading-none">−</span>
        </MapButton>
        {fitPoints.length > 0 && (
          <MapButton
            label="Show the whole route"
            onClick={() => {
              const map = mapRef.current;
              if (!map) return;
              if (fitPoints.length === 1) map.setView([fitPoints[0].lat, fitPoints[0].lng], 15);
              else map.fitBounds(fitPoints.map((p) => [p.lat, p.lng] as [number, number]), { padding: [40, 40], maxZoom: 16 });
            }}
          >
            <Maximize2 className="size-4" />
          </MapButton>
        )}
        {user && (
          <MapButton label="Centre on my position" onClick={() => mapRef.current?.setView([user.lat, user.lng], 16)}>
            <Crosshair className="size-4" />
          </MapButton>
        )}
      </div>
      {overlay}
    </div>
  );
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface text-ink shadow-sm hover:bg-canvas"
    >
      {children}
    </button>
  );
}
