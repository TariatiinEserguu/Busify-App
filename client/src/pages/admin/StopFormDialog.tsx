import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { LocateFixed } from 'lucide-react';
import { isValidCoordinate, stopSchema } from '@busify/shared';
import { MapPicker } from '@/components/map/MapPicker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Callout } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import type { Stop } from '@/lib/types';

interface StopFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stop?: Stop | null;
  contextStops?: Stop[];
  onSaved?: (stop: Stop) => void;
}

const empty = { name: '', code: '', description: '', latitude: '', longitude: '' };

/** Create or edit a stop: pick the location on the map or type coordinates (manual fallback). */
export function StopFormDialog({ open, onOpenChange, stop, contextStops = [], onSaved }: StopFormDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm(empty);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    form.setErrors({});
    form.setValues(
      stop
        ? {
            name: stop.name,
            code: stop.code ?? '',
            description: stop.description,
            latitude: String(stop.latitude),
            longitude: String(stop.longitude),
          }
        : empty,
    );
  }, [open, stop]);

  const lat = Number(form.values.latitude);
  const lng = Number(form.values.longitude);
  const point = form.values.latitude !== '' && form.values.longitude !== '' && isValidCoordinate({ lat, lng }) ? { lat, lng } : null;

  function setPoint(p: { lat: number; lng: number }) {
    form.set('latitude', p.lat.toFixed(6));
    form.set('longitude', p.lng.toFixed(6));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = form.validate(stopSchema);
    if (!input) return;
    setBusy(true);
    try {
      const res = stop
        ? await api.put<{ stop: Stop }>(`/stops/${stop.id}`, input)
        : await api.post<{ stop: Stop }>('/stops', input);
      await queryClient.invalidateQueries({ queryKey: ['stops'] });
      await queryClient.invalidateQueries({ queryKey: ['routes'] });
      toast.success(stop ? 'Stop saved' : 'Stop created');
      onSaved?.(res.stop);
      onOpenChange(false);
    } catch (err) {
      if (!form.applyServerError(err)) setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl"
        title={stop ? `Edit stop — ${stop.name}` : 'New stop'}
        description="Enter the real location of the stop. Coordinates use decimal degrees (WGS 84), e.g. 47.918700, 106.908000."
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="stop-form" loading={busy}>
              {stop ? 'Save stop' : 'Create stop'}
            </Button>
          </>
        }
      >
        <form id="stop-form" onSubmit={onSubmit} noValidate className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-4">
            {formError && <Callout tone="error">{formError}</Callout>}
            <Field label="Stop name" error={form.errors.name}>
              <Input {...form.bind('name')} autoFocus />
            </Field>
            <Field label="Stop code" optional error={form.errors.code} hint="Short reference printed at the stop, e.g. CP-01.">
              <Input {...form.bind('code')} className="font-mono uppercase" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude" error={form.errors.latitude}>
                <Input inputMode="decimal" placeholder="47.918700" {...form.bind('latitude')} className="font-mono" />
              </Field>
              <Field label="Longitude" error={form.errors.longitude}>
                <Input inputMode="decimal" placeholder="106.908000" {...form.bind('longitude')} className="font-mono" />
              </Field>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                navigator.geolocation?.getCurrentPosition(
                  (pos) => setPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => toast.error('Could not read your location', { description: 'Check the location permission, or pick the point on the map.' }),
                  { enableHighAccuracy: true, timeout: 15_000 },
                )
              }
            >
              <LocateFixed aria-hidden /> Use my current location
            </Button>
            <Field label="Description" optional error={form.errors.description}>
              <Textarea rows={3} {...form.bind('description')} placeholder="Which side of the road, landmarks…" />
            </Field>
          </div>
          <MapPicker
            className="h-72 md:h-full md:min-h-80"
            value={point}
            onChange={setPoint}
            context={contextStops.filter((s) => s.id !== stop?.id)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
