import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { registerSchema } from '@busify/shared';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePublicConfig } from '@/features/appData';
import { errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import { useI18n } from '@/lib/i18n';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const { register } = useAuth();
  const { config } = usePublicConfig();
  const navigate = useNavigate();
  const form = useForm({ name: '', email: '', password: '', confirm: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { t } = useI18n();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = form.validate(registerSchema);
    if (!input) return;
    if (form.values.password !== form.values.confirm) {
      form.setErrors({ confirm: t('Passwords do not match') });
      return;
    }
    setBusy(true);
    try {
      await register(input);
      navigate('/', { replace: true });
    } catch (err) {
      if (!form.applyServerError(err)) setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={t('Create your account')}
      subtitle={t('A free passenger account lets you set stop alerts and contact support.')}
      footer={<>{t('Already registered?')} <Link to="/login" className="font-semibold text-ink underline underline-offset-4">{t('Sign in')}</Link></>}
    >
      {!config.registrationOpen && (
        <Callout tone="warning" className="mb-4" title={t('Registration is closed')}>
          {t('The administrator has paused new sign-ups. You can still sign in with an existing account.')}
        </Callout>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Callout tone="error">{formError}</Callout>}
        <Field label={t('Full name')} error={form.errors.name}>
          <Input autoComplete="name" autoFocus {...form.bind('name')} />
        </Field>
        <Field label={t('Email')} error={form.errors.email}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.bind('email')} />
        </Field>
        <Field label={t('Password')} error={form.errors.password} hint={t('At least 8 characters, with a letter and a number.')}>
          <Input type="password" autoComplete="new-password" {...form.bind('password')} />
        </Field>
        <Field label={t('Repeat password')} error={form.errors.confirm}>
          <Input type="password" autoComplete="new-password" {...form.bind('confirm')} />
        </Field>
        <Button type="submit" variant="accent" className="w-full" size="xl" loading={busy} disabled={!config.registrationOpen}>
          {t('Create account')}
        </Button>
      </form>
    </AuthLayout>
  );
}
