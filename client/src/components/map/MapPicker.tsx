import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { LeafletEventHandlerFnMap, Marker as LeafletMarker } from 'leaflet';
import type { LatLng } from '@busify/shared';
import { appConfig } from '@/lib/config';
import { cn } from '@/lib/utils';
import { InvalidateOnResize, pickerIcon, TileFailureNotice, Tiles } from './MapBase';

interface MapPickerProps {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  /** Other stops for reference (not clickable). */
  context?: Array<{ id: number; name: string; latitude: number; longitude: number }>;
  className?: string;
}

function ClickToPick({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function CenterOn({ point }: { point: LatLng | null }) {
  const map = useMap();
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (point && !done) {
      map.setView([point.lat, point.lng], Math.max(map.getZoom(), 16));
      setDone(true);
    }
  }, [point, done, map]);
  return null;
}

/** Click the map (or drag the pin) to choose coordinates. */
export function MapPicker({ value, onChange, context = [], className }: MapPickerProps) {
  const [tilesFailed, setTilesFailed] = useState(false);
  const handlers = useMemo<LeafletEventHandlerFnMap>(
    () => ({
      dragend: (e) => {
        const ll = (e.target as LeafletMarker).getLatLng();
        onChange({ lat: ll.lat, lng: ll.lng });
      },
    }),
    [onChange],
  );
  return (
    <div role="region" aria-label="Pick the stop location" className={cn('relative isolate overflow-hidden rounded-lg border border-line', className)}>
      <MapContainer center={value ? [value.lat, value.lng] : appConfig.defaultCenter} zoom={value ? 16 : appConfig.defaultZoom} className="h-full w-full">
        <Tiles onFailure={setTilesFailed} />
        <InvalidateOnResize />
        <ClickToPick onPick={onChange} />
        <CenterOn point={value} />
        {context.map((s) => (
          <CircleMarker key={s.id} center={[s.latitude, s.longitude]} radius={4} pathOptions={{ color: '#64748b', weight: 2, fillColor: '#fff', fillOpacity: 1 }}>
            <Tooltip className="busify-tooltip">{s.name}</Tooltip>
          </CircleMarker>
        ))}
        {value && <Marker position={[value.lat, value.lng]} icon={pickerIcon} draggable eventHandlers={handlers} />}
      </MapContainer>
      <TileFailureNotice show={tilesFailed} className="left-14 right-3" />
      <p className="pointer-events-none absolute bottom-2 left-2 z-[400] rounded bg-surface/90 px-2 py-1 text-[11px] text-ink-muted shadow-sm">
        Click the map or drag the pin
      </p>
    </div>
  );
}
