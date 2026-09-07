import { Link } from 'react-router';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Banknote,
  Layers,
  Radio,
  RefreshCw,
  ShoppingBag,
  Ticket,
  Users,
} from 'lucide-react';
import { PageHeader, Section } from '@/components/layout';
import { Button, ButtonLink, Card, Skeleton, Stat } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { formatKobo } from '@/lib/formatting/money';
import { formatNumber } from '@/lib/formatting/units';
import { formatRelative } from '@/lib/formatting/dates';
import { can, workspaceName } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import { DASHBOARD_LIVE_PARAMS, useDashboardStats, useLiveUsers } from '../queries';

export default function DashboardPage() {
  const principal = usePrincipal();
  const stats = useDashboardStats();
  const canSessions = can(principal, 'sessions.view');
  const live = useLiveUsers(DASHBOARD_LIVE_PARAMS, { live: canSessions, enabled: canSessions });
  const name = workspaceName(principal);
  const s = stats.data;
  const refreshing = stats.isFetching || (canSessions && live.isFetching);
  const metricClass = 'min-w-0 rounded-2xl p-5 shadow-subtle [overflow-wrap:anywhere]';

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title={name ? `${name} overview` : 'Overview'}
        description="Your hotspot business, customer payments and network at a glance."
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
                if (canSessions) void live.refetch();
              }}
            >
              {refreshing ? 'Refreshing…' : 'Refresh overview'}
            </Button>
            {can(principal, 'vouchers.generate') && (
              <ButtonLink to="/vouchers/generate" leadingIcon={<Ticket />}>
                Generate vouchers
              </ButtonLink>
            )}
          </div>
        }
      />


      {s && s.paid_unfulfilled_payments > 0 && can(principal, 'payments.recovery.view') && (
        <Alert
          tone="warning"
          title={`${s.paid_unfulfilled_payments} paid ${s.paid_unfulfilled_payments === 1 ? 'order has' : 'orders have'} no voucher yet`}
          actions={
            <ButtonLink to="/payments/recovery" size="sm" variant="secondary">
              Review
            </ButtonLink>
          }
        >
          Customers have paid and still need their access code. Review delivery and the available
          recovery actions.
        </Alert>
      )}

      {stats.isError && !s ? (
        <ErrorState
          error={stats.error}
          onRetry={() => void stats.refetch()}
          title="Dashboard could not be loaded"
        />
      ) : (
        <>
          {stats.isError && s && (
            <Alert tone="warning" title="Business figures could not be refreshed">
              Showing the last observed figures. Refresh to try again.
            </Alert>
          )}
          <Section
            title="Business overview"
            description="Cumulative sales and the current state of your workspace."
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
              <Card className="flex min-w-0 flex-col justify-between rounded-2xl border-brand-950 bg-brand-950 p-5 text-white sm:p-6">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-medium text-brand-100">Revenue</h3>
                    <span className="rounded-xl bg-white/10 p-2.5">
                      <Banknote className="size-5 text-brand-200" aria-hidden />
                    </span>
                  </div>
                  {stats.isPending ? (
                    <Skeleton className="mt-5 h-10 w-48 bg-white/20" />
                  ) : (
                    <p className="mt-5 text-3xl font-semibold tracking-tight [overflow-wrap:anywhere] tabular-nums">
                      {s ? formatKobo(s.total_revenue) : '—'}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-brand-200">Successful online payments</p>
                  <p className="mt-1 text-xs text-brand-300">Cumulative total · Nigerian naira</p>
                </div>
                {can(principal, 'payments.view') && (
                  <Link
                    to="/payments"
                    className="mt-6 inline-flex w-fit items-center gap-2 rounded text-sm font-medium text-white underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-white"
                  >
                    View payments <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </Card>
              <div className="grid min-w-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2">
                <Stat
                  label="Active vouchers"
                  value={s ? formatNumber(s.active_vouchers) : '—'}
                  hint={s ? `of ${formatNumber(s.total_vouchers)} issued` : undefined}
                  icon={<Ticket />}
                  loading={stats.isPending}
                  className={metricClass}
                />
                <Stat
                  label="Routers"
                  value={
                    s ? `${formatNumber(s.active_routers)}/${formatNumber(s.total_routers)}` : '—'
                  }
                  hint="Active / registered"
                  icon={<Radio />}
                  loading={stats.isPending}
                  className={metricClass}
                />
                <Stat
                  label="Agents"
                  value={s ? formatNumber(s.total_agents) : '—'}
                  hint="Resellers in your workspace"
                  icon={<Users />}
                  loading={stats.isPending}
                  className={metricClass}
                />
                <Stat
                  label="Pending payments"
                  value={s ? formatNumber(s.pending_payments) : '—'}
                  hint="Awaiting confirmation"
                  icon={<AlertTriangle />}
                  loading={stats.isPending}
                  tone={s && s.pending_payments > 0 ? 'warning' : 'default'}
                  className={metricClass}
                />
              </div>
            </div>
          </Section>
        </>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Section
          title="Network activity"
          description="Live sessions are checked separately from business totals."
        >
          <Card className="min-w-0 space-y-4 rounded-2xl">
            <Stat
              label="Online now"
              value={!canSessions ? 'n/a' : live.data ? formatNumber(live.data.count) : '—'}
              hint={
                !canSessions
                  ? 'No access'
                  : live.data
                    ? `Observed ${formatRelative(live.data.observed_at)}`
                    : live.isError
                      ? 'Currently unavailable'
                      : 'Loading live sessions'
              }
              icon={<Activity />}
              loading={canSessions && live.isPending}
              className="border-0 bg-surface-muted [overflow-wrap:anywhere]"
            />
            {canSessions && live.isError && (
              <Alert
                tone="warning"
                title="Live sessions could not be refreshed"
                actions={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void live.refetch()}
                    disabled={live.isFetching}
                  >
                    Retry live sessions
                  </Button>
                }
              >
                {live.data
                  ? 'The count above is from the last successful check.'
                  : 'The current online count is unavailable. This does not mean nobody is connected.'}
              </Alert>
            )}
            {canSessions ? (
              <ButtonLink to="/sessions" variant="secondary" trailingIcon={<ArrowRight />}>
                View live sessions
              </ButtonLink>
            ) : (
              <p className="text-sm text-ink-500">
                Your account does not have access to live sessions in this workspace.
              </p>
            )}
          </Card>
        </Section>
        {can(principal, 'settings.profile') && (
          <Section
            title="Your customer storefront"
            description="Help customers find and buy your internet plans."
          >
            <Card className="rounded-2xl border-brand-100 bg-brand-50/40 p-5">
              <span className="mb-4 inline-flex size-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <ShoppingBag className="size-5" aria-hidden />
              </span>
              <h3 className="font-semibold text-brand-950">Make your plans easy to find</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">
                Open Storefront to copy your customer link, preview available plans and access your
                business and payment settings.
              </p>
              <ButtonLink to="/storefront" className="mt-5" trailingIcon={<ArrowRight />}>
                Manage storefront
              </ButtonLink>
            </Card>
          </Section>
        )}
      </div>

      <Section title="Workspace shortcuts" description="Open the tools available to your role.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {can(principal, 'vouchers.view') && (
            <QuickLink
              to="/vouchers"
              icon={<Ticket />}
              title="Vouchers"
              description="Find access codes, check status and view available actions."
            />
          )}
          {can(principal, 'plans.view') && (
            <QuickLink
              to="/plans"
              icon={<Layers />}
              title="Internet plans"
              description="Review prices, speeds and durations customers can buy."
            />
          )}
          {can(principal, 'routers.view') && (
            <QuickLink
              to="/routers"
              icon={<Radio />}
              title="Routers"
              description="Inspect your registered devices and connection details."
            />
          )}
          {can(principal, 'agents.manage') && (
            <QuickLink
              to="/agents"
              icon={<Users />}
              title="Agents"
              description="Manage the resellers serving your customers."
            />
          )}
          {can(principal, 'payments.view') && (
            <QuickLink
              to="/payments"
              icon={<Banknote />}
              title="Payments"
              description="Track customer transactions and payment status."
            />
          )}
        </div>
      </Section>
    </div>
  );
}

function QuickLink({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-subtle transition-colors hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 [&>svg]:size-5">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-950">{title}</span>
        <span className="mt-1 block text-xs leading-relaxed text-ink-500">{description}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-400 group-hover:text-brand-600" aria-hidden />
    </Link>
  );
}
