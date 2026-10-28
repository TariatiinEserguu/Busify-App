import { MapPin, Navigation } from 'lucide-react';
import { formatDistance } from '@busify/shared';
import type { RouteStopItem } from '@/lib/types';
import { cn } from '@/lib/utils';

interface StopLineProps {
  stops: RouteStopItem[];
  color: string;
  destinationId?: number | null;
  nearStopId?: number | null;
  onSelect?: (stop: RouteStopItem) => void;
  distances?: Map<number, number>;
}

/**
 * Stops drawn as a transit line diagram, in route order. Each stop is a
 * button when `onSelect` is given, so a destination can be chosen from the
 * list as well as from the map (keyboard and screen-reader friendly).
 */
export function StopLine({ stops, color, destinationId, nearStopId, onSelect, distances }: StopLineProps) {
  return (
    <ol className="relative" aria-label="Stops in route order">
      {stops.map((stop, i) => {
        const isDestination = stop.id === destinationId;
        const isLast = i === stops.length - 1;
        const content = (
          <>
            <span className="relative flex w-6 shrink-0 justify-center self-stretch" aria-hidden>
              {!isLast && <span className="absolute left-1/2 top-3 h-full w-[3px] -translate-x-1/2" style={{ backgroundColor: color }} />}
              {i > 0 && <span className="absolute left-1/2 top-0 h-3 w-[3px] -translate-x-1/2" style={{ backgroundColor: color }} />}
              {isDestination ? (
                <span className="relative z-10 mt-0.5 flex size-5 items-center justify-center rounded-full bg-amber-400 ring-4 ring-amber-100">
                  <MapPin className="size-3 text-amber-950" />
                </span>
              ) : (
                <span
                  className="relative z-10 mt-1 size-3.5 rounded-full border-[3px] bg-white"
                  style={{ borderColor: color }}
                />
              )}
            </span>
            <span className="min-w-0 flex-1 pb-3.5">
              <span className={cn('block truncate text-sm', isDestination ? 'font-semibold text-ink' : 'text-ink')}>{stop.name}</span>
              <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
                <span>Stop {i + 1}</span>
                {stop.code && <span className="font-mono">{stop.code}</span>}
                {distances?.get(stop.id) != null && <span>{formatDistance(distances.get(stop.id))} away</span>}
                {nearStopId === stop.id && (
                  <span className="inline-flex items-center gap-1 font-medium text-brand-700">
                    <Navigation className="size-3" /> You are near here
                  </span>
                )}
                {isDestination && <span className="font-medium text-amber-700">Your stop</span>}
              </span>
            </span>
          </>
        );
        return (
          <li key={stop.id}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(stop)}
                aria-pressed={isDestination}
                className={cn(
                  '-mx-2 flex w-[calc(100%+1rem)] gap-3 rounded-lg px-2 pt-1 text-left transition-colors hover:bg-slate-50',
                  isDestination && 'bg-amber-50/70 hover:bg-amber-50',
                )}
              >
                {content}
              </button>
            ) : (
              <div className="flex gap-3 pt-1">{content}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
