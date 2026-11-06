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
import { useI18n } from '@/lib/i18n';
import { ArrowRight, Lock, Mail } from 'lucide-react';
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
  const { t } = useI18n();

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
      title={t('Sign in')}
      subtitle={t('Welcome back. Sign in to plan a journey or open your dashboard.')}
      footer={
        config.registrationOpen ? (
          <>{t('New user?')} <Link to="/register" className="font-semibold text-ink underline underline-offset-4">{t('Register')}</Link></>
        ) : (
          t('New registrations are currently closed.')
        )
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Callout tone="error">{formError}</Callout>}
        <Field label={t('Email')} error={form.errors.email}>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input type="email" autoComplete="email" inputMode="email" autoFocus className="h-14 rounded-2xl pl-11 text-base" placeholder="name@busify.mn" {...form.bind('email')} />
          </div>
        </Field>
        <Field label={t('Password')} error={form.errors.password}>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-subtle" aria-hidden />
            <Input type="password" autoComplete="current-password" className="h-14 rounded-2xl pl-11 text-base" {...form.bind('password')} />
          </div>
        </Field>
        <Button type="submit" variant="accent" className="w-full" size="xl" loading={busy}>
          {t('Sign in')} <ArrowRight aria-hidden />
        </Button>
        {config.demoMode && (
          <p className="text-xs text-ink-subtle">
            {t('Demo mode is on: the demonstration accounts listed in the README can sign in.')}
          </p>
        )}
      </form>
    </AuthLayout>
  );
}
