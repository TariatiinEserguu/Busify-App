import { Link } from 'react-router';
import { SignpostBig } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';

export function NotFoundPage() {
  return (
    <Page>
      <EmptyState icon={SignpostBig} title="This page does not exist" action={<Button asChild><Link to="/">Back to my journey</Link></Button>}>
        The link may be outdated, or the item was removed.
      </EmptyState>
    </Page>
  );
}
