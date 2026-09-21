import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Building2,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Globe,
  RefreshCw,
  ShoppingBag,
  Store,
  Zap,
} from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { settingsApi } from '@/features/settings/api';
import { Badge, Button, ButtonLink, Card, Skeleton } from '@/components/ui';
import { Alert, EmptyState, QueryBoundary } from '@/components/feedback';
import { copyToClipboard } from '@/lib/utilities/clipboard';
import type { TenantProfile } from '@/types/api';
import { usePublicPlans } from '../queries';
import { PlanCard, PlanCardSkeleton } from '../components/PlanCard';
import { LogoSettings } from '../components/LogoSettings';

export default function StorefrontManagementPage() {
  const principal = usePrincipal();
  const tenantId = principal.kind === 'member' ? principal.tenantId : null;
  const profile = useQuery({
    queryKey: ['storefront-management', tenantId],
    queryFn: settingsApi.profile,
    enabled: tenantId !== null && can(principal, 'settings.profile'),
  });

  useEffect(() => {
    document.title = 'Storefront · Yarotech RADIUS';
  }, []);

  return (
    <div className="space-y-6">
      {/* Premium Hero Header */}
      <div className="router-page-hero">
        <div className="router-page-hero-inner">
          <div className="router-page-hero-text">
            <span className="router-page-hero-eyebrow">
              <Store className="size-3" aria-hidden /> E-Commerce & Customer Sales
            </span>
            <h1 className="router-page-hero-title">Storefront</h1>
            <p className="router-page-hero-desc">
              Share your online shop so customers can choose an internet plan and purchase an access code instantly.
            </p>
          </div>
          <div className="router-page-hero-actions">
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw className={profile.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />}
              disabled={profile.isFetching}
              onClick={() => void profile.refetch()}
            >
              {profile.isFetching ? 'Refreshing...' : 'Refresh profile'}
            </Button>
          </div>
        </div>

        {/* Hero Stats Strip */}
        {profile.data && (
          <div className="router-page-hero-strip">
            <div className="router-page-hero-stat">
              <Globe className="size-4" aria-hidden />
              <span>/s/{profile.data.slug}</span>
            </div>
            <div className="router-page-hero-divider" />
            <div className="router-page-hero-stat">
              <Zap className="size-4 text-emerald-400" aria-hidden />
              <span>{profile.data.is_active ? 'Storefront active' : 'Storefront inactive'}</span>
            </div>
          </div>
        )}
      </div>

      {profile.isError && profile.data && (
        <Alert tone="warning" title="Business details could not be refreshed">
          Showing the last loaded profile. Try refreshing again.
        </Alert>
      )}

      <QueryBoundary
        query={profile}
        skeleton={<Skeleton className="h-64 w-full rounded-2xl" />}
        errorTitle="Could not load your storefront"
      >
        {(tenant) => <StorefrontDetails key={tenant.slug} tenant={tenant} />}
      </QueryBoundary>
      <LogoSettings />
    </div>
  );
}

function StorefrontDetails({ tenant }: { tenant: TenantProfile }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const path = `/s/${encodeURIComponent(tenant.slug)}`;
  const url = new URL(path, window.location.origin).href;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50/70 via-surface to-sky-50/50 dark:from-brand-950/40 dark:via-surface dark:to-slate-900/40">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="rounded-xl bg-brand-600 p-3 text-white shadow-md">
                <Store className="size-6" aria-hidden />
              </span>
              <Badge tone={tenant.is_active ? 'success' : 'warning'} dot>
                {tenant.is_active ? 'Business active' : 'Business inactive'}
              </Badge>
            </div>
            <p className="text-xs font-semibold tracking-wider text-brand-600 dark:text-brand-400 uppercase">
              Your customer storefront
            </p>
            <h2 className="mt-2 text-2xl font-bold break-words text-ink-900">
              {tenant.name}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">
              One link for your internet plans. Customers can browse and purchase an access code
              without signing in to your dashboard.
            </p>
            <div className="mt-5 rounded-xl border border-border bg-surface p-4 shadow-inner">
              <p className="mb-2 text-xs font-medium text-ink-500">Customer link</p>
              <a
                href={path}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-semibold break-all text-brand-600 hover:text-brand-700 underline underline-offset-4"
              >
                {url}
              </a>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  leadingIcon={copyStatus === 'copied' ? <Check /> : <Copy />}
                  onClick={async () =>
                    setCopyStatus((await copyToClipboard(url)) ? 'copied' : 'failed')
                  }
                >
                  {copyStatus === 'copied' ? 'Copied' : 'Copy storefront link'}
                </Button>
                <ButtonLink
                  to={path}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="secondary"
                  leadingIcon={<ExternalLink />}
                >
                  Open storefront
                </ButtonLink>
              </div>
              <p role="status" className="mt-2 text-xs text-ink-500">
                {copyStatus === 'failed'
                  ? 'Could not copy automatically. Select and copy the customer link above.'
                  : copyStatus === 'copied'
                    ? 'Link copied. Paste it into WhatsApp, social media or your hotspot welcome page.'
                    : 'Share this link on WhatsApp, social media or your hotspot welcome page.'}
              </p>
            </div>
          </div>
          <div className="min-w-0 rounded-xl border border-border bg-surface-muted/50 p-5">
            <h3 className="font-semibold text-ink-900">How customers buy</h3>
            <ol className="mt-5 space-y-5">
              {[
                ['Choose a plan', 'Compare the price, duration, data allowance and speed.'],
                ['Complete payment', 'Enter contact details and continue to secure checkout.'],
                [
                  'Receive an access code',
                  'The payment result page displays the code after payment and voucher fulfilment are confirmed.',
                ],
              ].map(([title, description], index) => (
                <li key={title} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-950 text-xs font-bold text-brand-700 dark:text-brand-300">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-500">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Card>

      <section aria-labelledby="storefront-setup-title" className="space-y-4">
        <div>
          <h2 id="storefront-setup-title" className="text-lg font-bold text-ink-900">
            Storefront setup
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Keep your customer-facing details, plans and payment settings up to date.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              title: 'Internet plans',
              description: 'Manage the active plans customers can choose and their pricing.',
              to: '/plans',
              label: 'Manage plans',
              icon: ShoppingBag,
            },
            {
              title: 'Business profile',
              description: 'Update the business name and contact details your customers see.',
              to: '/settings/general',
              label: 'Edit business profile',
              icon: Building2,
            },
            {
              title: 'Payments',
              description:
                'Review provider credentials and payment rules before sharing your shop.',
              to: '/settings/billing',
              label: 'Payment settings',
              icon: CreditCard,
            },
          ].map(({ title, description, to, label, icon: Icon }) => (
            <Card key={to} className="flex min-w-0 flex-col border-border/70 hover:shadow-md transition-shadow">
              <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                <Icon className="size-5" aria-hidden />
              </div>
              <h3 className="font-semibold text-ink-900">{title}</h3>
              <p className="mt-2 mb-4 flex-1 text-sm leading-relaxed text-ink-500">{description}</p>
              <ButtonLink to={to} variant="secondary" trailingIcon={<ArrowUpRight />}>
                {label}
              </ButtonLink>
            </Card>
          ))}
        </div>
      </section>

      {tenant.is_active ? (
        <PublishedPlans slug={tenant.slug} />
      ) : (
        <EmptyState
          title="Your storefront is unavailable"
          description="This business is inactive. Contact your platform administrator to restore customer access."
        />
      )}
    </div>
  );
}

function PublishedPlans({ slug }: { slug: string }) {
  const plans = usePublicPlans(slug);
  return (
    <section aria-labelledby="storefront-plans-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="storefront-plans-title" className="text-lg font-bold text-ink-900">
            Customer plans
          </h2>
          <p className="mt-0.5 text-sm text-ink-500">
            Preview the plans customers see, then open checkout to review their experience.
          </p>
          {plans.data && (
            <p className="mt-1 text-xs font-semibold text-brand-600 dark:text-brand-400">
              Showing {plans.data.results.length} of {plans.data.count} customer plans
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          disabled={plans.isFetching}
          leadingIcon={<RefreshCw className={plans.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />}
          onClick={() => void plans.refetch()}
        >
          {plans.isFetching ? 'Refreshing...' : 'Refresh plans'}
        </Button>
      </div>
      {plans.isError && plans.data && (
        <Alert tone="warning" title="Customer plans could not be refreshed">
          Showing the last loaded plans. Try refreshing again.
        </Alert>
      )}
      <QueryBoundary
        query={plans}
        errorTitle="Could not load customer plans"
        skeleton={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <PlanCardSkeleton />
            <PlanCardSkeleton />
          </div>
        }
      >
        {(data) =>
          data.results.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="size-6" aria-hidden />}
              title="No plans available to customers"
              description="Create an active internet plan in Manage plans, then return here to check your storefront."
            />
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {data.results.map((plan) => (
                <li key={plan.id} className="min-w-0">
                  <PlanCard
                    plan={plan}
                    className="border-border/70 p-5 break-words hover:shadow-md transition-shadow"
                    action={
                      <ButtonLink
                        to={`/s/${encodeURIComponent(slug)}/checkout/${plan.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="secondary"
                        block
                      >
                        View customer checkout
                      </ButtonLink>
                    }
                  />
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>
    </section>
  );
}
