import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { usePrincipal } from '@/app/auth/useAuth';
import { can, workspaceName } from '@/services/auth/principal';
import { Button, Card, Stat } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { formatKobo } from '@/lib/formatting/money';
import { formatNumber } from '@/lib/formatting/units';
import { formatDateTime } from '@/lib/formatting/dates';
import { paymentsListQuery } from '@/features/payments/queries';
import { PaymentStatusBadge } from '@/features/payments/components/PaymentStatusBadge';
import { useDashboardStats, useNetworkSummary } from '../queries';
import { PaymentAttention } from '../components/PageMetrics';

export default function DashboardPage() {
  const principal = usePrincipal();
  const paymentsAllowed = can(principal, 'payments.view');
  const vouchersAllowed = can(principal, 'vouchers.view') && can(principal, 'dashboard.view');
  const collectionsAllowed = paymentsAllowed && can(principal, 'dashboard.view');
  const sessionsAllowed = can(principal, 'sessions.view');
  const routersAllowed = can(principal, 'routers.view') && sessionsAllowed;
  const stats = useDashboardStats(collectionsAllowed || vouchersAllowed);
  const network = useNetworkSummary(true, sessionsAllowed || routersAllowed);
  const tenant =
    principal.kind === 'member'
      ? principal.tenantId
      : principal.kind === 'platform_staff'
        ? principal.activeTenantId
        : null;
  const paymentOptions = paymentsListQuery({ page: 1, page_size: 5, ordering: '-created_at' });
  const recent = useQuery({
    ...paymentOptions,
    queryKey: [...paymentOptions.queryKey, principal.user.id, tenant],
    enabled: paymentsAllowed,
  });
  const s = collectionsAllowed || vouchersAllowed ? stats.data : undefined;
  const n = sessionsAllowed ? network.data : undefined;
  const refresh = () => {
    if (collectionsAllowed || vouchersAllowed) void stats.refetch();
    if (sessionsAllowed || routersAllowed) void network.refetch();
    if (paymentsAllowed) void recent.refetch();
  };
  const cards = [
    {
      show: vouchersAllowed,
      label: "Today's activated-voucher revenue",
      value: s?.activated_voucher_revenue
        ? formatKobo(s.activated_voucher_revenue.totals.today.amount)
        : 'Unavailable',
      hint: 'First activation today; service value, not cash collected.',
      to: '/vouchers#voucher-revenue',
      link: 'View voucher revenue',
      loading: stats.isPending,
    },
    {
      show: collectionsAllowed,
      label: "Today's collections",
      value: s?.collected_revenue ? formatKobo(s.collected_revenue.today) : 'Unavailable',
      hint: 'Recorded collections today.',
      to: '/payments',
      link: 'View payments',
      loading: stats.isPending,
    },
    {
      show: sessionsAllowed,
      label: 'Online users now',
      value: n ? formatNumber(n.online_users) : 'Unavailable',
      hint: 'Fresh RADIUS accounting observations.',
      to: '/sessions',
      link: 'View live sessions',
      loading: network.isPending,
    },
    {
      show: routersAllowed,
      label: 'Router health',
      value: n ? `${formatNumber(n.router_counts.online)} online` : 'Unavailable',
      hint: n
        ? `${formatNumber(n.router_counts.offline)} confirmed offline / ${formatNumber(n.router_counts.unknown)} unknown`
        : 'Observations unavailable; unknown does not mean offline.',
      to: '/routers',
      link: 'View routers',
      loading: network.isPending,
    },
  ];
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Workspace overview</p>
          <h1 className="text-2xl font-bold text-ink-900">
            {workspaceName(principal) || 'Dashboard'}
          </h1>
        </div>
        <Button
          variant="secondary"
          disabled={stats.isFetching || network.isFetching || recent.isFetching}
          onClick={refresh}
        >
          Refresh dashboard
        </Button>
      </header>
      <PaymentAttention count={s?.paid_unfulfilled_payments} />
      {(collectionsAllowed || vouchersAllowed) && stats.isError && (
        <Alert tone="warning" title="Business figures unavailable">
          {s ? 'Showing the last successful figures.' : 'Unavailable does not mean zero.'} Use
          Refresh dashboard to retry.
        </Alert>
      )}
      {sessionsAllowed && network.isError && (
        <Alert tone="warning" title="Network figures unavailable">
          {n ? 'Showing the last successful observation.' : 'No current observation is available.'}{' '}
          Unknown status is not proof a router is offline.
        </Alert>
      )}
      <section
        aria-label="Dashboard summaries"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {cards
          .filter((card) => card.show)
          .map((card) => (
            <Card key={card.label} className="flex min-w-0 flex-col gap-3">
              <Stat
                className="border-0 bg-transparent p-0"
                label={card.label}
                value={card.value}
                hint={card.hint}
                loading={card.loading}
              />
              <Link className="dashboard-data-link mt-auto text-sm font-semibold" to={card.to}>
                {card.link}
              </Link>
            </Card>
          ))}
      </section>
      {(s?.observed_at || n?.observed_at) && (
        <p className="text-xs text-ink-500">
          {s?.observed_at && `Business figures: ${formatDateTime(s.observed_at)}`}
          {s?.observed_at && n?.observed_at && ' / '}
          {n?.observed_at && `Network observed: ${formatDateTime(n.observed_at)}`}
        </p>
      )}
      {paymentsAllowed && (
        <section aria-labelledby="recent-payments-title" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="recent-payments-title" className="text-lg font-semibold">
              Recent customer payments
            </h2>
            <Link className="dashboard-data-link" to="/payments">
              View all payments
            </Link>
          </div>
          {recent.isPending && <p role="status">Loading recent payments...</p>}
          {recent.isError && (
            <Alert tone="warning" title="Recent payments unavailable">
              {recent.data
                ? 'Showing the last successful results.'
                : 'Payment history could not be loaded.'}{' '}
              <button type="button" className="underline" onClick={() => void recent.refetch()}>
                Retry payments
              </button>
            </Alert>
          )}
          {recent.data?.count === 0 && (
            <p className="text-sm text-ink-500">No customer payments yet.</p>
          )}
          {!!recent.data?.results.length && (
            <div role="region" aria-label="Recent payments table" tabIndex={0} className="overflow-x-auto rounded-xl border border-border bg-surface focus-visible:outline-2 focus-visible:outline-brand-600">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Five most recent customer payments</caption>
                <thead>
                  <tr>
                    {['Customer email', 'Amount', 'Status', 'Created'].map((label) => (
                      <th key={label} scope="col" className="p-3">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.data.results.slice(0, 5).map((payment) => (
                    <tr key={payment.id} className="border-t border-border">
                      <td className="p-3">
                        <Link
                          className="dashboard-data-link break-all"
                          to={`/payments/${payment.id}`}
                        >
                          {payment.customer_email || 'Email not provided'}
                        </Link>
                      </td>
                      <td className="p-3 whitespace-nowrap">{formatKobo(payment.amount)}</td>
                      <td className="p-3">
                        <PaymentStatusBadge
                          status={payment.status}
                          displayStatusCode={payment.display_status_code}
                          displayStatusLabel={payment.display_status_label}
                        />
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <time dateTime={payment.created_at}>
                          {formatDateTime(payment.created_at)}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
