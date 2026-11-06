import { Slider } from '@/components/ui/controls';
import { useI18n } from '@/lib/i18n';
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
  const { t, meters } = useI18n();
  const presets = PRESETS.filter((p) => p >= min && p <= max);
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink" id="radius-label">
          {t('Alert me within')}
        </span>
        <span className="tabular text-sm font-semibold text-ink">{meters(value)}</span>
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
        aria-label={t('Alert distance in metres')}
      />
      <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={t('Common alert distances')}>
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            disabled={disabled}
            onClick={() => onChange(p)}
            className={cn(
              'press rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors',
              p === value ? 'border-brand-900 bg-brand-900 text-white' : 'border-line text-ink-muted hover:border-line-strong hover:text-ink',
            )}
          >
            {meters(p)}
          </button>
        ))}
      </div>
    </div>
  );
}
