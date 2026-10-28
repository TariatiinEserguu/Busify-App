import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { loginSchema } from '@busify/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/AuthProvider';
import { homeFor } from '@/features/auth/homeFor';
import { usePublicConfig } from '@/features/appData';
import { errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import { AuthLayout } from './AuthLayout';

export function LoginPage() {
  const { login } = useAuth();
  const { config } = usePublicConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const form = useForm({ email: '', password: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = form.validate(loginSchema);
    if (!input) return;
    setBusy(true);
    try {
      const user = await login(input);
      navigate(user.mustChangePassword ? '/change-password' : from && from !== '/login' ? from : homeFor(user), { replace: true });
    } catch (err) {
      if (!form.applyServerError(err)) setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Sign in to plan a journey or open your dashboard."
      footer={
        config.registrationOpen ? (
          <>New to BUSIFY? <Link to="/register" className="font-medium text-brand-700 hover:underline">Create a passenger account</Link></>
        ) : (
          'New registrations are currently closed.'
        )
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Callout tone="error">{formError}</Callout>}
        <Field label="Email" error={form.errors.email}>
          <Input type="email" autoComplete="email" inputMode="email" autoFocus {...form.bind('email')} />
        </Field>
        <Field label="Password" error={form.errors.password}>
          <Input type="password" autoComplete="current-password" {...form.bind('password')} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Sign in
        </Button>
        {config.demoMode && (
          <p className="text-xs text-ink-subtle">
            Demo mode is on: the demonstration accounts listed in the README can sign in.
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
