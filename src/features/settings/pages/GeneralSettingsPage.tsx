import { useEffect } from 'react';
import { Link } from 'react-router';
import { Building2, RefreshCw } from 'lucide-react';
import { Button, Card, Skeleton } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { formatDateTime } from '@/lib/formatting/dates';
import { useTenantProfile } from '../queries';
import { SettingsCard } from '../components/SettingsCard';
import { TenantProfileForm } from '../components/TenantProfileForm';
import { AccountSection } from '../components/AccountSection';

export default function GeneralSettingsPage() {
  useEffect(() => {
    document.title = 'General settings | Yarotech RADIUS';
  }, []);
  const principal = usePrincipal();
  const canEdit = can(principal, 'settings.profile');
  const profile = useTenantProfile(canEdit);

  return (
    <div className="space-y-6">
      <Card className="border-brand-200 bg-gradient-to-br from-brand-50/70 via-surface to-sky-50/50 dark:from-brand-950/40 dark:via-surface dark:to-slate-900/40">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
            <Building2 className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-ink-900">
              {canEdit ? 'Your business and account' : 'Your account and security'}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              {canEdit
                ? 'Keep your business identity and contact details up to date, then manage your personal account and password below.'
                : 'Review your signed-in account details and keep your password up to date. Business details are managed by workspace owners and managers.'}
            </p>
            <nav
              aria-label="General settings shortcuts"
              className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-brand-600 dark:text-brand-400"
            >
              {canEdit && (
                <a className="hover:underline" href="#business">
                  Business profile
                </a>
              )}
              <a className="hover:underline" href="#account">
                Your account
              </a>
              <a className="hover:underline" href="#password">
                Password
              </a>
            </nav>
          </div>
        </div>
      </Card>

      {canEdit && (
        <SettingsCard
          id="business"
          title="Business profile"
          description="Your workspace name and business contact details. Your storefront address is managed separately and stays the same when these details change."
        >
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
            <div className="min-w-0 text-xs text-ink-500">
              {profile.data ? (
                <>
                  Last saved{' '}
                  <time dateTime={profile.data.updated_at}>
                    {formatDateTime(profile.data.updated_at)}
                  </time>
                </>
              ) : (
                'Workspace details'
              )}
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={profile.isFetching}
              onClick={() => void profile.refetch()}
              leadingIcon={
                <RefreshCw
                  className={profile.isFetching ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'}
                  aria-hidden
                />
              }
            >
              Refresh profile
            </Button>
          </div>
          {profile.isError && profile.data && (
            <Alert className="mb-4" tone="warning" title="Profile could not be refreshed">
              Your draft is preserved. These are the last loaded business details.
            </Alert>
          )}
          {profile.data ? (
            <>
              <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50/80 dark:bg-brand-950/60 dark:border-brand-900 p-3.5">
                <p className="text-xs font-bold text-brand-800 dark:text-brand-300">Storefront address</p>
                <Link
                  className="mt-1 inline-block text-sm font-semibold break-all text-brand-600 dark:text-brand-400 hover:underline"
                  to={`/s/${encodeURIComponent(profile.data.slug)}`}
                >
                  /s/{profile.data.slug}
                </Link>
              </div>
              <TenantProfileForm key={profile.data.id} profile={profile.data} />
            </>
          ) : profile.isPending ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <ErrorState
              error={profile.error}
              onRetry={() => void profile.refetch()}
              compact
              title="Profile could not be loaded"
            />
          )}
        </SettingsCard>
      )}
      <AccountSection />
    </div>
  );
}
