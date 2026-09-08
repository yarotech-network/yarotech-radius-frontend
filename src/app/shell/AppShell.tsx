import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Menu,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  X,
} from 'lucide-react';
import { STORAGE_KEYS } from '@/app/config/constants';
import type { NavGroup } from '@/app/navigation/navConfig';
import { flattenNavItems, mobilePrimaryItems, visibleGroups } from '@/app/navigation/navConfig';
import { prefetchRoute } from '@/app/navigation/prefetch';
import { useAuth } from '@/app/auth/useAuth';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utilities/cn';
import { BrandMark } from './BrandMark';
import { SidebarNav } from './SidebarNav';
import { UserMenu } from './UserMenu';
import { SidebarAccount } from './SidebarAccount';
import '@/styles/dashboard.css';

export interface AppShellProps {
  groups: NavGroup[];
  homePath: string;
  profilePath: string | null;
  /** Slot in the top bar (e.g. tenant switcher for platform staff). */
  topBarStart?: ReactNode;
  banner?: ReactNode;
  /** Extra items shown under the workspace name in the sidebar. */
  sidebarBadge?: ReactNode;
  /** Distinguishes platform administration from a tenant workspace. */
  accent?: 'default' | 'platform';
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === '1';
  } catch {
    return false;
  }
}

/**
 * Responsive shell:
 *  - ≥ lg: 264px sidebar (collapsible to a 72px rail, persisted) + top bar
 *  - md–lg: rail + top bar
 *  - < md: top bar + bottom nav (4 primary items + "More" opening a drawer with everything)
 */
export function AppShell({
  groups,
  homePath,
  profilePath,
  topBarStart,
  banner,
  sidebarBadge,
  accent = 'default',
}: AppShellProps) {
  const { principal } = useAuth();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerState, setDrawerState] = useState<{ open: boolean; path: string }>({
    open: false,
    path: location.pathname,
  });
  // The drawer closes automatically on navigation (derived, no effect needed).
  const drawerOpen = drawerState.open && drawerState.path === location.pathname;
  const setDrawerOpen = (open: boolean) => setDrawerState({ open, path: location.pathname });
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const drawerPanelRef = useRef<HTMLDivElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const restoreDrawerFocus = useRef(false);
  const visible = visibleGroups(groups, principal);
  const primary = mobilePrimaryItems(groups, principal);
  const activeItem = flattenNavItems(visible)
    .filter(
      (item) =>
        location.pathname === item.to || (!item.end && location.pathname.startsWith(`${item.to}/`)),
    )
    .sort((a, b) => b.to.length - a.to.length)[0];
  const workspaceLabel = accent === 'platform' ? 'Platform administration' : 'Tenant workspace';
  const workspaceName =
    principal?.kind === 'member'
      ? principal.tenantName
      : accent === 'platform'
        ? 'Platform console'
        : 'Assigned workspace';
  const WorkspaceIcon = accent === 'platform' ? ShieldCheck : Building2;

  // Drawer focus management: focus lands inside the drawer when it opens
  // and returns to its trigger when the user closes it. Navigation closes the
  // drawer without stealing focus from the newly opened page.
  useEffect(() => {
    if (drawerOpen) drawerCloseRef.current?.focus();
    else if (restoreDrawerFocus.current) {
      restoreDrawerFocus.current = false;
      (drawerTriggerRef.current ?? moreButtonRef.current)?.focus();
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || !window.matchMedia) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const onResize = () => {
      if (desktop.matches) setDrawerState((state) => ({ ...state, open: false }));
    };
    desktop.addEventListener('change', onResize);
    return () => desktop.removeEventListener('change', onResize);
  }, [drawerOpen]);

  function closeDrawer(restoreFocus: boolean) {
    restoreDrawerFocus.current = restoreFocus;
    setDrawerOpen(false);
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        restoreDrawerFocus.current = true;
        setDrawerState((s) => ({ ...s, open: false }));
      }
      if (e.key === 'Tab') {
        const controls = drawerPanelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]',
        );
        const available = Array.from(controls ?? []).filter(
          (control) => !control.closest('[hidden]'),
        );
        const first = available[0];
        const last = available[available.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  const sidebarWidth = collapsed ? 'lg:w-[72px]' : 'lg:w-[264px]';

  return (
    <div className="dashboard-shell min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only z-50 rounded-control bg-brand-950 px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      {/* Desktop / tablet sidebar */}
      <aside
        inert={drawerOpen}
        className={cn(
          'dashboard-sidebar fixed inset-y-0 left-0 z-30 hidden w-[72px] flex-col border-r border-border bg-surface-muted text-ink-700 transition-[width] duration-200 motion-reduce:transition-none md:flex',
          sidebarWidth,
        )}
      >
        <div
          className={cn(
            'flex h-20 shrink-0 items-center border-b border-border',
            collapsed ? 'justify-center' : 'justify-center px-4 lg:justify-start',
          )}
        >
          <Link to={homePath} className="rounded focus-visible:outline-brand-600" aria-label="Home">
            {/* Full wordmark only when the sidebar is expanded on desktop; the rail shows the icon. */}
            <BrandMark hideText className={cn(!collapsed && 'lg:hidden')} />
            {!collapsed && <BrandMark className="hidden lg:inline-flex" />}
          </Link>
        </div>
        {!collapsed && (
          <div className="mx-3 mt-5 mb-2 hidden items-center gap-3 rounded-xl border border-border bg-white p-3 lg:flex">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <WorkspaceIcon className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">
                {workspaceLabel}
              </p>
              <p className="mt-1 truncate text-sm font-medium" title={workspaceName}>
                {workspaceName}
              </p>
              {sidebarBadge && <div className="mt-2">{sidebarBadge}</div>}
            </div>
          </div>
        )}
        <SidebarNav groups={visible} collapsed={collapsed} />
        <SidebarAccount collapsed={collapsed} profilePath={profilePath} />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          className="sidebar-collapse"
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden />
          )}
        </button>
      </aside>

      {/* Top bar */}
      <header
        inert={drawerOpen}
        className={cn(
          'sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-white/95 px-3 shadow-sm shadow-slate-900/3 backdrop-blur-sm sm:h-18 sm:gap-5 sm:px-5 md:pl-[calc(72px+1.25rem)]',
          collapsed ? 'lg:pl-[calc(72px+1.5rem)]' : 'lg:pl-[calc(264px+1.5rem)]',
        )}
      >
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          aria-controls="mobile-drawer"
          onClick={(event) => {
            drawerTriggerRef.current = event.currentTarget;
            setDrawerOpen(true);
          }}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-ink-600 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-600 lg:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-semibold tracking-wider text-ink-500 uppercase sm:text-[11px]">
            {workspaceLabel}
          </p>
          <p className="mt-0.5 truncate text-base font-semibold tracking-tight text-brand-950 sm:text-lg">
            {activeItem?.label ?? 'Dashboard'}
          </p>
        </div>
        {topBarStart && (
          <div
            className={cn(
              'hidden max-w-64 min-w-0 items-center gap-2 rounded-xl border border-border bg-surface-muted px-3 py-2',
              principal?.kind === 'platform_staff' ? 'md:flex' : 'lg:flex',
            )}
          >
            <WorkspaceIcon className="size-4 shrink-0 text-brand-600" aria-hidden />
            {topBarStart}
          </div>
        )}
        <div className="shrink-0 border-l border-border pl-2 sm:pl-4">
          <UserMenu profilePath={profilePath} dashboard />
        </div>
      </header>

      {banner && (
        <div
          inert={drawerOpen}
          className={cn('md:pl-[72px]', collapsed ? 'lg:pl-[72px]' : 'lg:pl-[264px]')}
        >
          {banner}
        </div>
      )}

      {/* Content */}
      <main
        inert={drawerOpen}
        tabIndex={-1}
        id="main"
        className={cn(
          'dashboard-main w-full px-4 pt-6 pb-24 sm:px-6 sm:pt-8 md:pb-10 md:pl-[calc(72px+1.5rem)] lg:px-10',
          collapsed ? 'lg:pl-[calc(72px+2.5rem)]' : 'lg:pl-[calc(264px+2.5rem)]',
        )}
      >
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Mobile bottom nav */}
      <nav
        inert={drawerOpen}
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface safe-bottom md:hidden"
      >
        <ul className="grid auto-cols-fr grid-flow-col">
          {primary.map((item) => (
            <li key={item.key}>
              <NavLink
                to={item.to}
                end={item.end ?? false}
                onMouseEnter={() => prefetchRoute(item.to, queryClient)}
                onFocus={() => prefetchRoute(item.to, queryClient)}
                className={({ isActive }) =>
                  cn(
                    'flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium',
                    isActive ? 'text-brand-700' : 'text-ink-500',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        'flex h-6 w-10 items-center justify-center rounded-full',
                        isActive && 'bg-brand-100',
                      )}
                    >
                      <item.icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="max-w-full truncate px-1">
                      {item.key === 'routers'
                        ? 'Routers'
                        : item.key === 'vouchers'
                          ? 'Vouchers'
                          : item.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
          <li>
            <button
              type="button"
              ref={moreButtonRef}
              onClick={(event) => {
                drawerTriggerRef.current = event.currentTarget;
                setDrawerOpen(true);
              }}
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
              className="flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-ink-500"
            >
              <span className="flex h-6 w-10 items-center justify-center">
                <MoreHorizontal className="size-[18px]" aria-hidden />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          id="mobile-drawer"
        >
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-brand-950/60 backdrop-blur-sm"
            tabIndex={-1}
            onClick={() => closeDrawer(true)}
          />
          <div
            ref={drawerPanelRef}
            className="absolute inset-y-0 left-0 flex w-[86vw] max-w-xs flex-col bg-surface-muted text-ink-700 shadow-2xl"
          >
            <div className="flex h-20 shrink-0 items-center justify-between border-b border-border px-4">
              <BrandMark />
              <Button
                ref={drawerCloseRef}
                variant="ghost"
                size="icon"
                aria-label="Close"
                onClick={() => closeDrawer(true)}
                className="text-ink-700 hover:bg-brand-50"
              >
                <X className="size-5" />
              </Button>
            </div>
            <div className="mx-3 mt-4 rounded-xl border border-border bg-white p-3">
              <p className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">
                {workspaceLabel}
              </p>
              <p className="mt-1 truncate text-sm font-medium">{workspaceName}</p>
              {sidebarBadge && <div className="mt-2">{sidebarBadge}</div>}
              {principal?.kind === 'platform_staff' && <div className="mt-2">{topBarStart}</div>}
            </div>
            <SidebarNav
              groups={visible}
              collapsed={false}
              onNavigate={() => setDrawerOpen(false)}
            />
            <SidebarAccount profilePath={profilePath} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
