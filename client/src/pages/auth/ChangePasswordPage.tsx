import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { changePasswordSchema } from '@busify/shared';
import { Button } from '@/components/ui/button';
import { Callout, Spinner } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeFor } from '@/features/auth/homeFor';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import type { SessionPayload } from '@/lib/types';
import { useI18n } from '@/lib/i18n';
import { AuthLayout } from './AuthLayout';

/** Shown when an administrator issued a temporary password. */
export function ChangePasswordPage() {
  const { user, status, setSession, logout } = useAuth();
  const navigate = useNavigate();
  const form = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  if (status === 'loading') return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = form.validate(changePasswordSchema);
    if (!input) return;
    if (form.values.newPassword !== form.values.confirm) {
      form.setErrors({ confirm: t('Passwords do not match') });
      return;
    }
    setBusy(true);
    try {
      const payload = await api.post<SessionPayload>('/auth/change-password', input);
      setSession(payload);
      navigate(homeFor(payload.user), { replace: true });
    } catch (err) {
      if (!form.applyServerError(err)) setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={user.mustChangePassword ? t('Choose a new password') : t('Change password')}
      subtitle={
        user.mustChangePassword
          ? t('Your account uses a temporary password set by an administrator. Choose your own password to continue.')
          : undefined
      }
      footer={
        <button className="font-semibold text-ink underline underline-offset-4" onClick={() => logout().then(() => navigate('/login'))}>
          {t('Sign out instead')}
        </button>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Callout tone="error">{formError}</Callout>}
        <Field label={user.mustChangePassword ? t('Temporary password') : t('Current password')} error={form.errors.currentPassword}>
          <Input type="password" autoComplete="current-password" autoFocus {...form.bind('currentPassword')} />
        </Field>
        <Field label={t('New password')} error={form.errors.newPassword} hint={t('At least 8 characters, with a letter and a number.')}>
          <Input type="password" autoComplete="new-password" {...form.bind('newPassword')} />
        </Field>
        <Field label={t('Repeat new password')} error={form.errors.confirm}>
          <Input type="password" autoComplete="new-password" {...form.bind('confirm')} />
        </Field>
        <Button type="submit" variant="accent" className="w-full" size="xl" loading={busy}>
          {t('Save new password')}
        </Button>
      </form>
    </AuthLayout>
  );
}
