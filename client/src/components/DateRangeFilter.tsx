import { Input } from '@/components/ui/input';
import { cn, isoDay } from '@/lib/utils';

export interface DateRange {
  from: string;
  to: string;
}

export function lastDays(days: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDay(from), to: isoDay(to) };
}

const PRESETS = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
];

/** Date range filter: presets first, then a custom from/to. Scopes everything below it. */
export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const activePreset = PRESETS.find((p) => {
    const r = lastDays(p.days);
    return r.from === value.from && r.to === value.to;
  });
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Report period">
      <div className="inline-flex rounded-lg border border-line bg-surface p-1">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            aria-pressed={activePreset?.days === p.days}
            onClick={() => onChange(lastDays(p.days))}
            className={cn(
              'h-8 rounded-md px-3 text-sm font-medium',
              activePreset?.days === p.days ? 'bg-brand-50 text-brand-800' : 'text-ink-muted hover:text-ink',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-sm text-ink-muted">
        <Input
          type="date"
          className="h-10 w-[9.5rem]"
          value={value.from}
          max={value.to}
          onChange={(e) => e.target.value && onChange({ ...value, from: e.target.value })}
          aria-label="From date"
        />
        <span aria-hidden>–</span>
        <Input
          type="date"
          className="h-10 w-[9.5rem]"
          value={value.to}
          min={value.from}
          max={isoDay(new Date())}
          onChange={(e) => e.target.value && onChange({ ...value, to: e.target.value })}
          aria-label="To date"
        />
      </div>
    </div>
  );
}
