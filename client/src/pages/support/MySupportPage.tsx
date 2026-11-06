import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, LifeBuoy } from 'lucide-react';
import { createTicketSchema, type TicketCategory } from '@busify/shared';
import { label, ticketStatusText } from '@/components/domain';
import { PassengerPage } from '@/components/layout/AppShell';
import { Chip } from '@/components/ui/controls';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Select, Textarea } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { t as tr, useI18n } from '@/lib/i18n';
import { useForm } from '@/lib/form';
import type { Journey, TicketDetail, TicketListPayload, TicketSummary } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';

/** Quick topics from the deck, each mapped to a ticket category. */
const TOPICS: Array<{ id: string; label: string; category: TicketCategory }> = [
  { id: 'alert', label: 'Alert did not come', category: 'APP_PROBLEM' },
  { id: 'stop', label: 'Wrong stop location', category: 'ROUTE_DATA' },
  { id: 'bus', label: 'Bus, driver', category: 'COMPLAINT' },
  { id: 'app', label: 'App not working', category: 'APP_PROBLEM' },
  { id: 'idea', label: 'Suggestion', category: 'FEEDBACK' },
];

/** Progress steps shown under each request. */
function stage(tk: TicketSummary) {
  if (tk.status === 'RESOLVED') return 4;
  if (tk.escalated) return 3;
  if (tk.status === 'IN_PROGRESS') return 2;
  return 1;
}

export function MySupportPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const query = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => api.get<TicketListPayload>('/support/tickets?pageSize=100'),
  });

  return (
    <PassengerPage>
      <header className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="press flex size-11 items-center justify-center rounded-2xl bg-surface shadow-card" aria-label={t('Back')}>
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h1 className="text-[24px] font-semibold tracking-tight">{t('Feedback & complaints')}</h1>
      </header>

      <NewRequestCard />

      <h2 className="eyebrow mt-8 px-1">{t('My requests')}</h2>
      {query.isLoading ? (
        <Skeleton className="mt-3 h-40 rounded-card" />
      ) : query.isError ? (
        <Callout tone="error" className="mt-3" title={t('Could not load your requests')}>
          {errorMessage(query.error)}
        </Callout>
      ) : query.data!.tickets.length === 0 ? (
        <div className="card mt-3">
          <EmptyState icon={LifeBuoy} title={t('No support requests yet')}>
            {t('If an alert came too late, a stop is in the wrong place or anything else is off, let us know.')}
          </EmptyState>
        </div>
      ) : (
        <ul className="stagger mt-3 space-y-3">
          {query.data!.tickets.map((tk, i) => {
            const st = stage(tk);
            return (
              <li key={tk.id} style={{ ['--i' as string]: i }}>
                <Link to={`/support/${tk.id}`} className="lift card block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold leading-snug">
                        #BF-{tk.id} · {tk.subject}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-subtle">
                        {formatTime(tk.createdAt)} · {tk.route ? `${tk.route.number} · ` : ''}
                        {label.ticketCategory(tk.category)}
                      </p>
                    </div>
                    <span className={cn('shrink-0 rounded-lg px-2 py-1 text-xs font-bold', tk.status === 'RESOLVED' ? 'bg-ok-soft text-ok' : 'bg-sunken', ticketStatusText(tk.status))}>
                      {label.ticketStatus(tk.status)}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-4 gap-1.5">
                    {[t('Sent'), t('Registered'), t('Sent to admin'), t('Resolved')].map((name, k) => (
                      <div key={name}>
                        <div className="h-1.5 overflow-hidden rounded-full bg-line">
                          <div className={cn('h-full rounded-full bg-ok transition-[width] duration-700', k < st ? 'w-full' : 'w-0')} style={{ transitionDelay: `${k * 120}ms` }} />
                        </div>
                        <p className={cn('mt-1.5 text-[11px] leading-tight', k < st ? 'font-semibold text-ink' : 'text-ink-subtle')}>{name}</p>
                      </div>
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PassengerPage>
  );
}

function NewRequestCard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const journeyParam = params.get('journey') ?? '';
  const initialTopic = TOPICS.find((x) => x.id === params.get('topic')) ?? null;
  const [topic, setTopic] = useState(initialTopic?.id ?? null);
  const form = useForm({ description: '', journeyId: journeyParam });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const journeys = useQuery({
    queryKey: ['journeys', 'history'],
    queryFn: async () => (await api.get<{ journeys: Journey[] }>('/journeys?limit=50')).journeys,
  });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const chosen = TOPICS.find((x) => x.id === topic);
    if (!chosen) return setFormError(t('Choose what happened.'));
    const j = journeys.data?.find((x) => String(x.id) === form.values.journeyId);
    const payload = {
      subject: j ? `${tr(chosen.label)} · ${j.routeNumber} → ${j.destinationName}` : tr(chosen.label),
      description: form.values.description,
      category: chosen.category,
      journeyId: form.values.journeyId ? Number(form.values.journeyId) : null,
    };
    const input = form.validate(createTicketSchema, payload);
    if (!input) return;
    setBusy(true);
    try {
      const res = await api.post<{ ticket: TicketDetail }>('/support/tickets', input);
      await queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success(t('Request sent. We will reply here.'));
      navigate(`/support/${res.ticket.id}`);
    } catch (err) {
      if (!form.applyServerError(err)) setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="card mt-5 space-y-4 p-4 animate-slide-up">
      {formError && <Callout tone="error">{formError}</Callout>}
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-muted">{t('What happened?')}</p>
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((x) => (
            <Chip key={x.id} active={topic === x.id} onClick={() => setTopic(x.id)} className="h-9 px-3.5 text-[13px]">
              {t(x.label)}
            </Chip>
          ))}
        </div>
      </div>
      <label className="block rounded-xl bg-sunken px-3 py-2">
        <span className="block text-xs font-semibold text-ink-muted">{t('Related trip')}</span>
        <Select {...form.bind('journeyId')} className="h-8 border-0 bg-transparent px-0 font-bold hover:border-0 focus:ring-0">
          <option value="">{t('No specific trip')}</option>
          {(journeys.data ?? []).map((j) => (
            <option key={j.id} value={j.id}>
              {j.routeNumber} → {j.destinationName} · {formatTime(j.startedAt)}
            </option>
          ))}
        </Select>
      </label>
      <div>
        <label htmlFor="ticket-details" className="mb-1.5 block text-sm font-semibold text-ink-muted">
          {t('Details')}
        </label>
        <Textarea id="ticket-details" rows={4} aria-invalid={!!form.errors.description || undefined} placeholder={t('Include the time, route and stop if you can.')} {...form.bind('description')} />
        {(form.errors.description || form.errors.subject) && <p className="mt-1 text-xs font-medium text-bad">{t(form.errors.description ?? form.errors.subject)}</p>}
      </div>
      <button type="submit" disabled={busy} className="press h-14 w-full rounded-2xl bg-brand-900 text-base font-bold text-white transition-colors hover:bg-brand-700 disabled:opacity-60">
        {busy ? t('Sending…') : t('Send')}
      </button>
    </form>
  );
}
