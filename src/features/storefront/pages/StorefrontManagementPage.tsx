import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  CircleDashed,
  Copy,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { settingsApi } from '@/features/settings/api';
import { Badge, Button, ButtonLink, Card, CardHeader, Skeleton } from '@/components/ui';
import { Alert, EmptyState, QueryBoundary } from '@/components/feedback';
import { copyToClipboard } from '@/lib/utilities/clipboard';
import { cn } from '@/lib/utilities/cn';
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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Customer sales</p>
          <h1 className="text-2xl font-bold text-ink-900">Storefront</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Share your online shop so customers can choose an internet plan and buy an access code
            instantly.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          leadingIcon={
            <RefreshCw
              className={profile.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
            />
          }
          disabled={profile.isFetching}
          onClick={() => void profile.refetch()}
        >
          {profile.isFetching ? 'Refreshing...' : 'Refresh profile'}
        </Button>
      </header>

      {profile.isError && profile.data && (
        <Alert tone="warning" title="Business details could not be refreshed">
          Showing the last loaded profile. Try refreshing again.
        </Alert>
      )}

      <QueryBoundary
        query={profile}
        skeleton={<Skeleton className="h-64 w-full rounded-card" />}
        errorTitle="Could not load your storefront"
      >
        {(tenant) => <StorefrontDetails key={tenant.slug} tenant={tenant} />}
      </QueryBoundary>
    </div>
  );
}

function StorefrontDetails({ tenant }: { tenant: TenantProfile }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const path = `/s/${encodeURIComponent(tenant.slug)}`;
  const url = new URL(path, window.location.origin).href;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Buy ${tenant.name} Wi-Fi access here: ${url}`,
  )}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold break-words text-ink-900">{tenant.name}</h2>
            <Badge tone={tenant.is_active ? 'success' : 'warning'} dot>
              {tenant.is_active ? 'Business active' : 'Business inactive'}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-500">
            One link for all your internet plans. Customers browse and pay without signing in.
          </p>

          <div className="mt-5 rounded-card border border-border bg-surface-muted p-4">
            <p className="mb-1.5 text-xs font-medium text-ink-500">Customer link</p>
            <a
              href={path}
              target="_blank"
              rel="noopener noreferrer"
              className="dashboard-data-link block text-base font-semibold break-all"
            >
              {url}
            </a>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
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
                size="sm"
                leadingIcon={<ExternalLink />}
              >
                Open storefront
              </ButtonLink>
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-xs font-medium text-ink-900 transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <MessageCircle aria-hidden className="size-4 text-success-600" />
                Share on WhatsApp
              </a>
            </div>
            <p role="status" className="mt-2 text-xs text-ink-500">
              {copyStatus === 'failed'
                ? 'Could not copy automatically. Select and copy the customer link above.'
                : copyStatus === 'copied'
                  ? 'Link copied. Paste it into WhatsApp, social media or your hotspot welcome page.'
                  : 'Share this link on WhatsApp, social media or your hotspot welcome page.'}
            </p>
          </div>

          <div className="mt-5">
            <h3 className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
              How customers buy
            </h3>
            <ol className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                ['Choose a plan', 'Compare price, duration, data and speed.'],
                ['Complete payment', 'Enter contact details, then pay at secure checkout.'],
                [
                  'Receive an access code',
                  'Shown once payment and voucher fulfilment are confirmed.',
                ],
              ].map(([title, description], index) => (
                <li key={title} className="flex gap-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-900">{title}</p>
                    <p className="text-xs text-ink-500">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Card>

        <ReadinessChecklist tenant={tenant} />
      </div>

      <LogoSettings />

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

type CheckState = 'done' | 'todo' | 'review' | 'loading';

function CheckItem({
  state,
  title,
  detail,
  action,
}: {
  state: CheckState;
  title: string;
  detail: string;
  action: ReactNode;
}) {
  const Icon = state === 'done' ? CheckCircle2 : state === 'todo' ? AlertCircle : CircleDashed;
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 size-5 shrink-0',
          state === 'done' && 'text-success-600',
          state === 'todo' && 'text-warning-600',
          (state === 'review' || state === 'loading') && 'text-ink-400',
          state === 'loading' && 'animate-pulse',
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900">
          {title}
          <span className="sr-only">
            {state === 'done' ? ' (done)' : state === 'todo' ? ' (needs attention)' : ' (check)'}
          </span>
        </p>
        <p className="text-xs text-ink-500">{detail}</p>
      </div>
      <div className="shrink-0 self-center">{action}</div>
    </li>
  );
}

function CheckLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="dashboard-data-link inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap"
    >
      {children}
      <ArrowUpRight aria-hidden className="size-3.5" />
    </Link>
  );
}

/** What a customer needs before the link is worth sharing, checked against real data. */
function ReadinessChecklist({ tenant }: { tenant: TenantProfile }) {
  const plans = usePublicPlans(tenant.is_active ? tenant.slug : null);
  const planCount = plans.data?.count;
  const hasContact = Boolean(tenant.phone?.trim() || tenant.email?.trim());
  const planState: CheckState = !tenant.is_active
    ? 'todo'
    : planCount === undefined
      ? plans.isError
        ? 'review'
        : 'loading'
      : planCount > 0
        ? 'done'
        : 'todo';
  const done = [tenant.is_active, planState === 'done', hasContact].filter(Boolean).length;
  return (
    <Card className="min-w-0">
      <section aria-label="Storefront readiness">
        <CardHeader
          title="Ready to share"
          description={`${done} of 3 essentials in place`}
          className="mb-3"
        />
        <ul className="divide-y divide-border">
          <CheckItem
            state={tenant.is_active ? 'done' : 'todo'}
            title="Business active"
            detail={
              tenant.is_active
                ? 'Customers can open your storefront.'
                : 'Contact your platform administrator to reactivate.'
            }
            action={null}
          />
          <CheckItem
            state={planState}
            title="Plans on sale"
            detail={
              planState === 'done'
                ? `${planCount} ${planCount === 1 ? 'plan is' : 'plans are'} visible to customers.`
                : planState === 'loading'
                  ? 'Checking published plans…'
                  : planState === 'review'
                    ? 'Published plans could not be checked.'
                    : 'No plan is visible to customers yet.'
            }
            action={<CheckLink to="/plans">Manage plans</CheckLink>}
          />
          <CheckItem
            state={hasContact ? 'done' : 'todo'}
            title="Contact details"
            detail={
              hasContact
                ? [tenant.phone, tenant.email].filter((v) => v?.trim()).join(' · ')
                : 'Add a phone number or email customers can reach.'
            }
            action={<CheckLink to="/settings/general">Edit business profile</CheckLink>}
          />
          <CheckItem
            state="review"
            title="Payment settings"
            detail="Confirm provider credentials before sharing your shop."
            action={<CheckLink to="/settings/billing">Payment settings</CheckLink>}
          />
        </ul>
      </section>
    </Card>
  );
}

function PublishedPlans({ slug }: { slug: string }) {
  const plans = usePublicPlans(slug);
  return (
    <section aria-labelledby="storefront-plans-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="storefront-plans-title" className="text-lg font-semibold text-ink-900">
            Customer plans
          </h2>
          <p className="text-sm text-ink-500">
            Exactly what customers see. Open a checkout to review their experience.
          </p>
          {plans.data && (
            <p className="mt-0.5 text-xs text-ink-500">
              Showing {plans.data.results.length} of {plans.data.count} customer plans
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={plans.isFetching}
          leadingIcon={
            <RefreshCw
              className={plans.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
            />
          }
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
                    className="break-words"
                    action={
                      <ButtonLink
                        to={`/s/${encodeURIComponent(slug)}/checkout/${plan.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="secondary"
                        size="sm"
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
