import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowDown, ArrowLeft, ArrowUp, MapPin, Plus, Trash2, X } from 'lucide-react';
import { haversineDistanceM, formatDistance, ROUTE_STATUS_LABELS, ROUTE_STATUSES, routeSchema } from '@busify/shared';
import { DemoBadge, RouteBadge } from '@/components/domain';
import { Page } from '@/components/layout/AppShell';
import { BusMap } from '@/components/map/BusMap';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Panel, PanelHeader } from '@/components/ui/layout';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import type { RouteDetail, Stop } from '@/lib/types';
import { StopFormDialog } from './StopFormDialog';

const emptyRoute = {
  number: '',
  name: '',
  description: '',
  status: 'DRAFT',
  color: '#1d41d8',
  firstDeparture: '',
  lastDeparture: '',
  headwayMinutes: '',
};

type EditorStop = Pick<Stop, 'id' | 'name' | 'code' | 'latitude' | 'longitude'>;

export default function AdminRouteEditorPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm(emptyRoute);
  const [stops, setStops] = useState<EditorStop[]>([]);
  const [stopsDirty, setStopsDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addId, setAddId] = useState('');
  const [newStopOpen, setNewStopOpen] = useState(false);

  const routeQuery = useQuery({
    queryKey: ['routes', 'detail', Number(id)],
    queryFn: async () => (await api.get<{ route: RouteDetail }>(`/routes/${id}`)).route,
    enabled: !isNew,
  });
  const allStops = useQuery({
    queryKey: ['stops', 'list'],
    queryFn: async () => (await api.get<{ stops: Stop[] }>('/stops')).stops,
  });

  useEffect(() => {
    const r = routeQuery.data;
    if (!r) return;
    form.setValues({
      number: r.number,
      name: r.name,
      description: r.description,
      status: r.status,
      color: r.color,
      firstDeparture: r.firstDeparture ?? '',
      lastDeparture: r.lastDeparture ?? '',
      headwayMinutes: r.headwayMinutes != null ? String(r.headwayMinutes) : '',
    });
    setStops(r.stops);
    setStopsDirty(false);
  }, [routeQuery.data]);

  const available = useMemo(() => {
    const used = new Set(stops.map((s) => s.id));
    return (allStops.data ?? []).filter((s) => !used.has(s.id));
  }, [allStops.data, stops]);

  const lengthM = useMemo(() => {
    let total = 0;
    for (let i = 1; i < stops.length; i++) {
      total += haversineDistanceM({ lat: stops[i - 1].latitude, lng: stops[i - 1].longitude }, { lat: stops[i].latitude, lng: stops[i].longitude });
    }
    return total;
  }, [stops]);

  function addStop(stop: EditorStop) {
    if (stops.some((s) => s.id === stop.id)) return;
    setStops((prev) => [...prev, stop]);
    setStopsDirty(true);
  }

  function move(index: number, delta: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setStopsDirty(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      ...form.values,
      headwayMinutes: form.values.headwayMinutes === '' ? null : Number(form.values.headwayMinutes),
    };
    const input = form.validate(routeSchema, payload);
    if (!input) return;
    if (input.status === 'ACTIVE' && stops.length < 2) {
      setFormError('A route in service needs at least two stops. Add stops or save it as a draft.');
      return;
    }
    setBusy(true);
    try {
      let routeId = Number(id);
      if (isNew) {
        routeId = (await api.post<{ route: RouteDetail }>('/routes', input)).route.id;
      } else {
        await api.put(`/routes/${routeId}`, input);
      }
      if (isNew || stopsDirty) {
        await api.put(`/routes/${routeId}/stops`, { stopIds: stops.map((s) => s.id) });
      }
      await queryClient.invalidateQueries({ queryKey: ['routes'] });
      await queryClient.invalidateQueries({ queryKey: ['stops'] });
      toast.success(isNew ? 'Route created' : 'Route saved');
      setStopsDirty(false);
      if (isNew) navigate(`/admin/routes/${routeId}`, { replace: true });
    } catch (err) {
      if (!form.applyServerError(err)) setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!isNew && routeQuery.isLoading) {
    return (
      <Page width="wide">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="mt-6 h-96" />
      </Page>
    );
  }
  if (!isNew && (routeQuery.isError || !routeQuery.data)) {
    return (
      <Page>
        <EmptyState icon={MapPin} title="Route not found" action={<Button asChild variant="outline"><Link to="/admin/routes">Back to routes</Link></Button>}>
          {errorMessage(routeQuery.error, 'It may have been deleted.')}
        </EmptyState>
      </Page>
    );
  }

  return (
    <Page width="wide">
      <Link to="/admin/routes" className="mb-3 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Routes
      </Link>
      <form onSubmit={onSubmit} noValidate>
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <RouteBadge number={form.values.number || '?'} color={/^#[0-9a-f]{6}$/i.test(form.values.color) ? form.values.color : undefined} size="lg" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{isNew ? 'New route' : form.values.name || 'Route'}</h1>
            {routeQuery.data?.isDemo && <DemoBadge className="mt-1" />}
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" type="button" onClick={() => navigate('/admin/routes')}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {isNew ? 'Create route' : 'Save changes'}
            </Button>
          </div>
        </header>
        {formError && <Callout tone="error" className="mb-4">{formError}</Callout>}
        {stopsDirty && !isNew && <Callout tone="warning" className="mb-4">Stop order changed — press “Save changes” to apply it.</Callout>}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="space-y-6">
            <Panel>
              <PanelHeader title="Details" />
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                <Field label="Route number" error={form.errors.number} hint="Shown on the badge, e.g. 7 or 12A.">
                  <Input {...form.bind('number')} className="font-mono uppercase" />
                </Field>
                <Field label="Status" error={form.errors.status} hint="Only routes in service are visible to passengers.">
                  <Select {...form.bind('status')}>
                    {ROUTE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ROUTE_STATUS_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Route name" error={form.errors.name} className="sm:col-span-2">
                  <Input {...form.bind('name')} />
                </Field>
                <Field label="Description" optional error={form.errors.description} className="sm:col-span-2">
                  <Textarea rows={2} {...form.bind('description')} />
                </Field>
                <Field label="Colour" error={form.errors.color}>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      aria-label="Pick colour"
                      value={/^#[0-9a-f]{6}$/i.test(form.values.color) ? form.values.color : '#1d41d8'}
                      onChange={(e) => form.set('color', e.target.value)}
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1"
                    />
                    <Input {...form.bind('color')} className="font-mono" />
                  </div>
                </Field>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Schedule" description="Optional. Shown to passengers when choosing a route." />
              <div className="grid gap-4 p-4 sm:grid-cols-3">
                <Field label="First departure" error={form.errors.firstDeparture}>
                  <Input type="time" {...form.bind('firstDeparture')} />
                </Field>
                <Field label="Last departure" error={form.errors.lastDeparture}>
                  <Input type="time" {...form.bind('lastDeparture')} />
                </Field>
                <Field label="Every (minutes)" error={form.errors.headwayMinutes}>
                  <Input type="number" min={1} max={240} inputMode="numeric" {...form.bind('headwayMinutes')} />
                </Field>
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel>
              <PanelHeader
                title={`Stops in order (${stops.length})`}
                description={stops.length > 1 ? `About ${formatDistance(lengthM)} in straight lines between stops` : 'Add at least two stops'}
                actions={
                  <Button type="button" size="sm" variant="outline" onClick={() => setNewStopOpen(true)}>
                    <Plus aria-hidden /> New stop
                  </Button>
                }
              />
              <div className="border-b border-line p-4">
                <div className="flex gap-2">
                  <Select value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Existing stop to add" disabled={available.length === 0}>
                    <option value="">{available.length === 0 ? 'All stops are on this route' : 'Add an existing stop…'}</option>
                    {available.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                        {s.code ? ` (${s.code})` : ''}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!addId}
                    onClick={() => {
                      const s = available.find((x) => x.id === Number(addId));
                      if (s) addStop(s);
                      setAddId('');
                    }}
                  >
                    Add
                  </Button>
                </div>
                <p className="mt-2 text-xs text-ink-subtle">Tip: click a grey stop on the map to append it to the route.</p>
              </div>
              {stops.length === 0 ? (
                <EmptyState icon={MapPin} title="No stops on this route yet">
                  Add existing stops from the list or the map, or create a new stop.
                </EmptyState>
              ) : (
                <ol className="divide-y divide-line">
                  {stops.map((s, i) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink-muted">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.name}</span>
                        <span className="block font-mono text-[11px] text-ink-subtle">
                          {s.latitude.toFixed(5)}, {s.longitude.toFixed(5)}
                          {s.code ? ` · ${s.code}` : ''}
                        </span>
                      </span>
                      <div className="flex shrink-0 gap-0.5">
                        <Button type="button" variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${s.name} up`}>
                          <ArrowUp />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" disabled={i === stops.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${s.name} down`}>
                          <ArrowDown />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setStops((prev) => prev.filter((x) => x.id !== s.id));
                            setStopsDirty(true);
                          }}
                          aria-label={`Remove ${s.name} from the route`}
                        >
                          <X />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel className="overflow-hidden">
              <BusMap
                className="h-80"
                stops={stops.map((s) => ({ ...s }))}
                routeColor={/^#[0-9a-f]{6}$/i.test(form.values.color) ? form.values.color : '#1d41d8'}
                otherStops={available}
                onStopClick={(stopId) => {
                  const s = available.find((x) => x.id === stopId);
                  if (s) addStop(s);
                }}
                fitKey={`${id}-${routeQuery.data ? 1 : 0}-${allStops.data ? 1 : 0}`}
                ariaLabel="Route map"
              />
            </Panel>

            {!isNew && routeQuery.data && (
              <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <p className="text-sm text-ink-muted">Deleting ends journeys tracking on this route. History is kept.</p>
                <ConfirmDialog
                  trigger={
                    <Button type="button" variant="danger-outline">
                      <Trash2 aria-hidden /> Delete route
                    </Button>
                  }
                  title={`Delete route ${routeQuery.data.number}?`}
                  description="This cannot be undone. To hide the route temporarily, set its status to Suspended instead."
                  confirmLabel="Delete route"
                  destructive
                  onConfirm={async () => {
                    try {
                      await api.delete(`/routes/${routeQuery.data!.id}`);
                      await queryClient.invalidateQueries({ queryKey: ['routes'] });
                      toast.success('Route deleted');
                      navigate('/admin/routes', { replace: true });
                    } catch (err) {
                      toast.error('Could not delete the route', { description: errorMessage(err) });
                    }
                  }}
                />
              </Panel>
            )}
          </div>
        </div>
      </form>

      <StopFormDialog open={newStopOpen} onOpenChange={setNewStopOpen} contextStops={allStops.data ?? []} onSaved={(s) => addStop(s)} />
    </Page>
  );
}
