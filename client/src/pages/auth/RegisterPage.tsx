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
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const { register } = useAuth();
  const { config } = usePublicConfig();
  const navigate = useNavigate();
  const form = useForm({ name: '', email: '', password: '', confirm: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const input = form.validate(registerSchema);
    if (!input) return;
    if (form.values.password !== form.values.confirm) {
      form.setErrors({ confirm: 'Passwords do not match' });
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
      title="Create your account"
      subtitle="A free passenger account lets you set stop alerts and contact support."
      footer={<>Already registered? <Link to="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link></>}
    >
      {!config.registrationOpen && (
        <Callout tone="warning" className="mb-4" title="Registration is closed">
          The administrator has paused new sign-ups. You can still sign in with an existing account.
        </Callout>
      )}
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && <Callout tone="error">{formError}</Callout>}
        <Field label="Full name" error={form.errors.name}>
          <Input autoComplete="name" autoFocus {...form.bind('name')} />
        </Field>
        <Field label="Email" error={form.errors.email}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.bind('email')} />
        </Field>
        <Field label="Password" error={form.errors.password} hint="At least 8 characters, with a letter and a number.">
          <Input type="password" autoComplete="new-password" {...form.bind('password')} />
        </Field>
        <Field label="Repeat password" error={form.errors.confirm}>
          <Input type="password" autoComplete="new-password" {...form.bind('confirm')} />
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={busy} disabled={!config.registrationOpen}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  );
}
