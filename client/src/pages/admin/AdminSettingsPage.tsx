import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Minus } from 'lucide-react';
import { PERMISSION_DESCRIPTIONS, systemSettingsSchema, type PermissionKey } from '@busify/shared';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/controls';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { PageHeader, Panel, PanelHeader, Table, Td, Th } from '@/components/ui/layout';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import type { SystemSettings } from '@/lib/types';

interface RolesPayload {
  roles: Array<{ id: number; name: string; label: string; description: string; userCount: number; permissions: string[] }>;
  permissions: Array<{ key: string; description: string }>;
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: async () => (await api.get<{ settings: SystemSettings }>('/admin/settings')).settings,
  });
  const roles = useQuery({ queryKey: ['admin', 'roles'], queryFn: () => api.get<RolesPayload>('/admin/roles') });
  const form = useForm({
    defaultAlertRadiusM: '',
    minAlertRadiusM: '',
    maxAlertRadiusM: '',
    gpsMaxAccuracyM: '',
    alertConfirmReadings: '',
    announcement: '',
  });
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    const s = settings.data;
    if (!s) return;
    form.setValues({
      defaultAlertRadiusM: String(s.defaultAlertRadiusM),
      minAlertRadiusM: String(s.minAlertRadiusM),
      maxAlertRadiusM: String(s.maxAlertRadiusM),
      gpsMaxAccuracyM: String(s.gpsMaxAccuracyM),
      alertConfirmReadings: String(s.alertConfirmReadings),
      announcement: s.announcement,
    });
    setRegistrationOpen(s.registrationOpen);
  }, [settings.data]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = form.validate(systemSettingsSchema, { ...form.values, registrationOpen });
    if (!input) return;
    setBusy(true);
    try {
      const res = await api.put<{ settings: SystemSettings }>('/admin/settings', input);
      queryClient.setQueryData(['admin', 'settings'], res.settings);
      await queryClient.invalidateQueries({ queryKey: ['config'] });
      toast.success('System settings saved and active');
    } catch (err) {
      if (!form.applyServerError(err)) setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <PageHeader title="System settings" description="Changes apply immediately to everyone. Every change is recorded in the audit log." />
      <div className="space-y-6">
        {settings.isLoading ? (
          <Skeleton className="h-96" />
        ) : settings.isError ? (
          <Callout tone="error">{errorMessage(settings.error)}</Callout>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <Panel>
              <PanelHeader title="Stop alerts" description="Limits for the alert distance passengers can choose, and how GPS readings are filtered." />
              <div className="grid gap-4 p-4 sm:grid-cols-3">
                <Field label="Default distance (m)" error={form.errors.defaultAlertRadiusM} hint="For new passengers.">
                  <Input type="number" inputMode="numeric" {...form.bind('defaultAlertRadiusM')} />
                </Field>
                <Field label="Minimum (m)" error={form.errors.minAlertRadiusM}>
                  <Input type="number" inputMode="numeric" {...form.bind('minAlertRadiusM')} />
                </Field>
                <Field label="Maximum (m)" error={form.errors.maxAlertRadiusM}>
                  <Input type="number" inputMode="numeric" {...form.bind('maxAlertRadiusM')} />
                </Field>
                <Field label="Ignore GPS worse than (m)" error={form.errors.gpsMaxAccuracyM} hint="Readings with a larger accuracy radius are not used for alerts." className="sm:col-span-2">
                  <Input type="number" inputMode="numeric" {...form.bind('gpsMaxAccuracyM')} />
                </Field>
                <Field label="Confirm readings" error={form.errors.alertConfirmReadings} hint="Consecutive readings needed at the edge of the radius.">
                  <Input type="number" inputMode="numeric" min={1} max={5} {...form.bind('alertConfirmReadings')} />
                </Field>
              </div>
            </Panel>
            <Panel className="mt-6">
              <PanelHeader title="Access and announcements" />
              <div className="space-y-4 p-4">
                <label className="flex items-center justify-between gap-4">
                  <span>
                    <span className="block text-sm font-medium">Allow new passenger registrations</span>
                    <span className="block text-xs text-ink-subtle">When off, only existing accounts can sign in.</span>
                  </span>
                  <Switch checked={registrationOpen} onCheckedChange={setRegistrationOpen} aria-label="Allow registrations" />
                </label>
                <Field label="Announcement banner" optional error={form.errors.announcement} hint="Shown at the top of every page, e.g. planned maintenance. Leave empty to hide.">
                  <Textarea rows={2} maxLength={280} {...form.bind('announcement')} />
                </Field>
              </div>
              {formError && <div className="px-4 pb-2"><Callout tone="error">{formError}</Callout></div>}
              <div className="flex justify-end border-t border-line px-4 py-3">
                <Button type="submit" loading={busy}>Save and activate</Button>
              </div>
            </Panel>
          </form>
        )}

        <Panel>
          <PanelHeader title="Roles and permissions" description="Permissions are checked on the server for every request. Change a person's role on the Users page." />
          {roles.isLoading || !roles.data ? (
            <Skeleton className="m-4 h-40" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Permission</Th>
                  {roles.data.roles.map((r) => (
                    <Th key={r.id} className="text-center">
                      {r.label}
                      <span className="block font-normal normal-case tracking-normal">{r.userCount} user{r.userCount === 1 ? '' : 's'}</span>
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.data.permissions.map((p) => (
                  <tr key={p.key}>
                    <Td>
                      <span className="block text-sm">{PERMISSION_DESCRIPTIONS[p.key as PermissionKey] ?? p.description}</span>
                      <span className="font-mono text-[11px] text-ink-subtle">{p.key}</span>
                    </Td>
                    {roles.data!.roles.map((r) => (
                      <Td key={r.id} className="text-center">
                        {r.permissions.includes(p.key) ? (
                          <Check className="mx-auto size-4 text-emerald-600" aria-label="Granted" />
                        ) : (
                          <Minus className="mx-auto size-4 text-slate-300" aria-label="Not granted" />
                        )}
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </Page>
  );
}
