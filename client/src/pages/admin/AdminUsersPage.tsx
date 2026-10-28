import { useState } from 'react';
import { Link } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy, KeyRound, Search, ShieldOff, UserCheck, Users } from 'lucide-react';
import { ROLE_LABELS, ROLES, TICKET_STATUS_LABELS, type RoleName, type TicketStatus, type UserStatus } from '@busify/shared';
import { Page } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Callout, EmptyState, Skeleton } from '@/components/ui/feedback';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { PageHeader, Panel, Table, Td, Th } from '@/components/ui/layout';
import { useAuth } from '@/features/auth/AuthProvider';
import { api, errorMessage, qs } from '@/lib/api';
import type { AdminUser, AuditLogEntry, Journey, User } from '@/lib/types';
import { formatDate, formatDateTime, timeAgo } from '@/lib/utils';
import { JourneyList } from '../passenger/HistoryPage';

interface UserDetailPayload {
  user: User & {
    updatedAt: string;
    settings: { alertRadiusM: number; soundEnabled: boolean; vibrationEnabled: boolean; notificationsEnabled: boolean } | null;
    journeyCount: number;
    ticketCount: number;
    activeSessions: number;
  };
  journeys: Journey[];
  tickets: Array<{ id: number; subject: string; status: TicketStatus; createdAt: string; escalated: boolean }>;
  activity: AuditLogEntry[];
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleName | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const params = { search: search.trim(), role, status, page, pageSize: 25 };
  const query = useQuery({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get<{ users: AdminUser[]; total: number; page: number; pageSize: number }>(`/admin/users${qs(params)}`),
    placeholderData: keepPreviousData,
  });
  const pages = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.pageSize)) : 1;

  return (
    <Page width="wide">
      <PageHeader title="Users" description="Registered passengers and staff. Passwords are never shown — only reset." />
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Name or email" className="pl-9" aria-label="Search users" />
        </div>
        <Select className="w-auto" value={role} onChange={(e) => { setRole(e.target.value as RoleName | ''); setPage(1); }} aria-label="Role">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={status} onChange={(e) => { setStatus(e.target.value as UserStatus | ''); setPage(1); }} aria-label="Account status">
          <option value="">Any status</option>
          <option value="ACTIVE">Active</option>
          <option value="SUSPENDED">Suspended</option>
        </Select>
      </div>

      <Panel>
        {query.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : query.isError ? (
          <div className="p-4">
            <Callout tone="error">{errorMessage(query.error)}</Callout>
          </div>
        ) : query.data!.users.length === 0 ? (
          <EmptyState icon={Users} title="No users match these filters" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th className="hidden md:table-cell">Trips</Th>
                <Th className="hidden md:table-cell">Tickets</Th>
                <Th className="hidden lg:table-cell">Last sign-in</Th>
                <Th className="hidden lg:table-cell">Joined</Th>
              </tr>
            </thead>
            <tbody>
              {query.data!.users.map((u) => (
                <tr key={u.id} className="cursor-pointer hover:bg-canvas" onClick={() => setSelected(u.id)}>
                  <Td>
                    <button type="button" className="text-left font-medium hover:underline" onClick={(e) => { e.stopPropagation(); setSelected(u.id); }}>
                      {u.name}
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
                      {u.email}
                      {u.isDemoAccount && <Badge tone="violet">Demo</Badge>}
                      {u.mustChangePassword && <Badge tone="warning">Temporary password</Badge>}
                    </div>
                  </Td>
                  <Td>{u.roleLabel}</Td>
                  <Td>{u.status === 'ACTIVE' ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge>}</Td>
                  <Td className="tabular hidden md:table-cell">{u.journeyCount}</Td>
                  <Td className="tabular hidden md:table-cell">{u.ticketCount}</Td>
                  <Td className="hidden text-ink-muted lg:table-cell">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</Td>
                  <Td className="hidden text-ink-muted lg:table-cell">{formatDate(u.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {query.data && query.data.total > query.data.pageSize && (
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm">
            <span className="text-ink-muted">Page {page} of {pages} · {query.data.total} users</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Panel>

      <UserDrawer userId={selected} onClose={() => setSelected(null)} />
    </Page>
  );
}

function UserDrawer({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [roleDraft, setRoleDraft] = useState<RoleName | null>(null);
  const query = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => api.get<UserDetailPayload>(`/admin/users/${userId}`),
    enabled: userId != null,
  });
  const update = useMutation({
    mutationFn: (body: { role?: RoleName; status?: UserStatus }) => api.patch<{ user: User }>(`/admin/users/${userId}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin'] });
      toast.success('User updated. They were signed out so the change applies immediately.');
    },
    onError: (err) => toast.error('Could not update the user', { description: errorMessage(err) }),
  });
  const u = query.data?.user;
  const self = u?.id === me?.id;

  return (
    <Dialog open={userId != null} onOpenChange={(o) => { if (!o) { onClose(); setTempPassword(null); setRoleDraft(null); } }}>
      <DialogContent variant="side" title={u?.name ?? 'User'} description={u?.email}>
        {query.isLoading || !u ? (
          <Skeleton className="h-60" />
        ) : (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-ink-subtle">Joined</dt><dd className="font-medium">{formatDate(u.createdAt)}</dd></div>
              <div><dt className="text-xs text-ink-subtle">Last sign-in</dt><dd className="font-medium">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never'}</dd></div>
              <div><dt className="text-xs text-ink-subtle">Trips / tickets</dt><dd className="font-medium">{u.journeyCount} / {u.ticketCount}</dd></div>
              <div><dt className="text-xs text-ink-subtle">Signed-in devices</dt><dd className="font-medium">{u.activeSessions}</dd></div>
              <div><dt className="text-xs text-ink-subtle">Alert distance</dt><dd className="font-medium">{u.settings ? `${u.settings.alertRadiusM} m` : 'Default'}</dd></div>
              <div><dt className="text-xs text-ink-subtle">Phone</dt><dd className="font-medium">{u.phone || '—'}</dd></div>
            </dl>

            {self ? (
              <Callout tone="info">This is your own account. Another administrator must change your role or status.</Callout>
            ) : (
              <section className="space-y-4 rounded-lg border border-line p-4">
                <div className="flex items-end gap-2">
                  <Field label="Role" className="flex-1" hint="Support agents handle tickets but cannot manage routes, users or settings.">
                    <Select value={roleDraft ?? u.role} disabled={update.isPending} onChange={(e) => setRoleDraft(e.target.value as RoleName)}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                      ))}
                    </Select>
                  </Field>
                  <ConfirmDialog
                    trigger={<Button variant="outline" disabled={!roleDraft || roleDraft === u.role} className="mb-[22px]">Apply</Button>}
                    title={`Make ${u.name} ${roleDraft ? ROLE_LABELS[roleDraft].toLowerCase() : ''}?`}
                    description="Their permissions change immediately and they are signed out on every device."
                    confirmLabel="Change role"
                    onConfirm={async () => {
                      await update.mutateAsync({ role: roleDraft! });
                      setRoleDraft(null);
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {u.status === 'ACTIVE' ? (
                    <ConfirmDialog
                      trigger={<Button variant="danger-outline" size="sm"><ShieldOff aria-hidden /> Suspend account</Button>}
                      title={`Suspend ${u.name}?`}
                      description="They are signed out everywhere, any running journey is ended, and they cannot sign in until reactivated."
                      confirmLabel="Suspend"
                      destructive
                      onConfirm={() => update.mutateAsync({ status: 'SUSPENDED' })}
                    />
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => update.mutate({ status: 'ACTIVE' })} loading={update.isPending}>
                      <UserCheck aria-hidden /> Reactivate account
                    </Button>
                  )}
                  <ConfirmDialog
                    trigger={<Button variant="outline" size="sm"><KeyRound aria-hidden /> Reset password</Button>}
                    title={`Reset the password of ${u.name}?`}
                    description="A one-time temporary password is generated and shown to you once. The user must choose a new password at next sign-in."
                    confirmLabel="Generate temporary password"
                    onConfirm={async () => {
                      try {
                        const res = await api.post<{ temporaryPassword: string }>(`/admin/users/${u.id}/reset-password`);
                        setTempPassword(res.temporaryPassword);
                        void queryClient.invalidateQueries({ queryKey: ['admin'] });
                      } catch (err) {
                        toast.error('Could not reset the password', { description: errorMessage(err) });
                      }
                    }}
                  />
                </div>
                {tempPassword && (
                  <Callout tone="warning" title="Temporary password (shown only once)">
                    <div className="mt-1 flex items-center gap-2">
                      <code className="rounded bg-white px-2 py-1 font-mono text-sm">{tempPassword}</code>
                      <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(tempPassword).then(() => toast.success('Copied'))}>
                        <Copy aria-hidden /> Copy
                      </Button>
                    </div>
                    Give it to the user privately. BUSIFY stores only a hash of it.
                  </Callout>
                )}
              </section>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold">Recent trips</h3>
              {query.data!.journeys.length === 0 ? (
                <p className="text-sm text-ink-muted">No trips yet.</p>
              ) : (
                <div className="-mx-5 border-y border-line"><JourneyList journeys={query.data!.journeys} /></div>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Support requests</h3>
              {query.data!.tickets.length === 0 ? (
                <p className="text-sm text-ink-muted">None.</p>
              ) : (
                <ul className="space-y-1.5 text-sm">
                  {query.data!.tickets.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <Link to={`/desk/tickets/${t.id}`} className="min-w-0 flex-1 truncate hover:underline">#{t.id} {t.subject}</Link>
                      <span className="text-xs text-ink-subtle">{TICKET_STATUS_LABELS[t.status]}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold">Account activity</h3>
              <ul className="space-y-2 text-xs">
                {query.data!.activity.map((a) => (
                  <li key={a.id} className="flex gap-2">
                    <span className="w-28 shrink-0 text-ink-subtle">{formatDateTime(a.createdAt)}</span>
                    <span className="min-w-0 text-ink-muted">{a.summary}{a.actor && a.actor.id !== u.id ? ` — by ${a.actor.name}` : ''}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
