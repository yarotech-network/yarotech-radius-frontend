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
import { Section, StatusBadge } from '@/components/layout';
import { Button, ButtonLink, Card, Skeleton, Stat } from '@/components/ui';
import { Alert, EmptyState, ErrorState } from '@/components/feedback';
import { formatKobo } from '@/lib/formatting/money';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { PLATFORM_RECENT_TENANTS_PARAMS, usePlatformStats, useTenants } from '../queries';
import '../platform-overview.css';

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
    <div className="platform-overview min-w-0 space-y-6">
      <header className="platform-overview-header">
        <div className="min-w-0">
          <span className="platform-eyebrow">
            <ShieldCheck size={14} aria-hidden /> Platform administration
          </span>
          <h1>Platform overview</h1>
          <p>Your operators, payments and network operations in one place.</p>
          <div className="platform-updated" role="status">
            <Clock3 size={14} aria-hidden />
            {s && stats.dataUpdatedAt
              ? `Figures retrieved ${formatRelative(new Date(stats.dataUpdatedAt))}`
              : 'Figures appear after loading'}
          </div>
        </div>
        <div className="platform-header-actions">
          <Button
            variant="secondary"
            disabled={refreshing}
            leadingIcon={
              <RefreshCw className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />
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
      </header>

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
            <div className="platform-kpis">
              <Stat
                label="Tenants"
                value={number(s?.tenants)}
                hint={s ? `${number(s.active_tenants)} active` : 'Registered businesses'}
                icon={<Building2 />}
                loading={stats.isPending}
                tone="default"
                className="platform-kpi"
              />
              <Stat
                label="Routers"
                value={number(s?.routers)}
                hint={s ? `${number(s.onboarded_routers)} onboarded` : 'Registered network devices'}
                icon={<Radio />}
                loading={stats.isPending}
                className="platform-kpi"
              />
              <Stat
                label="Agents"
                value={number(s?.agents)}
                hint="Resellers across all tenants"
                icon={<Users />}
                loading={stats.isPending}
                className="platform-kpi"
              />
              <Stat
                label="Vouchers issued"
                value={number(s?.vouchers)}
                hint="Total access vouchers"
                icon={<Ticket />}
                loading={stats.isPending}
                className="platform-kpi"
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
          {s && s.pending_payments === 0 && (
            <p className="platform-clear-note">
              <ShieldCheck size={16} aria-hidden />
              No pending voucher payments in the last retrieved figures.
            </p>
          )}
        </>
      )}

      {(!stats.isError || s) && (
        <div className="platform-finance">
          <Section
            title="Payment overview"
            description="All-time successful payments in NGN. These categories are separate and are not added into one revenue total."
          >
            <div className="grid gap-4 xl:grid-cols-3">
              <PaymentCard
                title="Subscriptions"
                value={s ? formatKobo(s.successful_subscription_amount) : null}
                description="Payments for operator platform plans."
                to="/platform/payments?source=subscriptions"
                icon={<Building2 />}
                loading={stats.isPending}
                prominent
              />
              <PaymentCard
                title="Voucher sales"
                value={s ? formatKobo(s.successful_payment_amount) : null}
                description="Customer purchases of internet access."
                to="/platform/payments?source=vouchers"
                icon={<Ticket />}
                loading={stats.isPending}
              />
              <PaymentCard
                title="Agent wallet top-ups"
                value={s ? formatKobo(s.successful_wallet_funding_amount) : null}
                description="Successful funding of reseller wallets."
                to="/platform/payments?source=wallet"
                icon={<Wallet />}
                loading={stats.isPending}
              />
            </div>
          </Section>
        </div>
      )}

      <div className="platform-workspace-grid">
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
            <div
              className="platform-table-scroll"
              role="region"
              aria-label="Recent tenant records"
              tabIndex={0}
            >
              <table className="platform-tenants-table">
                <caption className="sr-only">Newest tenants</caption>
                <thead>
                  <tr>
                    <th scope="col">Business</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="text-right">
                      Members
                    </th>
                    <th scope="col" className="text-right">
                      Vouchers
                    </th>
                    <th scope="col">Joined</th>
                    <th scope="col">
                      <span className="sr-only">Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recent.data?.results.map((t) => (
                    <tr key={t.id}>
                      <th scope="row">
                        <div className="platform-tenant-name">
                          <span className="platform-tenant-avatar" aria-hidden>
                            {t.name.trim().slice(0, 2).toUpperCase()}
                          </span>
                          <span className="min-w-0">
                            <Link to={`/platform/tenants/${t.id}`}>{t.name}</Link>
                            <span className="platform-tenant-slug">/s/{t.slug}</span>
                          </span>
                        </div>
                      </th>
                      <td>
                        <StatusBadge
                          status={t.is_active ? 'active' : 'inactive'}
                          size="sm"
                          className={t.is_active ? '' : 'bg-surface-muted'}
                        />
                      </td>
                      <td className="text-right tabular-nums">{number(t.member_count)}</td>
                      <td className="text-right tabular-nums">{number(t.voucher_count)}</td>
                      <td>
                        <time dateTime={t.created_at} title={formatDateTime(t.created_at)}>
                          {formatRelative(t.created_at)}
                        </time>
                      </td>
                      <td>
                        <Link
                          className="platform-row-action"
                          to={`/platform/tenants/${t.id}`}
                          aria-label={`View ${t.name}`}
                        >
                          <ArrowRight size={16} aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <Section
          title="Quick actions"
          description="Go directly to your operational tools."
          className="platform-quick-actions"
        >
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
    <Card className={`platform-payment-card ${prominent ? 'platform-payment-primary' : ''}`}>
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
    <Link to={to} className="platform-quick-link group">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-ink-600 group-hover:bg-brand-100 group-hover:text-brand-700 [&>svg]:size-5">
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
