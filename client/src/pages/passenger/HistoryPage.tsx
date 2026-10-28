import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { BellRing, FlaskConical, History, LifeBuoy } from 'lucide-react';
import { formatDistance } from '@busify/shared';
import { Page } from '@/components/layout/AppShell';
import { JourneyStatusBadge, RouteBadge } from '@/components/domain';
import { Button } from '@/components/ui/button';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { PageHeader, Panel } from '@/components/ui/layout';
import { api, errorMessage } from '@/lib/api';
import type { Journey } from '@/lib/types';
import { formatDate, formatDuration, formatTime } from '@/lib/utils';

const END_REASONS: Record<string, string> = {
  ARRIVED: 'Arrived',
  CANCELLED_BY_USER: 'Cancelled',
  REPLACED: 'Replaced by a new journey',
  ROUTE_REMOVED: 'Route removed by an administrator',
  ACCOUNT_SUSPENDED: 'Account suspended',
};

export function JourneyList({ journeys, showReport }: { journeys: Journey[]; showReport?: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {journeys.map((j) => (
        <li key={j.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
          <RouteBadge number={j.routeNumber} color={j.routeColor} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-ink">To {j.destinationName}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
              <span>
                {formatDate(j.startedAt)}, {formatTime(j.startedAt)}
              </span>
              <span>· {formatDuration(j.startedAt, j.endedAt)}</span>
              <span>· alert at {j.alertRadiusM} m</span>
              {j.endReason && END_REASONS[j.endReason] && <span>· {END_REASONS[j.endReason]}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {j.alertTriggeredAt && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-700" title="Stop alert was sent">
                <BellRing className="size-3.5" aria-hidden /> {j.alertDistanceM != null ? formatDistance(j.alertDistanceM) : 'Alerted'}
              </span>
            )}
            {j.usedSimulation && (
              <span className="inline-flex items-center gap-1 text-xs text-violet-700" title="Positions came from the simulator">
                <FlaskConical className="size-3.5" aria-hidden /> Simulated
              </span>
            )}
            <JourneyStatusBadge status={j.status} />
            {showReport && (
              <Button asChild size="sm" variant="ghost">
                <Link to={`/support?journey=${j.id}`}>Report a problem</Link>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function HistoryPage() {
  const query = useQuery({
    queryKey: ['journeys', 'history'],
    queryFn: async () => (await api.get<{ journeys: Journey[] }>('/journeys?limit=50')).journeys,
  });

  return (
    <Page width="narrow">
      <PageHeader title="My trips" description="Your recent journeys and whether the stop alert went off." />
      {query.isLoading ? (
        <Panel className="space-y-3 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </Panel>
      ) : query.isError ? (
        <Callout tone="error" title="Could not load your trips">
          {errorMessage(query.error)}
        </Callout>
      ) : query.data!.length === 0 ? (
        <Panel>
          <EmptyState icon={History} title="No trips yet" action={<Button asChild><Link to="/">Plan a journey</Link></Button>}>
            Your journeys appear here once you start tracking a trip.
          </EmptyState>
        </Panel>
      ) : (
        <Panel>
          <JourneyList journeys={query.data!} showReport />
        </Panel>
      )}
      <p className="mt-4 flex items-center gap-2 text-xs text-ink-subtle">
        <LifeBuoy className="size-3.5" aria-hidden /> Something went wrong on a trip? Use “Report a problem” so support can see the
        journey details.
      </p>
    </Page>
  );
}
