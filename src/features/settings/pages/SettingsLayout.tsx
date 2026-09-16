import { NavLink, Outlet } from 'react-router';
import { Building2, CreditCard, Layers, Settings, ShieldCheck, User } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { cn } from '@/lib/utilities/cn';
import { can, canAny, type Capability, workspaceName } from '@/services/auth/principal';

const TABS: { to: string; label: string; caps: Capability[]; icon: any }[] = [
  { to: '/settings/general', label: 'General & Profile', caps: ['settings.profile', 'team.view'], icon: Building2 },
  { to: '/settings/billing', label: 'Billing & Payouts', caps: ['settings.billing'], icon: CreditCard },
  { to: '/settings/subscription', label: 'Subscription Plan', caps: ['subscription.view'], icon: Layers },
];

/** Shared header + tab strip for /settings/*. Each tab is also route-guarded. */
export default function SettingsLayout() {
  const principal = usePrincipal();
  const tabs = TABS.filter((t) => canAny(principal, t.caps));
  const canEditProfile = can(principal, 'settings.profile');
  const name = workspaceName(principal) || principal.user.first_name || principal.user.username;

  return (
    <div className="space-y-6">
      {/* Premium Hero Header */}
      <div className="router-page-hero">
        <div className="router-page-hero-inner">
          <div className="router-page-hero-text">
            <span className="router-page-hero-eyebrow">
              <Settings className="size-3" aria-hidden /> Workspace Configuration
            </span>
            <h1 className="router-page-hero-title">Settings & Preferences</h1>
            <p className="router-page-hero-desc">
              {canEditProfile
                ? 'Your business profile, payment configurations, credentials and subscription.'
                : 'Your personal account details, security credentials and subscription.'}
            </p>
          </div>
        </div>

        {/* Hero Stats Strip */}
        <div className="router-page-hero-strip">
          <div className="router-page-hero-stat">
            <User className="size-4" aria-hidden />
            <span>{name} ({principal.user.role.replaceAll('_', ' ')})</span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-stat">
            <ShieldCheck className="size-4 text-emerald-400" aria-hidden />
            <span>Encrypted RADIUS Environment</span>
          </div>
        </div>
      </div>

      {/* Styled Tab Navigation */}
      <nav
        aria-label="Settings sections"
        className="flex flex-wrap gap-2 rounded-xl border border-border bg-surface-muted p-1.5"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-ink-600 hover:bg-surface hover:text-ink-900',
                )
              }
            >
              <Icon className="size-4" aria-hidden />
              {tab.label}
            </NavLink>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}
