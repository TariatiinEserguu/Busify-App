import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertOctagon, ScrollText, Search } from 'lucide-react';
import { Page } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Panel, Table, Td, Th } from '@/components/ui/layout';
import { api, errorMessage, qs } from '@/lib/api';
import type { AuditLogEntry, ErrorLogEntry } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

const ENTITY_TYPES = ['route', 'stop', 'user', 'ticket', 'settings', 'system'];

function Pager({ page, total, pageSize, onPage }: { page: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
      <span className="text-ink-muted">Page {page} of {pages} · {total} entries</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

function AuditLogTab() {
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const params = { entityType, search: search.trim(), page, pageSize: 50 };
  const query = useQuery({
    queryKey: ['admin', 'audit', params],
    queryFn: () => api.get<{ logs: AuditLogEntry[]; total: number; page: number; pageSize: number }>(`/admin/audit-logs${qs(params)}`),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Select className="w-auto" value={entityType} onChange={(e) => { setEntityType(e.target.value); setPage(1); }} aria-label="Record type">
          <option value="">All record types</option>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
        </Select>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search the summary" className="pl-9" aria-label="Search activity" />
        </div>
      </div>
      <Panel className={cn(query.isFetching && !query.isLoading && 'opacity-80')}>
        {query.isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : query.isError ? (
          <div className="p-4"><Callout tone="error">{errorMessage(query.error)}</Callout></div>
        ) : query.data!.logs.length === 0 ? (
          <EmptyState icon={ScrollText} title="No activity matches" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-44">When</Th>
                <Th>What happened</Th>
                <Th className="hidden md:table-cell">Who</Th>
                <Th className="hidden lg:table-cell">Action</Th>
                <Th className="hidden xl:table-cell">IP address</Th>
              </tr>
            </thead>
            <tbody>
              {query.data!.logs.map((l) => (
                <tr key={l.id}>
                  <Td className="whitespace-nowrap text-ink-muted">{formatDateTime(l.createdAt)}</Td>
                  <Td>{l.summary}</Td>
                  <Td className="hidden text-ink-muted md:table-cell">{l.actor?.name ?? 'System'}</Td>
                  <Td className="hidden font-mono text-xs text-ink-subtle lg:table-cell">{l.action}</Td>
                  <Td className="hidden font-mono text-xs text-ink-subtle xl:table-cell">{l.ipAddress ?? '—'}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {query.data && <Pager page={page} total={query.data.total} pageSize={query.data.pageSize} onPage={setPage} />}
      </Panel>
    </>
  );
}

function ErrorLogTab() {
  const [source, setSource] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const params = { source, page, pageSize: 50 };
  const query = useQuery({
    queryKey: ['admin', 'errors', params],
    queryFn: () => api.get<{ errors: ErrorLogEntry[]; total: number; page: number; pageSize: number }>(`/admin/errors${qs(params)}`),
    placeholderData: keepPreviousData,
  });
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Select className="w-auto" value={source} onChange={(e) => { setSource(e.target.value); setPage(1); }} aria-label="Error source">
          <option value="">Server and web app</option>
          <option value="SERVER">Server only</option>
          <option value="CLIENT">Web app only (GPS, map tiles, scripts)</option>
        </Select>
      </div>
      <Panel>
        {query.isLoading ? (
          <Skeleton className="m-4 h-40" />
        ) : query.isError ? (
          <div className="p-4"><Callout tone="error">{errorMessage(query.error)}</Callout></div>
        ) : query.data!.errors.length === 0 ? (
          <EmptyState icon={AlertOctagon} title="No errors recorded">Unexpected server errors and problems reported by browsers appear here.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {query.data!.errors.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <button type="button" className="flex w-full items-start gap-3 text-left" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                  <Badge tone={e.source === 'SERVER' ? 'danger' : 'warning'}>{e.source === 'SERVER' ? 'Server' : 'Web app'}</Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{e.message}</span>
                    <span className="block text-xs text-ink-subtle">
                      {formatDateTime(e.createdAt)}
                      {e.method ? ` · ${e.method}` : ''}
                      {e.path ? ` ${e.path}` : ''}
                      {e.userId ? ` · user ${e.userId}` : ''}
                    </span>
                  </span>
                </button>
                {open === e.id && (
                  <div className="mt-3 space-y-2 pl-1 text-xs">
                    {e.userAgent && <p className="text-ink-muted">Browser: {e.userAgent}</p>}
                    {e.context != null && <pre className="overflow-x-auto rounded-md bg-canvas p-3 font-mono text-[11px]">{JSON.stringify(e.context, null, 2)}</pre>}
                    {e.stack && <pre className="max-h-64 overflow-auto rounded-md bg-slate-900 p-3 font-mono text-[11px] text-slate-100">{e.stack}</pre>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {query.data && <Pager page={page} total={query.data.total} pageSize={query.data.pageSize} onPage={setPage} />}
      </Panel>
    </>
  );
}

export default function AdminActivityPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'errors' ? 'errors' : 'audit';
  return (
    <Page width="wide">
      <PageHeader title="Activity & errors" description="The audit trail of administrative and support actions, and the error log for troubleshooting." />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'errors' ? { tab: 'errors' } : {}, { replace: true })}>
        <TabsList className="mb-4">
          <TabsTrigger value="audit"><ScrollText aria-hidden /> Audit log</TabsTrigger>
          <TabsTrigger value="errors"><AlertOctagon aria-hidden /> Error log</TabsTrigger>
        </TabsList>
        <TabsContent value="audit"><AuditLogTab /></TabsContent>
        <TabsContent value="errors"><ErrorLogTab /></TabsContent>
      </Tabs>
    </Page>
  );
}
