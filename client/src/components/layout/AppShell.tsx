import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { Dialog as D } from 'radix-ui';
import {
  Bus,
  ChartColumn,
  ClipboardList,
  History,
  Inbox,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MapPin,
  MapPinned,
  Megaphone,
  Menu,
  Route as RouteIcon,
  ScrollText,
  Settings,
  SlidersHorizontal,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { formatDistance, type PermissionKey } from '@busify/shared';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePublicConfig } from '@/features/appData';
import { useJourney } from '@/features/journey/JourneyProvider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menu';
import { cn, initials } from '@/lib/utils';
import { NotificationsBell } from './NotificationsBell';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  end?: boolean;
}

const NAV: Array<{ heading: string; items: NavItem[] }> = [
  {
    heading: 'Travel',
    items: [
      { to: '/', label: 'Journey', icon: MapPinned, end: true, permission: 'journeys:use' },
      { to: '/history', label: 'My trips', icon: History, permission: 'journeys:use' },
      { to: '/support', label: 'Help & feedback', icon: LifeBuoy, permission: 'tickets:create' },
    ],
  },
  {
    heading: 'Support desk',
    items: [
      { to: '/desk', label: 'Tickets', icon: Inbox, permission: 'tickets:manage', end: true },
      { to: '/desk/reports', label: 'Resolved report', icon: ClipboardList, permission: 'support:reports' },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, permission: 'reports:view', end: true },
      { to: '/admin/routes', label: 'Routes', icon: RouteIcon, permission: 'routes:manage' },
      { to: '/admin/stops', label: 'Stops', icon: MapPin, permission: 'stops:manage' },
      { to: '/admin/users', label: 'Users', icon: Users, permission: 'users:manage' },
      { to: '/admin/reports', label: 'Reports', icon: ChartColumn, permission: 'reports:view' },
      { to: '/admin/activity', label: 'Activity & errors', icon: ScrollText, permission: 'audit:view' },
      { to: '/admin/settings', label: 'System settings', icon: SlidersHorizontal, permission: 'settings:manage' },
    ],
  },
];

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-md font-semibold tracking-tight text-ink">
      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-700 text-white">
        <Bus className="size-[18px]" aria-hidden />
      </span>
      <span className="text-[17px]">BUSIFY</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV.map((group) => {
        const items = group.items.filter((i) => !i.permission || can(i.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.heading}>
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">{group.heading}</p>
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
                      )
                    }
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Small "tracking" pill shown on every page while a journey runs. */
function JourneyPill({ className }: { className?: string }) {
  const { journey, live } = useJourney();
  const location = useLocation();
  if (!journey || location.pathname === '/') return null;
  const distance = live.distanceM ?? journey.lastDistanceM;
  return (
    <Link
      to="/"
      className={cn(
        'flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-medium text-brand-900 hover:bg-brand-100',
        className,
      )}
    >
      <span className="relative flex size-2">
        <span className={cn('absolute inline-flex size-full rounded-full bg-brand-500 opacity-60', journey.status === 'ACTIVE' && 'animate-ping')} />
        <span className="relative inline-flex size-2 rounded-full bg-brand-600" />
      </span>
      <span className="min-w-0 truncate">
        {journey.status === 'PAUSED' ? 'Paused' : 'Tracking'} · {journey.destinationName}
        {distance != null && ` · ${formatDistance(distance)}`}
      </span>
    </Link>
  );
}

function UserMenu({ compact }: { compact?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2.5 rounded-lg text-left hover:bg-slate-100',
            compact ? 'p-1' : 'w-full px-2 py-2',
          )}
          aria-label="Account menu"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {initials(user.name)}
          </span>
          {!compact && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
              <span className="block truncate text-xs text-ink-subtle">{user.roleLabel}</span>
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? 'end' : 'start'} side={compact ? 'bottom' : 'top'}>
        <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/settings')}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Banners() {
  const { user } = useAuth();
  const { config } = usePublicConfig();
  const [hidden, setHidden] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem('busify.hiddenAnnouncement');
    } catch {
      return null;
    }
  });
  const showAnnouncement = config.announcement && hidden !== config.announcement;
  return (
    <>
      {showAnnouncement && (
        <div className="flex items-center gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2 text-sm text-brand-950">
          <Megaphone className="size-4 shrink-0 text-brand-700" aria-hidden />
          <p className="min-w-0 flex-1">{config.announcement}</p>
          <button
            className="rounded p-1 text-brand-800 hover:bg-brand-100"
            aria-label="Hide announcement"
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
      )}
      {user?.isDemoAccount && (
        <div className="border-b border-violet-200 bg-violet-50 px-4 py-1.5 text-xs text-violet-900">
          You are signed in with a <strong>demonstration account</strong>. Demo accounts only work while DEMO_MODE=true
          and must not be used in a real deployment.
        </div>
      )}
    </>
  );
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-15 items-center justify-between px-4">
          <Logo />
          <NotificationsBell />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          <NavList />
        </div>
        <div className="space-y-2 border-t border-line p-2">
          <JourneyPill />
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium',
                isActive ? 'bg-brand-50 text-brand-800' : 'text-ink-muted hover:bg-slate-100 hover:text-ink',
              )
            }
          >
            <Settings className="size-4" aria-hidden /> Settings
          </NavLink>
          <UserMenu />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-[900] flex h-14 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur lg:hidden">
          <D.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <D.Trigger asChild>
              <button className="flex size-9 items-center justify-center rounded-lg text-ink hover:bg-slate-100" aria-label="Open menu">
                <Menu className="size-5" />
              </button>
            </D.Trigger>
            <D.Portal>
              <D.Overlay className="fixed inset-0 z-[1000] bg-slate-950/40 animate-fade-in" />
              <D.Content className="fixed inset-y-0 left-0 z-[1001] flex w-72 max-w-[85vw] flex-col bg-surface shadow-2xl animate-fade-in focus:outline-none">
                <D.Title className="sr-only">Menu</D.Title>
                <D.Description className="sr-only">Main navigation</D.Description>
                <div className="flex h-14 items-center justify-between px-4">
                  <Logo />
                  <D.Close className="rounded-md p-1.5 text-ink-subtle hover:bg-slate-100" aria-label="Close menu">
                    <X className="size-5" />
                  </D.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                  <NavList onNavigate={() => setMenuOpen(false)} />
                </div>
                <div className="border-t border-line p-2">
                  <NavLink
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-slate-100"
                  >
                    <Settings className="size-4" aria-hidden /> Settings
                  </NavLink>
                </div>
              </D.Content>
            </D.Portal>
          </D.Root>
          <Logo />
          <div className="ml-auto flex items-center gap-1">
            <NotificationsBell />
            <UserMenu compact />
          </div>
        </header>
        <div className="lg:hidden">
          <JourneyPill className="m-2 mb-0" />
        </div>
        <Banners />
        <main className="flex min-h-0 flex-1 flex-col">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

/** Standard padded page body for list and form pages. */
export function Page({ children, className, width = 'default' }: { children: ReactNode; className?: string; width?: 'default' | 'narrow' | 'wide' }) {
  return (
    <div
      className={cn(
        'mx-auto w-full px-4 py-6 sm:px-6 lg:py-8',
        width === 'narrow' ? 'max-w-3xl' : width === 'wide' ? 'max-w-7xl' : 'max-w-6xl',
        className,
      )}
    >
      {children}
    </div>
  );
}
