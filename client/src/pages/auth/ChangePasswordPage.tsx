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
import { AuthLayout } from './AuthLayout';

/** Shown when an administrator issued a temporary password. */
export function ChangePasswordPage() {
  const { user, status, setSession, logout } = useAuth();
  const navigate = useNavigate();
  const form = useForm({ currentPassword: '', newPassword: '', confirm: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <div className="flex min-h-dvh items-center justify-center"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = form.validate(changePasswordSchema);
    if (!input) return;
    if (form.values.newPassword !== form.values.confirm) {
      form.setErrors({ confirm: 'Passwords do not match' });
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
      title={user.mustChangePassword ? 'Choose a new password' : 'Change password'}
      subtitle={
        user.mustChangePassword
          ? 'Your account uses a temporary password set by an administrator. Choose your own password to continue.'
          : undefined
      }
      footer={
        <button className="font-medium text-brand-700 hover:underline" onClick={() => logout().then(() => navigate('/login'))}>
          Sign out instead
        </button>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Callout tone="error">{formError}</Callout>}
        <Field label={user.mustChangePassword ? 'Temporary password' : 'Current password'} error={form.errors.currentPassword}>
          <Input type="password" autoComplete="current-password" autoFocus {...form.bind('currentPassword')} />
        </Field>
        <Field label="New password" error={form.errors.newPassword} hint="At least 8 characters, with a letter and a number.">
          <Input type="password" autoComplete="new-password" {...form.bind('newPassword')} />
        </Field>
        <Field label="Repeat new password" error={form.errors.confirm}>
          <Input type="password" autoComplete="new-password" {...form.bind('confirm')} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Save new password
        </Button>
      </form>
    </AuthLayout>
  );
}
