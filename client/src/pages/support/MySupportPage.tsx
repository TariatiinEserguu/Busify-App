import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronRight, LifeBuoy, Plus } from 'lucide-react';
import { createTicketSchema, TICKET_CATEGORIES, TICKET_CATEGORY_LABELS, type TicketCategory } from '@busify/shared';
import { Page } from '@/components/layout/AppShell';
import { RouteBadge, TicketStatusBadge } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input, Select, Textarea } from '@/components/ui/input';
import { PageHeader, Panel } from '@/components/ui/layout';
import { api, errorMessage } from '@/lib/api';
import { useForm } from '@/lib/form';
import type { Journey, TicketDetail, TicketListPayload } from '@/lib/types';
import { formatDate, timeAgo } from '@/lib/utils';

export function MySupportPage() {
  const [params, setParams] = useSearchParams();
  const journeyParam = Number(params.get('journey')) || null;
  const [open, setOpen] = useState(!!journeyParam);
  const query = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => api.get<TicketListPayload>('/support/tickets?pageSize=100'),
  });

  return (
    <Page width="narrow">
      <PageHeader
        title="Help & feedback"
        description="Report a problem, ask a question or send feedback. Our support team replies here."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus aria-hidden /> New request
          </Button>
        }
      />

      {query.isLoading ? (
        <Skeleton className="h-40" />
      ) : query.isError ? (
        <Callout tone="error" title="Could not load your requests">
          {errorMessage(query.error)}
        </Callout>
      ) : query.data!.tickets.length === 0 ? (
        <Panel>
          <EmptyState icon={LifeBuoy} title="No support requests yet" action={<Button variant="outline" onClick={() => setOpen(true)}>Contact support</Button>}>
            If an alert came too late, a stop is in the wrong place or anything else is off, let us know.
          </EmptyState>
        </Panel>
      ) : (
        <Panel>
          <ul className="divide-y divide-line">
            {query.data!.tickets.map((t) => (
              <li key={t.id}>
                <Link to={`/support/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-canvas">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{t.subject}</p>
                    <p className="mt-0.5 text-xs text-ink-subtle">
                      #{t.id} · {TICKET_CATEGORY_LABELS[t.category]} · opened {formatDate(t.createdAt)} · updated {timeAgo(t.updatedAt)}
                    </p>
                  </div>
                  {t.route && <RouteBadge number={t.route.number} size="sm" />}
                  <TicketStatusBadge status={t.status} />
                  <ChevronRight className="size-4 text-ink-subtle" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <NewTicketDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o && journeyParam) setParams({}, { replace: true });
        }}
        journeyId={journeyParam}
      />
    </Page>
  );
}

function NewTicketDialog({ open, onOpenChange, journeyId }: { open: boolean; onOpenChange: (o: boolean) => void; journeyId: number | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm({ subject: '', description: '', category: 'COMPLAINT' as TicketCategory, journeyId: journeyId ? String(journeyId) : '' });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const journeys = useQuery({
    queryKey: ['journeys', 'history'],
    queryFn: async () => (await api.get<{ journeys: Journey[] }>('/journeys?limit=50')).journeys,
    enabled: open,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const payload = {
      subject: form.values.subject,
      description: form.values.description,
      category: form.values.category,
      journeyId: form.values.journeyId ? Number(form.values.journeyId) : null,
    };
    const input = form.validate(createTicketSchema, payload);
    if (!input) return;
    setBusy(true);
    try {
      const res = await api.post<{ ticket: TicketDetail }>('/support/tickets', input);
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Request sent. We will reply here.');
      onOpenChange(false);
      form.setValues({ subject: '', description: '', category: 'COMPLAINT', journeyId: '' });
      navigate(`/support/${res.ticket.id}`);
    } catch (err) {
      if (!form.applyServerError(err)) setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="New support request"
        description="Describe what happened. Linking a trip helps support see the alert details."
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" form="new-ticket" loading={busy}>
              Send request
            </Button>
          </>
        }
      >
        <form id="new-ticket" onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <Callout tone="error">{formError}</Callout>}
          <Field label="Type" error={form.errors.category}>
            <Select {...form.bind('category')}>
              {TICKET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {TICKET_CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" error={form.errors.subject}>
            <Input placeholder="e.g. Alert rang too late near University Gate" {...form.bind('subject')} />
          </Field>
          <Field label="What happened?" error={form.errors.description} hint="Include the time, route and stop if you can.">
            <Textarea rows={5} {...form.bind('description')} />
          </Field>
          <Field label="Related trip" optional error={form.errors.journeyId}>
            <Select {...form.bind('journeyId')}>
              <option value="">No specific trip</option>
              {(journeys.data ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {formatDate(j.startedAt)} · {j.routeNumber} to {j.destinationName}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
