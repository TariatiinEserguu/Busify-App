import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, Tooltip, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { Crosshair, Maximize2 } from 'lucide-react';
import type { LatLng } from '@busify/shared';
import { appConfig } from '@/lib/config';
import { useI18n } from '@/lib/i18n';
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
  /** Draw the user as the bus tile (during a journey). */
  userAsBus?: boolean;
  /** Hide the zoom/fit buttons (small preview maps). */
  hideControls?: boolean;
  /** Non-interactive preview (no drag/zoom). */
  static?: boolean;
  /** Where the zoom buttons sit. */
  controlsClassName?: string;
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
  userAsBus,
  hideControls,
  static: isStatic,
  controlsClassName,
  className,
  overlay,
  ariaLabel,
}: BusMapProps) {
  const { t } = useI18n();
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
    <div role="region" aria-label={ariaLabel ?? t('Map of the route and stops')} className={cn('busify-map relative isolate overflow-hidden bg-[#eef0ea]', className)}>
      <MapContainer
        ref={mapRef}
        center={appConfig.defaultCenter}
        zoom={appConfig.defaultZoom}
        className="h-full w-full"
        zoomControl={false}
        attributionControl
        dragging={!isStatic}
        scrollWheelZoom={!isStatic}
        doubleClickZoom={!isStatic}
        touchZoom={!isStatic}
        keyboard={!isStatic}
        zoomSnap={0.25}
      >
        <Tiles onFailure={setTilesFailed} />
        <InvalidateOnResize />
        <FitBounds points={fitPoints} fitKey={fitKey} />
        {followUser && <FollowPoint point={user ?? null} />}
        {onMapClick && <ClickHandler onClick={onMapClick} />}

        {line.length > 1 && (
          <>
            <Polyline key={`c-${line.length}-${routeColor}`} positions={line} pathOptions={{ color: '#ffffff', weight: 11, opacity: 1, lineJoin: 'round', className: 'busify-route-casing' }} />
            <Polyline key={`l-${line.length}-${routeColor}`} positions={line} pathOptions={{ color: routeColor, weight: 6, opacity: 1, lineJoin: 'round', className: 'busify-route-line' }} />
          </>
        )}

        {otherStops.map((s) => (
          <CircleMarker
            key={`o-${s.id}`}
            center={[s.latitude, s.longitude]}
            radius={6}
            pathOptions={{ color: '#7a8090', weight: 2.5, fillColor: '#ffffff', fillOpacity: 1 }}
            eventHandlers={onStopClick ? { click: () => onStopClick(s.id) } : undefined}
          >
            <Tooltip className="busify-tooltip-light" direction="top" offset={[0, -8]}>
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
              radius={isTerminus ? 7 : 5}
              pathOptions={{ color: routeColor, weight: isTerminus ? 4 : 3, fillColor: '#ffffff', fillOpacity: 1 }}
              eventHandlers={onStopClick ? { click: () => onStopClick(s.id) } : undefined}
            >
              {!isDestination && (
                <Tooltip className="busify-tooltip-light" direction="top" offset={[0, -8]}>
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
            pathOptions={{ color: '#e0a100', weight: 2.5, dashArray: '7 7', fillColor: '#ffc233', fillOpacity: 0.2, className: 'busify-alert-zone' }}
          />
        ) : null}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} keyboard={false}>
            <Tooltip className="busify-tooltip" direction="top" permanent>
              {destination.name}
              {alertRadiusM ? ` · ${t('{n} m zone', { n: alertRadiusM })}` : ''}
            </Tooltip>
          </Marker>
        )}

        {user && (
          <>
            {user.accuracyM != null && user.accuracyM > 8 && (
              <Circle
                center={[user.lat, user.lng]}
                radius={user.accuracyM}
                pathOptions={{ color: user.simulated ? '#6d28d9' : '#10162c', weight: 1, fillOpacity: 0.06, opacity: 0.3 }}
              />
            )}
            <Marker position={[user.lat, user.lng]} icon={userIcon(user.simulated, userAsBus)} keyboard={false} zIndexOffset={1000}>
              <Tooltip className="busify-tooltip-light" direction="right" offset={[14, 0]}>
                {user.simulated ? t('Simulated position') : t('You are here')}
              </Tooltip>
            </Marker>
          </>
        )}
      </MapContainer>

      <TileFailureNotice show={tilesFailed} />

      {!hideControls && <div className={cn('absolute right-3 top-3 z-[400] flex flex-col gap-1.5', controlsClassName)}>
        <MapButton label={t('Zoom in')} onClick={() => mapRef.current?.zoomIn()}>
          <span className="text-lg leading-none">+</span>
        </MapButton>
        <MapButton label={t('Zoom out')} onClick={() => mapRef.current?.zoomOut()}>
          <span className="text-lg leading-none">−</span>
        </MapButton>
        {fitPoints.length > 0 && (
          <MapButton
            label={t('Show the whole route')}
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
          <MapButton label={t('Centre on my position')} onClick={() => mapRef.current?.flyTo([user.lat, user.lng], 16, { duration: 0.6 })}>
            <Crosshair className="size-4" />
          </MapButton>
        )}
      </div>}
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
      className="press flex size-10 items-center justify-center rounded-xl bg-surface/95 text-ink shadow-float backdrop-blur transition-colors hover:bg-surface"
    >
      {children}
    </button>
  );
}
