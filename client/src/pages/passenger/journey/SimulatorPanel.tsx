import { FastForward, MousePointerClick, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/controls';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/input';
import type { SimulationControls } from '@/features/journey/JourneyProvider';
import { SIM_SPEEDS } from '@/features/journey/simulator';
import type { RouteStopItem } from '@/lib/types';
import { formatDistance, useI18n } from '@/lib/i18n';

interface SimulatorPanelProps {
  simulation: SimulationControls;
  stops: RouteStopItem[];
  destinationIndex: number;
  disabled: boolean;
}

/** Controls for testing the alert without moving: a virtual bus drives along the route. */
export function SimulatorPanel({ simulation: sim, stops, destinationIndex, disabled }: SimulatorPanelProps) {
  const { t } = useI18n();
  const startOptions = destinationIndex > 0 ? stops.slice(0, destinationIndex) : [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        {t('A virtual bus drives towards your stop in straight lines between stops. Its positions go through exactly the same alert logic as real GPS.')}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('Start from')}>
          <Select
            value={String(sim.startIndex)}
            onChange={(e) => sim.setStartIndex(Number(e.target.value))}
            disabled={disabled || startOptions.length === 0}
          >
            {startOptions.length === 0 ? (
              <option value="0">{t('1.2 km before the stop')}</option>
            ) : (
              startOptions.map((s, i) => (
                <option key={s.id} value={i}>
                  {i + 1}. {s.name}
                </option>
              ))
            )}
          </Select>
        </Field>
        <Field label={t('Speed')}>
          <Select value={String(sim.speedKmh)} onChange={(e) => sim.setSpeed(Number(e.target.value))} disabled={disabled}>
            {SIM_SPEEDS.map((s) => (
              <option key={s.kmh} value={s.kmh}>
                {t(s.label)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          <span className="font-semibold">{t('Realistic GPS noise')}</span>
          <span className="block text-xs text-ink-subtle">{t('Scatters positions by up to 15 m, like a real phone.')}</span>
        </span>
        <Switch checked={sim.jitterM > 0} onCheckedChange={(on) => sim.setJitter(on ? 15 : 0)} disabled={disabled} />
      </label>

      <div>
        <div className="mb-1.5 flex justify-between text-xs text-ink-subtle">
          <span>{t('Progress')}</span>
          <span className="tabular">{sim.remainingToStopM != null ? t('{distance} to the stop along the route', { distance: formatDistance(sim.remainingToStopM) }) : ''}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(sim.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={t('Simulation progress')}>
          <div className="h-full rounded-full bg-violet-600 transition-[width] duration-700" style={{ width: `${sim.progress * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {sim.running ? (
          <Button variant="secondary" onClick={sim.pause} disabled={disabled}>
            <Pause aria-hidden /> {t('Pause bus')}
          </Button>
        ) : (
          <Button onClick={sim.play} disabled={disabled} className="bg-violet-700 hover:bg-violet-800">
            <Play aria-hidden /> {sim.progress > 0 && sim.progress < 1 ? t('Continue') : t('Start driving')}
          </Button>
        )}
        <Button variant="outline" onClick={() => sim.jumpBeforeStop(350)} disabled={disabled}>
          <FastForward aria-hidden /> {t('Jump to 350 m before')}
        </Button>
        <Button variant="ghost" onClick={sim.restart} disabled={disabled}>
          <RotateCcw aria-hidden /> {t('Restart')}
        </Button>
      </div>

      <p className="flex items-start gap-2 text-xs text-ink-subtle">
        <MousePointerClick className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        {t('Tip: click anywhere on the map to place the simulated position there (manual test).')}
      </p>
    </div>
  );
}
