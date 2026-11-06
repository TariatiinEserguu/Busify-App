import { Link } from 'react-router';
import { SignpostBig } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { t } from '@/lib/i18n';

export function NotFoundPage() {
  return (
    <Page>
      <EmptyState icon={SignpostBig} title={t('This page does not exist')} action={<Button asChild><Link to="/">{t('Back to my journey')}</Link></Button>}>
        {t('The link may be outdated, or the item was removed.')}
      </EmptyState>
    </Page>
  );
}
