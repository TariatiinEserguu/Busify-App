import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { Dialog as D } from 'radix-ui';
import {
  BusFront,
  ChartColumn,
  CornerUpRight,
  FlaskConical,
  Home,
  Inbox,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Map as MapIcon,
  MapPin,
  Megaphone,
  Menu,
  Route as RouteIcon,
  ScrollText,
  Settings,
  SlidersHorizontal,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { PermissionKey } from '@busify/shared';
import { Avatar, label } from '@/components/domain';
import { Segmented } from '@/components/ui/controls';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePublicConfig } from '@/features/appData';
import { useJourney } from '@/features/journey/JourneyProvider';
import { api } from '@/lib/api';
import { LANGS, useI18n, type Lang } from '@/lib/i18n';
import type { TicketListPayload } from '@/lib/types';
import { cn } from '@/lib/utils';
import { NotificationsBell } from './NotificationsBell';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  end?: boolean;
  /** Extra paths that also mark this item active. */
  also?: RegExp;
  badge?: number;
}

/** Staff are support agents and administrators; everybody else gets the passenger app. */
function useIsStaff() {
  const { user } = useAuth();
  return user?.role === 'SUPPORT' || user?.role === 'ADMIN';
}

function useStaffCounts(enabled: boolean) {
  const { data } = useQuery({
    queryKey: ['tickets', 'nav-counts'],
    queryFn: () => api.get<TicketListPayload>('/support/tickets?pageSize=1'),
    enabled,
    refetchInterval: 60_000,
  });
  return { open: data?.counts.OPEN ?? 0, escalated: data?.escalatedOpen ?? 0 };
}

function useStaffNav(): Array<{ heading?: string; items: NavItem[] }> {
  const { user, can } = useAuth();
  const { t } = useI18n();
  const counts = useStaffCounts(can('tickets:manage'));
  const desk: NavItem[] = [
    { to: '/desk', label: t('Complaints'), icon: Inbox, permission: 'tickets:manage', end: true, also: /^\/desk\/tickets\//, badge: counts.open },
    { to: '/desk/escalated', label: t('Escalated'), icon: CornerUpRight, permission: 'tickets:manage', badge: counts.escalated },
    { to: '/desk/reports', label: t('Report'), icon: ChartColumn, permission: 'support:reports' },
  ];
  if (user?.role !== 'ADMIN') return [{ items: desk }];
  return [
    {
      items: [
        { to: '/admin', label: t('Dashboard'), icon: LayoutGrid, permission: 'reports:view', end: true, badge: counts.escalated },
        { to: '/admin/routes', label: t('Routes & stops'), icon: RouteIcon, permission: 'routes:manage', also: /^\/admin\/stops/ },
        { to: '/admin/users', label: t('Users'), icon: Users, permission: 'users:manage' },
        { to: '/admin/settings', label: t('Settings'), icon: SlidersHorizontal, permission: 'settings:manage' },
      ],
    },
    {
      heading: t('More'),
      items: [
        { to: '/desk', label: t('Complaints'), icon: Inbox, permission: 'tickets:manage', also: /^\/desk\/(tickets|escalated)/, badge: counts.open },
        { to: '/admin/reports', label: t('Statistics'), icon: ChartColumn, permission: 'reports:view' },
        { to: '/admin/activity', label: t('Activity & errors'), icon: ScrollText, permission: 'audit:view' },
      ],
    },
  ];
}

function usePassengerTabs(): NavItem[] {
  const { t } = useI18n();
  return [
    { to: '/', label: t('Home'), icon: Home, end: true, also: /^\/journey/ },
    { to: '/plan', label: t('Route'), icon: RouteIcon },
    { to: '/map', label: t('Map'), icon: MapIcon },
    { to: '/profile', label: t('Profile'), icon: User, also: /^\/(history|support|settings)/ },
  ];
}

function isActive(pathname: string, item: NavItem) {
  if (item.end ? pathname === item.to : pathname === item.to || pathname.startsWith(item.to + '/')) return true;
  return !!item.also?.test(pathname);
}

/** The amber bus tile and wordmark from the deck. */
export function Logo({ subtitle, onDark = true, className }: { subtitle?: string; onDark?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn('group flex items-center gap-2.5 rounded-xl', className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-400 text-brand-900 shadow-[0_6px_18px_-6px_rgb(255_194_51/0.7)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
        <BusFront className="size-5" strokeWidth={2.4} aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className={cn('block text-[17px] font-extrabold tracking-[0.06em]', onDark ? 'text-white' : 'text-ink')}>BUSIFY</span>
        {subtitle && <span className={cn('block truncate text-[11px] font-medium', onDark ? 'text-white/70' : 'text-ink-subtle')}>{subtitle}</span>}
      </span>
    </Link>
  );
}

/** МН | EN toggle. */
export function LanguageSwitch({ tone = 'light', size = 'sm', className }: { tone?: 'light' | 'dark'; size?: 'sm' | 'md'; className?: string }) {
  const { lang, setLang, t } = useI18n();
  return (
    <Segmented<Lang>
      value={lang}
      onChange={setLang}
      tone={tone}
      size={size}
      className={className}
      ariaLabel={t('Language')}
      options={LANGS.map((l) => ({ value: l.code, label: l.short, title: l.label }))}
    />
  );
}

function SidebarNav({ groups, onNavigate }: { groups: Array<{ heading?: string; items: NavItem[] }>; onNavigate?: () => void }) {
  const { can } = useAuth();
  const { pathname } = useLocation();
  const { t } = useI18n();
  return (
    <nav aria-label={t('Main')} className="space-y-6">
      {groups.map((group, gi) => {
        const items = group.items.filter((i) => !i.permission || can(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={gi}>
            {group.heading && <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/40">{group.heading}</p>}
            <ul className="space-y-1">
              {items.map((item) => {
                const active = isActive(pathname, item);
                return (
                  <li key={item.to + item.label}>
                    <Link
                      to={item.to}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition-all duration-200',
                        active ? 'bg-accent-400 text-brand-900 shadow-[0_8px_20px_-10px_rgb(255_194_51/0.8)]' : 'text-white/90 hover:bg-white/8 hover:text-white',
                      )}
                    >
                      <item.icon className={cn('size-[18px] shrink-0 transition-transform duration-200', !active && 'group-hover:translate-x-0.5')} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {!!item.badge && (
                        <span
                          className={cn(
                            'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular animate-pop-in',
                            active ? 'bg-brand-900 text-white' : 'bg-accent-400 text-brand-900',
                          )}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function UserFooter() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/8" aria-label={t('Account menu')}>
          <Avatar name={user.name} size="sm" tone="ink" className="size-9" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
            <span className="block truncate text-xs text-white/60">{label.role(user.role)}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings /> {t('My settings')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut /> {t('Sign out')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DemoChip({ className }: { className?: string }) {
  const { user } = useAuth();
  const { t } = useI18n();
  if (!user?.isDemoAccount) return null;
  return (
    <p
      className={cn('flex items-center gap-1.5 rounded-lg bg-violet-500/15 px-2.5 py-1.5 text-[11px] font-medium text-violet-200', className)}
      title={t('Demo accounts only work while DEMO_MODE=true and must not be used in a real deployment.')}
    >
      <FlaskConical className="size-3.5 shrink-0" aria-hidden /> {t('Demo account')}
    </p>
  );
}

function Sidebar({ groups, subtitle, footerExtra }: { groups: Array<{ heading?: string; items: NavItem[] }>; subtitle: string; footerExtra?: ReactNode }) {
  const { t } = useI18n();
  return (
    <aside className="no-print sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col bg-brand-900 lg:flex">
      <div className="flex items-start justify-between gap-2 px-5 pb-6 pt-6">
        <Logo subtitle={subtitle} />
        <NotificationsBell tone="dark" className="-mr-2 mt-0.5" />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3">
        <SidebarNav groups={groups} />
      </div>
      <div className="space-y-3 border-t border-white/10 px-3 pb-4 pt-3">
        {footerExtra}
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-xs font-medium text-white/50">{t('Language')}</span>
          <LanguageSwitch tone="dark" />
        </div>
        <DemoChip className="mx-1" />
        <UserFooter />
      </div>
    </aside>
  );
}

function MobileStaffBar({ groups, subtitle }: { groups: Array<{ heading?: string; items: NavItem[] }>; subtitle: string }) {
  const [open, setOpen] = useState(false);
  const { t } = useI18n();
  return (
    <header className="no-print sticky top-0 z-[900] flex h-16 items-center gap-2 bg-brand-900 px-3 lg:hidden">
      <D.Root open={open} onOpenChange={setOpen}>
        <D.Trigger asChild>
          <button className="flex size-10 items-center justify-center rounded-xl text-white hover:bg-white/10" aria-label={t('Open menu')}>
            <Menu className="size-5" />
          </button>
        </D.Trigger>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-[1000] bg-brand-950/50 animate-fade-in" />
          <D.Content className="fixed inset-y-0 left-0 z-[1001] flex w-72 max-w-[85vw] flex-col bg-brand-900 shadow-2xl animate-[slide-in-left_320ms_var(--ease-out-soft)_both] focus:outline-none">
            <D.Title className="sr-only">{t('Menu')}</D.Title>
            <D.Description className="sr-only">{t('Main navigation')}</D.Description>
            <div className="flex items-center justify-between px-5 py-5">
              <Logo subtitle={subtitle} />
              <D.Close className="rounded-lg p-1.5 text-white/70 hover:bg-white/10" aria-label={t('Close menu')}>
                <X className="size-5" />
              </D.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3">
              <SidebarNav groups={groups} onNavigate={() => setOpen(false)} />
            </div>
            <div className="space-y-3 border-t border-white/10 px-3 pb-4 pt-3">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-medium text-white/50">{t('Language')}</span>
                <LanguageSwitch tone="dark" />
              </div>
              <UserFooter />
            </div>
          </D.Content>
        </D.Portal>
      </D.Root>
      <Logo subtitle={subtitle} />
      <div className="ml-auto flex items-center gap-1">
        <NotificationsBell tone="dark" />
      </div>
    </header>
  );
}

/** Bottom tab bar of the passenger app, with a sliding amber indicator. */
function PassengerTabBar({ tabs }: { tabs: NavItem[] }) {
  const { pathname } = useLocation();
  const { t } = useI18n();
  const index = tabs.findIndex((tab) => isActive(pathname, tab));
  return (
    <nav
      aria-label={t('Main')}
      className="no-print fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[950] mx-auto max-w-md animate-sheet-up lg:hidden"
    >
      <div className="relative grid grid-cols-4 rounded-[28px] bg-surface/95 p-2 shadow-float backdrop-blur">
        {index >= 0 && (
          <span
            aria-hidden
            className="absolute bottom-2 top-2 rounded-[20px] bg-accent-400 shadow-[0_8px_18px_-8px_rgb(255_194_51/0.9)] transition-transform duration-500 ease-[var(--ease-spring)]"
            style={{ left: 8, width: 'calc((100% - 16px) / 4)', transform: `translateX(${index * 100}%)` }}
          />
        )}
        {tabs.map((tab, i) => (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={i === index ? 'page' : undefined}
            className={cn(
              'press relative z-10 flex flex-col items-center gap-1 rounded-[20px] py-2 text-[11px] font-semibold transition-colors duration-300',
              i === index ? 'text-brand-900' : 'text-ink-muted hover:text-ink',
            )}
          >
            <tab.icon className={cn('size-[22px] transition-transform duration-300', i === index && '-translate-y-px scale-110')} strokeWidth={i === index ? 2.4 : 2} aria-hidden />
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** Floating "journey in progress" pill shown outside the live journey page. */
function JourneyPill({ className }: { className?: string }) {
  const { journey, live } = useJourney();
  const location = useLocation();
  const { t, formatDistance } = useI18n();
  if (!journey || location.pathname === '/journey' || location.pathname === '/') return null;
  const distance = live.distanceM ?? journey.lastDistanceM;
  return (
    <Link
      to="/journey"
      className={cn(
        'lift flex items-center gap-2.5 rounded-2xl bg-brand-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-float animate-slide-up',
        className,
      )}
    >
      <span className="relative flex size-2.5">
        <span className={cn('absolute inline-flex size-full rounded-full bg-emerald-400 opacity-70', journey.status === 'ACTIVE' && 'animate-ping')} />
        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
      </span>
      <span className="min-w-0 flex-1 truncate">
        {journey.status === 'PAUSED' ? t('Paused') : t('Active journey')} · {journey.destinationName}
      </span>
      {distance != null && <span className="rounded-full bg-accent-400 px-2 py-0.5 text-brand-900 tabular">{formatDistance(distance)}</span>}
    </Link>
  );
}

function AnnouncementBar() {
  const { config } = usePublicConfig();
  const { t } = useI18n();
  const [hidden, setHidden] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('busify.hiddenAnnouncement');
    } catch {
      return null;
    }
  });
  if (!config.announcement || hidden === config.announcement) return null;
  return (
    <div className="no-print flex items-center gap-3 bg-accent-100 px-4 py-2 text-sm text-brand-900 animate-fade-in">
      <Megaphone className="size-4 shrink-0 text-accent-700" aria-hidden />
      <p className="min-w-0 flex-1">{config.announcement}</p>
      <button
        className="rounded-lg p-1 hover:bg-accent-200"
        aria-label={t('Hide announcement')}
        onClick={() => {
          setHidden(config.announcement);
          try {
            sessionStorage.setItem('busify.hiddenAnnouncement', config.announcement);
          } catch {
            // ignore
          }
        }}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

/** Page-level key so a route change animates in, but switching tickets inside one view does not. */
function animationKey(pathname: string) {
  return pathname.replace(/\/(tickets\/)?\d+$/, '').replace(/^\/desk\/tickets$/, '/desk');
}

const PASSENGER_TAB_PATHS = /^\/(|map|profile|history)$/;

export function AppShell({ children }: { children?: ReactNode }) {
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const { user } = useAuth();
  const { t } = useI18n();
  const staff = useIsStaff();
  const staffGroups = useStaffNav();
  const tabs = usePassengerTabs();
  const key = animationKey(pathname);

  // On desktop <main> is the scroll container; start every page at the top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [key]);

  const subtitle = user?.role === 'ADMIN' ? t('System admin') : user?.role === 'SUPPORT' ? t('Customer service') : t('Never miss your stop');
  const showTabs = !staff && PASSENGER_TAB_PATHS.test(pathname);
  const passengerGroups = [{ items: [...tabs, { to: '/support', label: t('Help & feedback'), icon: LifeBuoy }, { to: '/history', label: t('Trip history'), icon: MapPin }] }];

  return (
    <div className="flex min-h-dvh">
      <Sidebar
        groups={staff ? staffGroups : passengerGroups}
        subtitle={subtitle}
        footerExtra={!staff ? <JourneyPill /> : undefined}
      />
      <div className="flex min-w-0 flex-1 flex-col lg:h-dvh">
        {staff && <MobileStaffBar groups={staffGroups} subtitle={subtitle} />}
        <AnnouncementBar />
        <main ref={mainRef} className={cn('flex min-h-0 flex-1 flex-col lg:overflow-y-auto', showTabs && 'pb-28 lg:pb-0')}>
          <div key={key} className="flex min-h-0 flex-1 flex-col animate-page-in">
            {children ?? <Outlet />}
          </div>
        </main>
      </div>
      {!staff && (
        <>
          <div className={cn('no-print fixed inset-x-3 z-[940] mx-auto max-w-md lg:hidden', showTabs ? 'bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+84px)]' : 'bottom-4')}>
            <JourneyPill />
          </div>
          {showTabs && <PassengerTabBar tabs={tabs} />}
        </>
      )}
    </div>
  );
}

/** Standard padded page body for list and form pages. */
export function Page({ children, className, width = 'default' }: { children: ReactNode; className?: string; width?: 'default' | 'narrow' | 'wide' | 'full' }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:py-8',
        width === 'narrow' ? 'max-w-3xl' : width === 'wide' ? 'max-w-[1240px]' : width === 'full' ? 'max-w-none' : 'max-w-6xl',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Phone-width column for the passenger screens (centred on larger displays). */
export function PassengerPage({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[480px] px-5 pb-8 pt-6 lg:pt-10', className)}>{children}</div>;
}
