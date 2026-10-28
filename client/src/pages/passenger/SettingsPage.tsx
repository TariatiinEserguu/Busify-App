import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, LocateFixed, MinusCircle, Volume2 } from 'lucide-react';
import { changePasswordSchema, profileSchema } from '@busify/shared';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/controls';
import { Callout, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PageHeader, Panel, PanelHeader } from '@/components/ui/layout';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePublicConfig, useSaveUserSettings, useUserSettings } from '@/features/appData';
import { capabilities, requestNotificationPermission, testAlert, unlockAudio } from '@/features/journey/alertEffects';
import { GPS_HELP, useCurrentPosition, useLocationPermission } from '@/features/journey/useGeolocation';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import type { SessionPayload, User } from '@/lib/types';
import { formatDate } from '@/lib/utils';
import { RadiusControl } from './journey/RadiusControl';

export function SettingsPage() {
  const { can } = useAuth();
  return (
    <Page width="narrow">
      <PageHeader title="Settings" description="Alert preferences, location access and your account." />
      <div className="space-y-6">
        {can('journeys:use') && <AlertSettings />}
        {can('journeys:use') && <LocationSettings />}
        <AccountSettings />
        <PasswordSettings />
      </div>
    </Page>
  );
}

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        {description && <p className="mt-0.5 text-xs text-ink-subtle">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Supported({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? 'inline-flex items-center gap-1 text-emerald-700' : 'inline-flex items-center gap-1 text-ink-subtle'}>
      {ok ? <CheckCircle2 className="size-3.5" aria-hidden /> : <MinusCircle className="size-3.5" aria-hidden />}
      {label}
    </span>
  );
}

function AlertSettings() {
  const { settings, isLoading } = useUserSettings();
  const { config } = usePublicConfig();
  const save = useSaveUserSettings();
  const [draft, setDraft] = useState(settings);
  const [notificationState, setNotificationState] = useState<string>(() =>
    capabilities.notifications() ? Notification.permission : 'unsupported',
  );
  useEffect(() => setDraft(settings), [settings]);

  const dirty =
    draft.alertRadiusM !== settings.alertRadiusM ||
    draft.soundEnabled !== settings.soundEnabled ||
    draft.vibrationEnabled !== settings.vibrationEnabled ||
    draft.notificationsEnabled !== settings.notificationsEnabled ||
    draft.keepScreenAwake !== settings.keepScreenAwake;

  if (isLoading) return <Skeleton className="h-80" />;

  return (
    <Panel>
      <PanelHeader title="Stop alert" description="Used for new journeys. You can also change the distance during a journey." />
      <div className="border-b border-line px-4 py-4">
        <RadiusControl
          value={draft.alertRadiusM}
          onChange={(v) => setDraft({ ...draft, alertRadiusM: v })}
          min={config.alert.minRadiusM}
          max={config.alert.maxRadiusM}
        />
        <p className="mt-3 text-xs text-ink-subtle">
          Default is {config.alert.defaultRadiusM} m. On a fast road, a larger distance gives you more time to get ready.
        </p>
      </div>
      <div className="divide-y divide-line">
        <Row title="Sound" description="A repeating chime until you dismiss the alert.">
          <Switch checked={draft.soundEnabled} onCheckedChange={(v) => setDraft({ ...draft, soundEnabled: v })} aria-label="Sound" />
        </Row>
        <Row
          title="Vibration"
          description={capabilities.vibration() ? 'Vibrates the phone with the alert.' : 'Not supported by this browser (e.g. iPhone Safari).'}
        >
          <Switch checked={draft.vibrationEnabled} onCheckedChange={(v) => setDraft({ ...draft, vibrationEnabled: v })} aria-label="Vibration" />
        </Row>
        <Row
          title="System notification"
          description={
            notificationState === 'unsupported'
              ? 'Needs a secure (https or localhost) page and a browser that supports notifications.'
              : notificationState === 'denied'
                ? 'Blocked in your browser settings for this site.'
                : notificationState === 'granted'
                  ? 'Allowed. Shown even if BUSIFY is in another tab.'
                  : 'Your browser will ask for permission.'
          }
        >
          <div className="flex items-center gap-2">
            {notificationState === 'default' && draft.notificationsEnabled && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => setNotificationState(await requestNotificationPermission())}
              >
                Allow
              </Button>
            )}
            <Switch
              checked={draft.notificationsEnabled}
              onCheckedChange={(v) => setDraft({ ...draft, notificationsEnabled: v })}
              aria-label="System notification"
            />
          </div>
        </Row>
        <Row title="Keep screen awake" description="Stops the screen from locking while a journey is tracked (helps GPS keep running).">
          <Switch checked={draft.keepScreenAwake} onCheckedChange={(v) => setDraft({ ...draft, keepScreenAwake: v })} aria-label="Keep screen awake" />
        </Row>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <Supported ok={capabilities.sound()} label="Sound" />
          <Supported ok={capabilities.vibration()} label="Vibration" />
          <Supported ok={capabilities.notifications()} label="Notifications" />
          <Supported ok={capabilities.wakeLock()} label="Screen wake lock" />
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              unlockAudio();
              testAlert({ sound: draft.soundEnabled, vibration: draft.vibrationEnabled });
            }}
          >
            <Volume2 aria-hidden /> Test alert
          </Button>
          <Button
            disabled={!dirty}
            loading={save.isPending}
            onClick={() =>
              save.mutate(
                {
                  alertRadiusM: draft.alertRadiusM,
                  soundEnabled: draft.soundEnabled,
                  vibrationEnabled: draft.vibrationEnabled,
                  notificationsEnabled: draft.notificationsEnabled,
                  keepScreenAwake: draft.keepScreenAwake,
                },
                {
                  onSuccess: () => toast.success('Alert settings saved'),
                  onError: (err) => toast.error('Could not save settings', { description: errorMessage(err) }),
                },
              )
            }
          >
            Save
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function LocationSettings() {
  const permission = useLocationPermission();
  const check = useCurrentPosition(false);
  const label: Record<string, string> = {
    granted: 'Allowed',
    denied: 'Blocked',
    prompt: 'Not decided yet — your browser will ask',
    unknown: 'Unknown (this browser does not report it)',
    insecure: 'Unavailable on this connection',
    unsupported: 'Not supported',
  };
  return (
    <Panel>
      <PanelHeader title="Location access" description="BUSIFY needs your position to know when you are near your stop." />
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Permission: <strong className="font-semibold">{label[permission] ?? permission}</strong>
          </p>
          <Button variant="outline" onClick={check.request} loading={check.state === 'locating'} disabled={permission === 'insecure' || permission === 'unsupported'}>
            <LocateFixed aria-hidden /> {permission === 'granted' ? 'Check my location' : 'Allow location'}
          </Button>
        </div>
        {check.state === 'ok' && check.position && (
          <Callout tone="success" title="Location works">
            Found your position {check.position.accuracyM ? `with ±${Math.round(check.position.accuracyM)} m accuracy` : ''}. Stop
            alerts will work on this device.
          </Callout>
        )}
        {(permission === 'denied' || check.state === 'denied') && <Callout tone="warning" title="Location is blocked">{GPS_HELP.denied}</Callout>}
        {permission === 'insecure' && <Callout tone="warning" title="Secure connection needed">{GPS_HELP.insecure}</Callout>}
        {permission === 'unsupported' && <Callout tone="warning">{GPS_HELP.unsupported}</Callout>}
        {check.state === 'error' && <Callout tone="warning">{check.message}</Callout>}
        <div className="rounded-lg bg-canvas px-3 py-3 text-xs leading-relaxed text-ink-muted">
          <p className="font-medium text-ink">How to allow location</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            <li>Chrome / Edge: click the icon left of the address bar → Site settings → Location → Allow.</li>
            <li>Android: also turn on Location in the phone’s quick settings.</li>
            <li>iPhone: Settings → Privacy & Security → Location Services → Safari Websites → While Using.</li>
          </ul>
          <p className="mt-2">
            Your raw coordinates stay in your browser. BUSIFY only stores the distance to your stop for the current journey.
          </p>
        </div>
      </div>
    </Panel>
  );
}

function AccountSettings() {
  const { user, setSession, permissions } = useAuth();
  const form = useForm({ name: user?.name ?? '', phone: user?.phone ?? '' });
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = form.validate(profileSchema);
    if (!input) return;
    setBusy(true);
    try {
      const res = await api.patch<{ user: User }>('/me/profile', input);
      setSession({ user: res.user, permissions });
      toast.success('Profile updated');
    } catch (err) {
      if (!form.applyServerError(err)) toast.error('Could not update profile', { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title="Account" />
      <form onSubmit={onSubmit} noValidate className="space-y-4 px-4 py-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-subtle">Email</dt>
            <dd className="mt-0.5 break-all font-medium">{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Role</dt>
            <dd className="mt-0.5 font-medium">{user.roleLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-subtle">Member since</dt>
            <dd className="mt-0.5 font-medium">{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={form.errors.name}>
            <Input autoComplete="name" {...form.bind('name')} />
          </Field>
          <Field label="Phone" optional error={form.errors.phone}>
            <Input type="tel" autoComplete="tel" {...form.bind('phone')} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="outline" loading={busy}>
            Save profile
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function PasswordSettings() {
  const { setSession } = useAuth();
  const form = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const input = form.validate(changePasswordSchema);
    if (!input) return;
    if (form.values.newPassword !== form.values.confirm) return form.setErrors({ confirm: 'Passwords do not match' });
    setBusy(true);
    try {
      setSession(await api.post<SessionPayload>('/auth/change-password', input));
      form.setValues({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed. Other devices were signed out.');
    } catch (err) {
      if (!form.applyServerError(err)) toast.error('Could not change password', { description: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader title="Password" description="Changing it signs you out on every other device." />
      <form onSubmit={onSubmit} noValidate className="grid gap-4 px-4 py-4 sm:grid-cols-3">
        <Field label="Current password" error={form.errors.currentPassword}>
          <Input type="password" autoComplete="current-password" {...form.bind('currentPassword')} />
        </Field>
        <Field label="New password" error={form.errors.newPassword}>
          <Input type="password" autoComplete="new-password" {...form.bind('newPassword')} />
        </Field>
        <Field label="Repeat new password" error={form.errors.confirm}>
          <Input type="password" autoComplete="new-password" {...form.bind('confirm')} />
        </Field>
        <div className="flex justify-end sm:col-span-3">
          <Button type="submit" variant="outline" loading={busy}>
            Change password
          </Button>
        </div>
      </form>
    </Panel>
  );
}
