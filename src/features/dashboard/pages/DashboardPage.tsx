import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { can, workspaceName } from '@/services/auth/principal';
import { Button, Card, CardHeader } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { formatKobo } from '@/lib/formatting/money';
import { formatNumber } from '@/lib/formatting/units';
import { formatDateTime } from '@/lib/formatting/dates';
import { cn } from '@/lib/utilities/cn';
import { paymentsListQuery } from '@/features/payments/queries';
import { PaymentStatusBadge } from '@/features/payments/components/PaymentStatusBadge';
import { fetchReport, type ReportParams } from '@/features/reports/api';
import { useDashboardStats, useNetworkSummary } from '../queries';
import { PaymentAttention } from '../components/PageMetrics';
import { KpiGroup, KpiTile, MiniBar } from '@/components/layout';
import {
  LiveNetwork,
  PaymentsHealth,
  RevenueByChannel,
  RevenueTrend,
  RouterHealth,
  VoucherInventory,
} from '../components/HubSections';
import { routerStatusParts, wholeNaira } from '../components/hubData';

const TREND_PARAMS: ReportParams = { period: 'last_30_days', group_by: 'day' };

export default function DashboardPage() {
  const principal = usePrincipal();
  const paymentsAllowed = can(principal, 'payments.view');
  const vouchersAllowed = can(principal, 'vouchers.view') && can(principal, 'dashboard.view');
  const collectionsAllowed = paymentsAllowed && can(principal, 'dashboard.view');
  const sessionsAllowed = can(principal, 'sessions.view');
  const routersAllowed = can(principal, 'routers.view') && sessionsAllowed;
  const trendAllowed = can(principal, 'reports.view');
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
  // Same key as the Reports page, so the two share one cached report.
  const trend = useQuery({
    queryKey: ['tenant-reports', principal.user.id, tenant, TREND_PARAMS],
    queryFn: () => fetchReport(TREND_PARAMS),
    enabled: trendAllowed,
    staleTime: 60_000,
  });
  const s = collectionsAllowed || vouchersAllowed ? stats.data : undefined;
  const n = sessionsAllowed ? network.data : undefined;
  const recentRows = trend.data?.rows.slice(-14);
  const refresh = () => {
    if (collectionsAllowed || vouchersAllowed) void stats.refetch();
    if (sessionsAllowed || routersAllowed) void network.refetch();
    if (paymentsAllowed) void recent.refetch();
    if (trendAllowed) void trend.refetch();
  };
  const fetching = stats.isFetching || network.isFetching || recent.isFetching || trend.isFetching;
  const revenue = s?.activated_voucher_revenue;
  const usage = s?.voucher_usage;
  const revenueTiles = [
    {
      show: vouchersAllowed,
      label: "Today's activated-voucher revenue",
      value: revenue ? wholeNaira(revenue.totals.today.amount) : 'Unavailable',
      detail: revenue
        ? `${formatNumber(revenue.totals.today.vouchers)} first activations · service value, not cash`
        : 'First activation today; service value, not cash collected.',
      trend: recentRows?.map((row) => row.activated_value),
      to: '/vouchers#voucher-revenue',
      link: 'View voucher revenue',
      loading: stats.isPending,
    },
    {
      show: collectionsAllowed,
      label: "Today's collections",
      value: s?.collected_revenue ? wholeNaira(s.collected_revenue.today) : 'Unavailable',
      detail: 'Money recorded today from all channels',
      trend: recentRows?.map((row) => row.collections),
      to: '/payments',
      link: 'View payments',
      loading: stats.isPending,
    },
    {
      show: collectionsAllowed,
      label: 'Collected this month',
      value: s?.collected_revenue ? wholeNaira(s.collected_revenue.month) : 'Unavailable',
      detail: revenue
        ? `${wholeNaira(revenue.totals.month.amount)} activated value this month`
        : 'Month to date, recorded collections',
      to: trendAllowed ? '/reports?period=this_month&group_by=day' : '/payments',
      link: trendAllowed ? "Open this month's report" : 'View payments this month',
      loading: stats.isPending,
    },
    {
      show: collectionsAllowed,
      label: 'Total revenue, all time',
      value: s?.collected_revenue ? wholeNaira(s.collected_revenue.total) : 'Unavailable',
      detail: revenue
        ? `${wholeNaira(revenue.totals.total.amount)} activated value all time`
        : 'All money recorded since the workspace started',
      to: trendAllowed ? '/reports' : '/payments',
      link: trendAllowed ? 'Open revenue reports' : 'View all payments history',
      loading: stats.isPending,
    },
  ];
  const operationsTiles = [
    {
      show: sessionsAllowed,
      label: 'Online users now',
      value: n ? formatNumber(n.online_users) : 'Unavailable',
      detail: n
        ? `${formatNumber(n.sessions_today)} sessions today`
        : 'Fresh RADIUS accounting observations.',
      live: Boolean(n && n.online_users > 0),
      to: '/sessions',
      link: 'View live sessions',
      loading: network.isPending,
    },
    {
      show: routersAllowed,
      label: 'Router health',
      value: n ? `${formatNumber(n.router_counts.online)} online` : 'Unavailable',
      detail: n
        ? `${formatNumber(n.router_counts.offline)} confirmed offline / ${formatNumber(n.router_counts.unknown)} unknown`
        : 'Observations unavailable; unknown does not mean offline.',
      extra: n ? <MiniBar parts={routerStatusParts(n)} /> : undefined,
      to: '/routers',
      link: 'View routers',
      loading: network.isPending,
    },
    {
      show: vouchersAllowed && Boolean(usage),
      label: 'Vouchers in use',
      value: usage ? formatNumber(usage.active ?? 0) : 'Unavailable',
      detail: usage
        ? `${formatNumber(usage.not_started ?? 0)} ready to sell · ${formatNumber(s?.vouchers_issued_today ?? 0)} issued today`
        : 'Vouchers with a started session',
      to: '/vouchers',
      link: 'View voucher inventory',
      loading: stats.isPending,
    },
  ];
  // Layout follows permissions, not data arrival, so cards never jump between columns.
  const showTrend = trendAllowed;
  const showChannels = vouchersAllowed;

  return (
    <div className="viz space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Workspace overview</p>
          <h1 className="text-2xl font-bold text-ink-900">
            {workspaceName(principal) || 'Dashboard'}
          </h1>
          {(s?.observed_at || n?.observed_at) && (
            <p className="mt-1 text-xs text-ink-500">
              {s?.observed_at && `Business figures: ${formatDateTime(s.observed_at)}`}
              {s?.observed_at && n?.observed_at && ' / '}
              {n?.observed_at && `Network observed: ${formatDateTime(n.observed_at)}`}
            </p>
          )}
        </div>
        <Button variant="secondary" size="sm" disabled={fetching} onClick={refresh}>
          <RefreshCw aria-hidden className={cn('size-4', fetching && 'animate-spin')} />
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

      <KpiGroup label="Revenue">
        {revenueTiles
          .filter((tile) => tile.show)
          .map(({ show: _show, ...tile }) => (
            <KpiTile key={tile.label} {...tile} />
          ))}
      </KpiGroup>
      <KpiGroup label="Network & operations">
        {operationsTiles
          .filter((tile) => tile.show)
          .map(({ show: _show, ...tile }) => (
            <KpiTile key={tile.label} {...tile} />
          ))}
      </KpiGroup>

      {(showTrend || showChannels) && (
        <div className={cn('grid gap-4', showTrend && showChannels && 'xl:grid-cols-3')}>
          {showTrend && (
            <div className={cn('min-w-0', showChannels && 'xl:col-span-2')}>
              <RevenueTrend report={trend.data} failed={trend.isError} />
            </div>
          )}
          {showChannels && <RevenueByChannel revenue={revenue} failed={stats.isError} />}
        </div>
      )}

      {n && (routersAllowed || sessionsAllowed) && (
        <div className={cn('grid gap-4', routersAllowed && sessionsAllowed && 'lg:grid-cols-2')}>
          {routersAllowed && <RouterHealth network={n} />}
          {sessionsAllowed && <LiveNetwork network={n} />}
        </div>
      )}

      {s && ((vouchersAllowed && s.voucher_usage) || collectionsAllowed) && (
        <div
          className={cn(
            'grid gap-4',
            vouchersAllowed && s.voucher_usage && collectionsAllowed && 'lg:grid-cols-2',
          )}
        >
          {vouchersAllowed && s.voucher_usage && (
            <VoucherInventory usage={s.voucher_usage} issuedToday={s.vouchers_issued_today} />
          )}
          {collectionsAllowed && <PaymentsHealth stats={s} />}
        </div>
      )}

      {paymentsAllowed && (
        <Card padded={false} className="min-w-0">
          <section aria-labelledby="recent-payments-title">
            <CardHeader
              className="mb-0 p-4 sm:p-5"
              title={<span id="recent-payments-title">Recent customer payments</span>}
              actions={
                <Link className="dashboard-data-link text-sm font-semibold" to="/payments">
                  View all payments
                </Link>
              }
            />
            {recent.isPending && (
              <p role="status" className="px-5 pb-5 text-sm text-ink-500">
                Loading recent payments...
              </p>
            )}
            {recent.isError && (
              <div className="px-4 pb-4 sm:px-5">
                <Alert tone="warning" title="Recent payments unavailable">
                  {recent.data
                    ? 'Showing the last successful results.'
                    : 'Payment history could not be loaded.'}{' '}
                  <button type="button" className="underline" onClick={() => void recent.refetch()}>
                    Retry payments
                  </button>
                </Alert>
              </div>
            )}
            {recent.data?.count === 0 && (
              <p className="px-5 pb-5 text-sm text-ink-500">No customer payments yet.</p>
            )}
            {!!recent.data?.results.length && (
              <div
                role="region"
                aria-label="Recent payments table"
                tabIndex={0}
                className="overflow-x-auto border-t border-border focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Five most recent customer payments</caption>
                  <thead>
                    <tr className="text-xs text-ink-500">
                      {['Customer email', 'Amount', 'Status', 'Created'].map((label) => (
                        <th key={label} scope="col" className="px-5 py-2.5 font-medium">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recent.data.results.slice(0, 5).map((payment) => (
                      <tr key={payment.id} className="border-t border-border">
                        <td className="px-5 py-3">
                          <Link
                            className="dashboard-data-link break-all"
                            to={`/payments/${payment.id}`}
                          >
                            {payment.customer_email || 'Email not provided'}
                          </Link>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap tabular">
                          {formatKobo(payment.amount)}
                        </td>
                        <td className="px-5 py-3">
                          <PaymentStatusBadge
                            status={payment.status}
                            displayStatusCode={payment.display_status_code}
                            displayStatusLabel={payment.display_status_label}
                          />
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-ink-600">
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
        </Card>
      )}
    </div>
  );
}
