import { useNavigate, Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Bell, ChevronRight, Clock, Globe, Lock, MessageCircle, type LucideIcon } from 'lucide-react';
import { Avatar, label } from '@/components/domain';
import { LanguageSwitch, PassengerPage } from '@/components/layout/AppShell';
import { useUserSettings } from '@/features/appData';
import { useAuth } from '@/features/auth/AuthProvider';
import { api } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import type { Journey, TicketListPayload } from '@/lib/types';

/** "Профайл": account card, trip statistics and the settings menu. */
export function ProfilePage() {
  const { user, logout, can } = useAuth();
  const { t, meters } = useI18n();
  const navigate = useNavigate();
  const { settings } = useUserSettings(can('journeys:use'));
  const trips = useQuery({
    queryKey: ['journeys', 'history'],
    queryFn: async () => (await api.get<{ journeys: Journey[] }>('/journeys?limit=50')).journeys,
    enabled: can('journeys:use'),
  });
  const tickets = useQuery({
    queryKey: ['tickets', 'mine'],
    queryFn: () => api.get<TicketListPayload>('/support/tickets?pageSize=100'),
    enabled: can('tickets:create'),
  });
  if (!user) return null;
  const list = trips.data ?? [];
  const finished = list.filter((j) => j.status === 'COMPLETED');
  const onTime = finished.filter((j) => j.alertTriggeredAt).length;
  const openTickets = (tickets.data?.tickets ?? []).filter((x) => x.status !== 'RESOLVED').length;

  const items: Array<{ to: string; icon: LucideIcon; title: string; sub: string; badge?: number }> = [
    { to: '/history', icon: Clock, title: t('Trip history'), sub: t('Past trips, alerts received') },
    { to: '/support', icon: MessageCircle, title: t('Help & complaints'), sub: t('Send feedback, see replies'), badge: openTickets },
    { to: '/settings', icon: Bell, title: t('Alert settings'), sub: t('Default {d} · sound, vibration', { d: meters(settings.alertRadiusM) }) },
    { to: '/settings#password', icon: Lock, title: t('Change password'), sub: '' },
  ];

  return (
    <PassengerPage>
      <h1 className="text-[26px] font-semibold tracking-tight animate-slide-up">{t('Profile')}</h1>
      <section className="card-ink mt-4 flex items-center gap-4 p-5 animate-slide-up [animation-delay:60ms]">
        <Avatar name={user.name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">{user.name}</p>
          <p className="truncate text-sm text-white/70">{user.phone || user.email}</p>
          {user.role !== 'PASSENGER' && <p className="text-xs text-accent-300">{label.role(user.role)}</p>}
        </div>
        <Link to="/settings#account" className="press rounded-xl bg-accent-400 px-4 py-2 text-sm font-bold text-brand-900 hover:bg-accent-300">
          {t('Edit')}
        </Link>
      </section>

      {can('journeys:use') && (
        <div className="stagger mt-4 grid grid-cols-2 gap-3">
          <div className="card px-4 py-3" style={{ ['--i' as string]: 1 }}>
            <p className="text-xs font-medium text-ink-muted">{t('Total trips')}</p>
            <p className="mt-1 text-2xl font-extrabold tabular">{list.length}</p>
          </div>
          <div className="card px-4 py-3" style={{ ['--i' as string]: 2 }}>
            <p className="text-xs font-medium text-ink-muted">{t('Never missed a stop')}</p>
            <p className="mt-1 text-2xl font-extrabold tabular">
              {onTime} / {finished.length}
            </p>
          </div>
        </div>
      )}

      <ul className="card stagger mt-4 divide-y divide-line overflow-hidden">
        {items.map((it, i) => (
          <li key={it.to} style={{ ['--i' as string]: i + 2 }}>
            <Link to={it.to} className="group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-canvas">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink">
                <it.icon className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{it.title}</span>
                {it.sub && <span className="block truncate text-xs text-ink-subtle">{it.sub}</span>}
              </span>
              {!!it.badge && <span className="flex size-6 items-center justify-center rounded-full bg-accent-400 text-xs font-bold text-brand-900">{it.badge}</span>}
              <ChevronRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-3 px-4 py-3" style={{ ['--i' as string]: 6 }}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sunken text-ink">
            <Globe className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 font-bold">{t('Language')}</span>
          <LanguageSwitch />
        </li>
      </ul>

      <button
        type="button"
        onClick={async () => {
          await logout();
          navigate('/login', { replace: true });
        }}
        className="press mt-5 h-14 w-full rounded-2xl border-[1.5px] border-bad bg-surface text-base font-bold text-bad transition-colors hover:bg-bad-soft"
      >
        {t('Sign out')}
      </button>
    </PassengerPage>
  );
}
