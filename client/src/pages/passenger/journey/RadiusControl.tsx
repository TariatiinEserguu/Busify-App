import { Slider } from '@/components/ui/controls';
import { cn } from '@/lib/utils';

const PRESETS = [100, 200, 300, 500, 800];

/** Alert distance picker: slider plus common presets. */
export function RadiusControl({
  value,
  onChange,
  min,
  max,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
}) {
  const presets = PRESETS.filter((p) => p >= min && p <= max);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink" id="radius-label">
          Alert me within
        </span>
        <span className="tabular text-sm font-semibold text-ink">{value} m</span>
      </div>
      <Slider
        className="mt-2"
        min={min}
        max={max}
        step={min < 50 ? 10 : 50}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        disabled={disabled}
        aria-labelledby="radius-label"
        aria-label="Alert distance in metres"
      />
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Common alert distances">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p)}
            className={cn(
              'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
              p === value ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {p} m
          </button>
        ))}
      </div>
    </div>
  );
}
