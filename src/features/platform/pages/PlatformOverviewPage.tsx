import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Building2,
  Clock3,
  Radio,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react';
import { PageHeader, Section, StatusBadge } from '@/components/layout';
import { Button, ButtonLink, Card, Skeleton, Stat } from '@/components/ui';
import { Alert, EmptyState, ErrorState } from '@/components/feedback';
import { formatKobo } from '@/lib/formatting/money';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { PLATFORM_RECENT_TENANTS_PARAMS, usePlatformStats, useTenants } from '../queries';

/** Cross-tenant totals and recent operators, each with independent query feedback. */
export default function PlatformOverviewPage() {
  const stats = usePlatformStats();
  const recent = useTenants(PLATFORM_RECENT_TENANTS_PARAMS);
  const s = stats.data;
  const refreshing = stats.isFetching || recent.isFetching;
  const number = (value: number | undefined) =>
    value === undefined ? '—' : value.toLocaleString();

  useEffect(() => {
    document.title = 'Platform overview · Yarotech RADIUS';
  }, []);

  return (
    <div className="overview-page min-w-0 space-y-6">
      <PageHeader
        title="Platform overview"
        description="Oversee your operators, review network activity and manage platform revenue."
        meta={<span className="overview-role">Administrator</span>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={refreshing}
              leadingIcon={
                <RefreshCw
                  className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''}
                />
              }
              onClick={() => {
                void stats.refetch();
                void recent.refetch();
              }}
            >
              {refreshing ? 'Refreshing…' : 'Refresh overview'}
            </Button>
            <ButtonLink to="/platform/tenants" leadingIcon={<Building2 />}>
              Manage operators
            </ButtonLink>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-100 bg-brand-50/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-brand-800">
          <ShieldCheck className="size-4 shrink-0" aria-hidden />
          Platform-wide view
        </div>
        <p className="flex items-center gap-1.5 text-xs text-ink-600" role="status">
          <Clock3 className="size-3.5" aria-hidden />
          {s && stats.dataUpdatedAt
            ? `Figures retrieved ${formatRelative(new Date(stats.dataUpdatedAt))}`
            : 'Figures appear after loading'}
        </p>
      </div>

      {stats.isError && !s ? (
        <ErrorState
          error={stats.error}
          onRetry={() => void stats.refetch()}
          title="Could not load platform figures"
        />
      ) : (
        <>
          {stats.isError && s && (
            <Alert tone="warning" title="Figures could not be refreshed">
              Showing the last retrieved figures. Use Refresh overview to try again.
            </Alert>
          )}
          <Section title="Platform at a glance" description="Current totals across the platform.">
            <div className="overview-metrics">
              <Stat
                label="Tenants"
                value={number(s?.tenants)}
                hint={s ? `${number(s.active_tenants)} active` : 'Registered businesses'}
                icon={<Building2 />}
                loading={stats.isPending}
                tone="default"
                className="overview-metric overview-metric-blue"
              />
              <Stat
                label="Routers"
                value={number(s?.routers)}
                hint={s ? `${number(s.onboarded_routers)} onboarded` : 'Registered network devices'}
                icon={<Radio />}
                loading={stats.isPending}
                className="overview-metric overview-metric-blue"
              />
              <Stat
                label="Agents"
                value={number(s?.agents)}
                hint="Resellers across all tenants"
                icon={<Users />}
                loading={stats.isPending}
                className="overview-metric overview-metric-blue"
              />
              <Stat
                label="Vouchers issued"
                value={number(s?.vouchers)}
                hint="Total access vouchers"
                icon={<Ticket />}
                loading={stats.isPending}
                className="overview-metric overview-metric-blue"
              />
            </div>
          </Section>

          {s && s.pending_payments > 0 && (
            <Alert
              tone="warning"
              title={`${number(s.pending_payments)} pending`}
              actions={
                <ButtonLink
                  to="/platform/payments?source=vouchers&status=pending"
                  variant="secondary"
                  size="sm"
                >
                  Review pending payments
                </ButtonLink>
              }
            >
              Voucher payments are awaiting confirmation. Review their status before treating them
              as completed sales.
            </Alert>
          )}
        </>
      )}

      <div className="overview-columns">
        <Section
          title="Newest tenants"
          description="The latest operator businesses to join your platform."
          actions={
            <ButtonLink
              to="/platform/tenants"
              variant="link"
              size="sm"
              trailingIcon={<ArrowRight />}
            >
              All tenants
            </ButtonLink>
          }
        >
          {recent.isError && recent.data && (
            <Alert tone="warning" title="Tenant list could not be refreshed">
              Showing the last retrieved operators. Use Refresh overview to try again.
            </Alert>
          )}
          {recent.isPending ? (
            <Card
              aria-busy="true"
              aria-label="Loading newest tenants"
              className="space-y-5 rounded-2xl"
            >
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="size-10 shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </Card>
          ) : recent.isError && !recent.data ? (
            <ErrorState
              error={recent.error}
              onRetry={() => void recent.refetch()}
              title="Could not load tenants"
            />
          ) : recent.data && recent.data.results.length === 0 ? (
            <Card className="rounded-2xl">
              <EmptyState
                icon={<Building2 className="size-6" />}
                title="No operator tenants yet."
                description="Add your first operator to start building your platform."
              />
              <div className="mt-3 flex justify-center">
                <ButtonLink to="/platform/tenants">Manage tenants</ButtonLink>
              </div>
            </Card>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-subtle">
              {recent.data?.results.map((t) => (
                <li key={t.id} className="flex items-start gap-3 p-4 sm:p-5">
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Building2 className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <Link
                        to={`/platform/tenants/${t.id}`}
                        className="min-w-0 font-semibold [overflow-wrap:anywhere] break-words text-brand-950 underline-offset-4 hover:text-brand-600 hover:underline focus-visible:outline-brand-600"
                      >
                        {t.name}
                      </Link>
                      <StatusBadge status={t.is_active ? 'active' : 'inactive'} size="sm" />
                    </div>
                    <p className="mt-1 truncate text-xs text-ink-500" title={`/s/${t.slug}`}>
                      /s/{t.slug}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-500">
                      <span>
                        {number(t.member_count)} member{t.member_count === 1 ? '' : 's'}
                      </span>
                      <span>{number(t.voucher_count)} vouchers</span>
                      <time dateTime={t.created_at} title={formatDateTime(t.created_at)}>
                        Joined {formatRelative(t.created_at)}
                      </time>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Quick deployment" description="Go directly to your operational tools.">
          <div className="space-y-3">
            <QuickLink
              to="/platform/business-plans"
              title="Business plans"
              text="Manage platform packages and limits."
              icon={<Building2 />}
            />
            <QuickLink
              to="/platform/routers"
              title="Router fleet"
              text="Inspect devices and onboarding across tenants."
              icon={<Radio />}
            />
            <QuickLink
              to="/platform/payments"
              title="Payments"
              text="Review transactions and payment status."
              icon={<Wallet />}
            />
            <QuickLink
              to="/platform/staff"
              title="Staff access"
              text="Manage invitations and tenant service grants."
              icon={<Users />}
            />
            <QuickLink
              to="/platform/audit"
              title="Audit log"
              text="Review recorded platform activity."
              icon={<ShieldCheck />}
            />
          </div>
        </Section>
      </div>
      {(!stats.isError || s) && (
        <div className="overview-finance">
          {' '}
          <Section
            title="Payment overview"
            description="Cumulative successful payments in naira, kept separate by source."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <PaymentCard
                title="Voucher sales"
                value={s ? formatKobo(s.successful_payment_amount) : null}
                description="Customer purchases of internet access."
                to="/platform/payments?source=vouchers"
                icon={<Ticket />}
                loading={stats.isPending}
                prominent
              />
              <PaymentCard
                title="Agent wallet top-ups"
                value={s ? formatKobo(s.successful_wallet_funding_amount) : null}
                description="Successful funding of reseller wallets."
                to="/platform/payments?source=wallet"
                icon={<Wallet />}
                loading={stats.isPending}
              />
              <PaymentCard
                title="Subscriptions"
                value={s ? formatKobo(s.successful_subscription_amount) : null}
                description="Payments for operator platform plans."
                to="/platform/payments?source=subscriptions"
                icon={<Building2 />}
                loading={stats.isPending}
              />
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function PaymentCard({
  title,
  value,
  description,
  to,
  icon,
  loading,
  prominent = false,
}: {
  title: string;
  value: string | null;
  description: string;
  to: string;
  icon: ReactNode;
  loading: boolean;
  prominent?: boolean;
}) {
  return (
    <Card
      className={`min-w-0 rounded-2xl p-5 shadow-subtle ${prominent ? 'border-brand-200 bg-brand-50/50' : ''}`}
    >
      <div className="mb-4 flex items-center gap-2 text-brand-700">
        <span className="flex size-9 items-center justify-center rounded-xl bg-brand-100/70 [&>svg]:size-4">
          {icon}
        </span>
        <h3 className="text-sm font-medium">{title}</h3>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-36" />
      ) : (
        <p className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere] text-brand-950 tabular-nums">
          {value ?? '—'}
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-ink-500">{description}</p>
      <Link
        to={to}
        aria-label={`View ${title.toLowerCase()}`}
        className="mt-5 inline-flex items-center gap-2 rounded text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-brand-600"
      >
        View payments <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </Card>
  );
}

function QuickLink({
  to,
  title,
  text,
  icon,
}: {
  to: string;
  title: string;
  text: string;
  icon: ReactNode;
}) {
  return (
    <Link to={to} className="overview-quick-link">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-ink-600 group-hover:bg-brand-100 group-hover:text-brand-700 [&>svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-950">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-500">{text}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-400 group-hover:text-brand-600" aria-hidden />
    </Link>
  );
}
