/**
 * Small, dependency-free charts for the admin and support reports.
 * Single-series by design (small multiples instead of multi-colour charts):
 * thin columns with a rounded data-end, hairline grid, per-mark tooltips on
 * hover and keyboard focus, and a table view so nothing depends on hovering.
 */
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

/** Categorical slot 1 of the reference data-viz palette. */
const SERIES = '#2a78d6';
const SERIES_HOVER = '#1f63b8';

function niceMax(value: number) {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * pow) return step * pow;
  }
  return 10 * pow;
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export interface ColumnDatum {
  key: string;
  /** Short axis label, e.g. "Oct 28". */
  label: string;
  value: number;
}

interface ColumnChartProps {
  title: string;
  data: ColumnDatum[];
  /** Name of the measure used in tooltips and the table, e.g. "Journeys". */
  measure: string;
  height?: number;
  className?: string;
  dim?: boolean;
}

export function ColumnChart({ title, data, measure, height = 150, className, dim }: ColumnChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(data.length / 7));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <figure className={cn('min-w-0', dim && 'opacity-60 transition-opacity', className)}>
      <figcaption className="mb-3 flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span className="text-xs text-ink-subtle">Total {total.toLocaleString()}</span>
      </figcaption>
      <div className="flex gap-2">
        <div className="relative w-7 shrink-0 text-right text-[11px] text-ink-subtle tabular" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - t / max) * 100}%` }}>
              {compact.format(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="relative" style={{ height }}>
            {ticks.map((t) => (
              <div key={t} className="absolute inset-x-0 h-px bg-line" style={{ top: `${(1 - t / max) * 100}%` }} aria-hidden />
            ))}
            <div className="absolute inset-0 flex items-end gap-[2px]" role="list" aria-label={`${title}, ${data.length} values`}>
              {data.map((d, i) => (
                <div
                  key={d.key}
                  role="listitem"
                  tabIndex={0}
                  aria-label={`${d.label}: ${d.value} ${measure.toLowerCase()}`}
                  className="group relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <div
                    className="w-full max-w-6 rounded-t-[4px] transition-colors group-focus-visible:outline-2 group-focus-visible:outline-offset-1 group-focus-visible:outline-brand-600"
                    style={{
                      height: d.value === 0 ? 0 : `max(2px, ${(d.value / max) * 100}%)`,
                      backgroundColor: active === i ? SERIES_HOVER : SERIES,
                    }}
                  />
                  {active === i && (
                    <div className="pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-lg">
                      <span className="block font-semibold text-ink tabular">{d.value.toLocaleString()}</span>
                      <span className="block text-ink-subtle">
                        {measure} · {d.label}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-1.5 flex gap-[2px] text-[11px] text-ink-subtle" aria-hidden>
            {data.map((d, i) => (
              <span key={d.key} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center">
                {i % labelEvery === 0 ? d.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="mt-2 text-xs font-medium text-brand-700 hover:underline"
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((s) => !s)}
      >
        {showTable ? 'Hide table' : 'Show as table'}
      </button>
      {showTable && (
        <div id={tableId} className="mt-2 max-h-48 overflow-y-auto rounded-md border border-line">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-canvas">
              <tr>
                <th className="px-3 py-1.5 text-left font-medium text-ink-subtle">Day</th>
                <th className="px-3 py-1.5 text-right font-medium text-ink-subtle">{measure}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.key} className="border-t border-line">
                  <td className="px-3 py-1">{d.label}</td>
                  <td className="px-3 py-1 text-right tabular">{d.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}

export interface BarItem {
  name: string;
  value: number;
}

/** Horizontal bars with the label above and the value at the bar's tip. */
export function BarList({ items, measure, empty = 'No data for this period.' }: { items: BarItem[]; measure: string; empty?: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (items.length === 0 || items.every((i) => i.value === 0)) {
    return <p className="py-6 text-center text-sm text-ink-muted">{empty}</p>;
  }
  const max = Math.max(...items.map((i) => i.value));
  return (
    <ul className="space-y-3" aria-label={measure}>
      {items.map((item, i) => (
        <li
          key={item.name}
          tabIndex={0}
          aria-label={`${item.name}: ${item.value} ${measure.toLowerCase()}`}
          className="rounded outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          onPointerEnter={() => setActive(i)}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(i)}
          onBlur={() => setActive(null)}
        >
          <div className="mb-1 truncate text-sm text-ink">{item.name}</div>
          <div className="flex items-center gap-2">
            <div className="h-3 min-w-0 flex-1">
              <div
                className="h-full rounded-r-[4px] transition-colors"
                style={{ width: `${max ? Math.max(1, (item.value / max) * 100) : 0}%`, backgroundColor: active === i ? SERIES_HOVER : SERIES }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm font-medium text-ink tabular">{item.value.toLocaleString()}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
