import { useEffect } from 'react';
import { Link } from 'react-router';
import { Building2, ExternalLink, RefreshCw, Store } from 'lucide-react';
import { Button, CopyButton, Skeleton } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { formatRelative, formatDateTime } from '@/lib/formatting/dates';
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
  const storefrontPath = profile.data ? `/s/${encodeURIComponent(profile.data.slug)}` : '';
  const storefrontUrl = storefrontPath ? `${window.location.origin}${storefrontPath}` : '';

  return (
    <div className="space-y-6">
      {canEdit && (
        <SettingsCard
          id="business"
          title="Business profile"
          icon={<Building2 />}
          description="How your business appears to customers on your storefront, receipts and emails."
          actions={
            <Button
              size="sm"
              variant="ghost"
              disabled={profile.isFetching}
              onClick={() => void profile.refetch()}
              leadingIcon={
                <RefreshCw
                  className={
                    profile.isFetching ? 'animate-spin motion-reduce:animate-none' : undefined
                  }
                  aria-hidden
                />
              }
            >
              Refresh profile
            </Button>
          }
        >
          {profile.isError && profile.data && (
            <Alert className="mb-4" tone="warning" title="Profile could not be refreshed">
              Your draft is preserved. These are the last loaded business details.
            </Alert>
          )}
          {profile.data ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-surface-muted p-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-700"
                  >
                    <Store className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-500">Your storefront</p>
                    <Link
                      className="dashboard-data-link text-sm font-semibold break-all"
                      to={storefrontPath}
                    >
                      /s/{profile.data.slug}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <CopyButton
                    value={storefrontUrl}
                    label="Copy storefront link"
                    variant="secondary"
                  />
                  <a
                    href={storefrontPath}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Open storefront in a new tab"
                    className="inline-flex size-8 items-center justify-center rounded-control text-ink-500 hover:bg-surface hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    <ExternalLink className="size-4" aria-hidden />
                  </a>
                </div>
              </div>
              <TenantProfileForm key={profile.data.id} profile={profile.data} />
              <p className="text-xs text-ink-500">
                Last saved{' '}
                <time
                  dateTime={profile.data.updated_at}
                  title={formatDateTime(profile.data.updated_at)}
                >
                  {formatRelative(profile.data.updated_at)}
                </time>
                . Your storefront link stays the same when you rename the business.
              </p>
            </div>
          ) : profile.isPending ? (
            <Skeleton className="h-72 w-full rounded-xl" />
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
