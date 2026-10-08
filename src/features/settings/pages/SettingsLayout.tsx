import { NavLink, Outlet } from 'react-router';
import { Building2, CreditCard, Layers, Users, type LucideIcon } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/utilities/cn';
import { can, canAny, type Capability, workspaceName } from '@/services/auth/principal';

const SECTIONS: {
  to: string;
  label: string;
  description: string;
  /** Shown when the principal has any of these capabilities. */
  caps: Capability[];
  /** Extra condition, e.g. the team list is for managers and owners, not staff. */
  also?: Capability;
  icon: LucideIcon;
}[] = [
  {
    to: '/settings/general',
    label: 'General',
    description: 'Business profile, your account and password',
    caps: ['settings.profile', 'team.view'],
    icon: Building2,
  },
  {
    to: '/settings/billing',
    label: 'Billing & payouts',
    description: 'Payment gateway, agent wallets and vouchers',
    caps: ['settings.billing'],
    icon: CreditCard,
  },
  {
    to: '/settings/team',
    label: 'Team',
    description: 'Who can sign in to this workspace',
    caps: ['team.view'],
    also: 'settings.profile',
    icon: Users,
  },
  {
    to: '/settings/subscription',
    label: 'Subscription',
    description: 'Your Yarotech plan, usage and renewal',
    caps: ['subscription.view'],
    icon: Layers,
  },
];

function initials(text: string) {
  return (
    text
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/** Settings shell: page header, section navigation (side rail on desktop, scroll strip on mobile). */
export default function SettingsLayout() {
  const principal = usePrincipal();
  const sections = SECTIONS.filter(
    (section) => canAny(principal, section.caps) && (!section.also || can(principal, section.also)),
  );
  const workspace = workspaceName(principal);
  const person =
    [principal.user.first_name, principal.user.last_name].filter(Boolean).join(' ') ||
    principal.user.username;
  const role = (principal.kind === 'member' ? principal.role : principal.user.role).replaceAll(
    '_',
    ' ',
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-500">Workspace</p>
          <h1 className="text-2xl font-bold text-ink-900">Settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Manage your business details, payments, team and Yarotech plan.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2">
          <Avatar initials={initials(workspace || person)} size="sm" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-semibold text-ink-900">{workspace || person}</p>
            <p className="flex items-center gap-1.5 text-xs text-ink-500">
              <span className="truncate">{person}</span>
              <Badge tone="neutral" size="sm" className="capitalize">
                {role}
              </Badge>
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto rounded-card border border-border bg-surface p-1.5 lg:flex-col lg:overflow-visible">
            {sections.map(({ to, label, description, icon: Icon }) => (
              <li key={to} className="shrink-0">
                <NavLink
                  to={to}
                  aria-describedby={`settings-nav-${label.replace(/\W+/g, '-')}`}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-start gap-3 rounded-control px-3 py-2.5 transition-colors focus-visible:outline-2 focus-visible:outline-brand-600',
                      isActive
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-ink-700 hover:bg-surface-muted hover:text-ink-900',
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span
                        aria-hidden
                        className={cn(
                          'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg',
                          isActive ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-500',
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold whitespace-nowrap">
                          {label}
                        </span>
                        <span
                          aria-hidden
                          id={`settings-nav-${label.replace(/\W+/g, '-')}`}
                          className="hidden text-xs leading-snug text-ink-500 lg:block"
                        >
                          {description}
                        </span>
                      </span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
