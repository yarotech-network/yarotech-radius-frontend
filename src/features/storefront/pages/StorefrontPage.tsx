import { useEffect, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router';
import { ShieldCheck, Smartphone, Wifi, Zap } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { NotFoundPage } from '@/app/shell/NotFoundPage';
import { isApiError } from '@/services/api/errors';
import { usePublicPlans, usePublicTenant } from '../queries';
import { PlanCard, PlanCardSkeleton } from '../components/PlanCard';
import CheckoutPage from './CheckoutPage';
import { TenantLogo } from '../components/TenantLogo';
import { pendingCheckout } from '../pendingCheckout';

/** `/s/:slug/*` — public storefront: plan catalogue → checkout. */
export default function StorefrontPage() {
  const { slug = '' } = useParams();
  const tenant = usePublicTenant(slug);

  useEffect(() => {
    if (tenant.data) document.title = `${tenant.data.name} · Buy Wi-Fi`;
  }, [tenant.data]);

  if (tenant.isError && isApiError(tenant.error) && tenant.error.status === 404) {
    return (
      <NotFoundPage
        homePath="/"
        title="This storefront does not exist"
        description="Check the link you were given — the business may have changed its address."
      />
    );
  }

  return (
    <div className="public-storefront">
      <Routes key={slug}>
        <Route
          index
          element={
            <Catalogue
              slug={slug}
              tenantName={tenant.data?.name ?? null}
              logoUrl={tenant.data?.logo_url ?? null}
              tenantLoading={tenant.isPending}
              tenantError={tenant.isError ? tenant.error : null}
              onRetryTenant={() => void tenant.refetch()}
            />
          }
        />
        <Route
          path="checkout/:planId"
          element={<CheckoutPage slug={slug} tenantName={tenant.data?.name ?? null} />}
        />
        <Route path="*" element={<NotFoundPage homePath={`/s/${slug}`} />} />
      </Routes>
    </div>
  );
}

type DurationGroup = 'hourly' | 'daily' | 'weekly' | 'monthly';
const DURATION_GROUPS: { value: DurationGroup; label: string }[] = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function durationGroup(hours: number): DurationGroup {
  if (hours < 24) return 'hourly';
  if (hours < 168) return 'daily';
  if (hours < 720) return 'weekly';
  return 'monthly';
}

const TRUST = [
  { icon: Zap, label: 'Instant access code' },
  { icon: ShieldCheck, label: 'Secure payment' },
  { icon: Smartphone, label: 'Works on any device' },
];

function Catalogue({
  slug,
  tenantName,
  logoUrl,
  tenantLoading,
  tenantError,
  onRetryTenant,
}: {
  slug: string;
  tenantName: string | null;
  logoUrl: string | null;
  tenantLoading: boolean;
  tenantError: unknown;
  onRetryTenant: () => void;
}) {
  // Plans are only requested once the storefront itself resolves (avoids a doomed second call on 404).
  const plans = usePublicPlans(
    tenantName !== null || (!tenantLoading && !tenantError) ? slug : null,
  );
  const [group, setGroup] = useState<DurationGroup | 'all'>('all');
  const [lastPurchase] = useState(() => {
    const saved = pendingCheckout.load();
    return saved?.kind === 'voucher' && saved.slug === slug ? saved : null;
  });
  const results = plans.data?.results ?? [];
  const groups = DURATION_GROUPS.filter((g) =>
    results.some((plan) => durationGroup(plan.duration_hours) === g.value),
  );
  // Filters only help with a real choice: several plans across several lengths.
  const showFilters = results.length >= 4 && groups.length >= 2;
  const visible =
    showFilters && group !== 'all'
      ? results.filter((plan) => durationGroup(plan.duration_hours) === group)
      : results;

  return (
    <>
      <header className="mb-6 rounded-card border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <TenantLogo url={logoUrl} name={tenantName ?? 'Business'} />
          <div className="min-w-0">
            {tenantLoading ? (
              <div className="h-7 w-48 animate-pulse rounded bg-fill-strong" />
            ) : (
              <h1 className="text-2xl font-bold tracking-tight break-words text-ink-900 sm:text-3xl">
                {tenantName ?? 'Buy Wi-Fi'}
              </h1>
            )}
            <p className="mt-1 text-sm text-ink-500">
              Choose a plan, pay securely online, and get connected.
            </p>
          </div>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-4 text-xs font-medium text-ink-600">
          {TRUST.map(({ icon: Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-1.5">
              <Icon className="size-4 text-success-600" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </header>

      {lastPurchase && (
        <p className="mb-4 rounded-control border border-border bg-surface px-4 py-3 text-sm text-ink-700">
          Paid already?{' '}
          <Link
            className="font-semibold text-brand-700 underline-offset-4 hover:underline"
            to={`/pay/result?reference=${encodeURIComponent(lastPurchase.reference)}`}
          >
            View your last purchase
            {lastPurchase.planName ? ` (${lastPurchase.planName})` : ''}
          </Link>
        </p>
      )}

      {tenantError ? (
        <ErrorState
          error={tenantError}
          onRetry={onRetryTenant}
          title="Could not load this storefront"
        />
      ) : plans.isPending ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <PlanCardSkeleton />
            </li>
          ))}
        </ul>
      ) : plans.isError ? (
        <ErrorState
          error={plans.error}
          onRetry={() => void plans.refetch()}
          title="Could not load plans"
        />
      ) : plans.data.results.length === 0 ? (
        <EmptyState
          icon={<Wifi className="size-6" aria-hidden />}
          title="No plans available right now"
          description="New purchases are temporarily unavailable. Existing vouchers can still be used. Please check back later."
        />
      ) : (
        <section aria-labelledby="storefront-plans-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="storefront-plans-heading" className="text-lg font-semibold text-ink-900">
              Choose your plan
            </h2>
            {showFilters && (
              <div
                role="group"
                aria-label="Filter plans by duration"
                className="flex flex-wrap gap-1.5"
              >
                {[{ value: 'all' as const, label: 'All' }, ...groups].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={group === option.value}
                    onClick={() => setGroup(option.value)}
                    className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-border-strong hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 aria-pressed:border-brand-600 aria-pressed:bg-brand-50 aria-pressed:text-brand-700"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((plan) => (
              <li key={plan.id}>
                <PlanCard
                  plan={plan}
                  variant="shop"
                  action={
                    <ButtonLink to={`/s/${slug}/checkout/${plan.id}`} block>
                      Buy
                    </ButtonLink>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="mt-8 text-center text-xs text-ink-500">
        Payments are processed by the business&apos;s selected payment provider. Your access code is
        shown after payment and sent to you by {tenantName ?? 'the business'}.
      </p>
    </>
  );
}
