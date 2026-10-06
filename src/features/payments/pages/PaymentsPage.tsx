import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Check, Copy, LifeBuoy, Receipt, RefreshCw } from 'lucide-react';
import { Badge, Button, ButtonLink, Card, Select } from '@/components/ui';
import { KpiTile, MiniBar } from '@/components/layout';
import { compactKobo } from '@/components/charts';
import { PaymentStatusBadge } from '@/features/payments/components/PaymentStatusBadge';
import { PaymentAttention } from '@/features/dashboard/components/PageMetrics';
import { useDashboardStats } from '@/features/dashboard/queries';
import { Alert, EmptyState } from '@/components/feedback';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatKobo } from '@/lib/formatting/money';
import { formatNumber } from '@/lib/formatting/units';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import type { PaymentListParams, PaymentStatus, PaymentTransaction } from '@/types/api';
import { PAYMENTS_DEFAULT_ORDERING, usePayments } from '../queries';
import { PAYMENT_STATUS_FILTERS } from '../paymentRules';
import { PaymentDrawer } from '../components/PaymentDrawer';

const FILTERS = ['status'] as const;

/** Headline money in whole naira; exact kobo values stay in the table and drawer. */
function wholeNaira(kobo: number) {
  return formatKobo(Math.round(kobo / 100) * 100, { compact: true });
}

export default function PaymentsPage() {
  const principal = usePrincipal();
  const [params, setParams] = useSearchParams();
  const list = useListParams(FILTERS, { ordering: PAYMENTS_DEFAULT_ORDERING });
  const debouncedSearch = useDebouncedValue(list.state.search);
  const selectedId = Number(params.get('payment')) || null;
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const copyRef = (ref: string) => {
    void navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const query = usePayments(
    useMemo(() => {
      const p: PaymentListParams = { page: list.state.page, page_size: list.state.page_size };
      if (debouncedSearch) p.search = debouncedSearch;
      if (list.state.ordering) p.ordering = list.state.ordering;
      if (list.state.filters.status) p.status = list.state.filters.status as PaymentStatus;
      return p;
    }, [list.state, debouncedSearch]),
  );

  // Workspace-wide figures, independent of the list filters below.
  const statsAllowed = can(principal, 'payments.view') && can(principal, 'dashboard.view');
  const stats = useDashboardStats(statsAllowed);
  const s = stats.data;
  const success = s?.successful_payments ?? 0;
  const failed = s?.failed_payments ?? 0;
  const pending = s?.pending_payments ?? 0;
  const settled = success + failed;

  function select(id: number | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('payment', String(id));
        else next.delete('payment');
        return next;
      },
      { replace: true },
    );
  }

  const columns: Column<PaymentTransaction>[] = [
    {
      key: 'reference',
      header: 'Customer',
      primary: true,
      cell: (p) => {
        const label =
          p.customer_email || p.customer_name || p.customer_phone || 'No contact provided';
        return (
          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                select(p.id);
              }}
              className="dashboard-data-link text-left text-sm font-semibold break-all"
            >
              {label}
            </button>
            <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-500">
              <code className="font-mono break-all">{p.reference}</code>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  copyRef(p.reference);
                }}
                title="Copy reference"
                aria-label={`Copy reference ${p.reference}`}
                className="inline-flex size-5 shrink-0 items-center justify-center rounded text-ink-400 transition hover:bg-surface-muted hover:text-ink-700"
              >
                {copiedRef === p.reference ? (
                  <Check className="size-3 text-success-600" aria-hidden />
                ) : (
                  <Copy className="size-3" aria-hidden />
                )}
              </button>
            </div>
          </div>
        );
      },
    },
    {
      key: 'plan',
      header: 'Plan',
      hideBelow: 'md',
      cell: (p) =>
        p.plan_name ? (
          <span className="text-sm text-ink-700">{p.plan_name}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (p) => (
        <span className="font-semibold text-ink-900 tabular-nums">{formatKobo(p.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (p) => (
        <PaymentStatusBadge
          displayStatusCode={p.display_status_code}
          displayStatusLabel={p.display_status_label}
          status={p.status}
          size="sm"
          dot
        />
      ),
    },
    {
      key: 'voucher',
      header: 'Voucher',
      hideBelow: 'md',
      cell: (p) =>
        p.voucher_username ? (
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs font-semibold break-all text-ink-700">
            {p.voucher_username}
          </code>
        ) : p.status === 'success' && !p.voucher ? (
          <Badge tone="warning" size="sm">
            Paid, no voucher
          </Badge>
        ) : (
          <span className="text-xs text-ink-400">
            {p.voucher ? 'Voucher linked' : 'Not issued'}
          </span>
        ),
    },
    {
      key: 'created',
      header: 'Created',
      hideBelow: 'lg',
      sortField: 'created_at',
      cell: (p) => (
        <time
          dateTime={p.created_at}
          title={formatDateTime(p.created_at)}
          className="text-xs whitespace-nowrap text-ink-600"
        >
          {formatDateTime(p.created_at)}
        </time>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Financial transactions</p>
          <h1 className="text-2xl font-bold text-ink-900">Customer payments</h1>
          <p className="mt-1 text-sm text-ink-500">
            Purchases made through your storefront and online payment gateways.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={query.isFetching}
            leadingIcon={
              <RefreshCw
                className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
              />
            }
            onClick={() => {
              void query.refetch();
              if (statsAllowed) void stats.refetch();
            }}
          >
            {query.isFetching ? 'Refreshing...' : 'Refresh payments'}
          </Button>
          {can(principal, 'payments.recovery.view') && (
            <ButtonLink
              to="/payments/recovery"
              variant="secondary"
              size="sm"
              leadingIcon={<LifeBuoy className="size-4" aria-hidden />}
            >
              Payment recovery
            </ButtonLink>
          )}
        </div>
      </header>

      {statsAllowed && <PaymentAttention count={s?.paid_unfulfilled_payments} />}
      {statsAllowed && stats.isError && (
        <Alert tone="warning" title="Payment figures unavailable">
          {s ? 'Showing the last successful figures.' : 'Unavailable does not mean zero.'}
        </Alert>
      )}

      {statsAllowed && (
        <section aria-label="Payment summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiTile
            label="Collected today"
            value={s?.collected_revenue ? wholeNaira(s.collected_revenue.today) : 'Unavailable'}
            detail={
              s?.collected_revenue
                ? `${wholeNaira(s.collected_revenue.month)} this month`
                : 'Recorded collections since midnight'
            }
            loading={stats.isPending}
          />
          <KpiTile
            label="Collected all time"
            value={s?.collected_revenue ? wholeNaira(s.collected_revenue.total) : 'Unavailable'}
            detail={
              s?.revenue_sources
                ? `Online ${compactKobo(s.revenue_sources.online)} · Agents ${compactKobo(s.revenue_sources.agent_wallet)} · Repaid ${compactKobo(s.revenue_sources.agent_credit_repayments)}`
                : 'Online, agent wallet and credit repayments'
            }
            loading={stats.isPending}
          />
          <KpiTile
            label="Success rate"
            value={
              !s ? 'Unavailable' : settled > 0 ? `${Math.round((success / settled) * 100)}%` : '—'
            }
            detail={
              s
                ? `${formatNumber(success)} successful · ${formatNumber(failed)} failed`
                : 'Of settled online payments'
            }
            extra={
              s && success + failed + pending > 0 ? (
                <MiniBar
                  parts={[
                    { value: success, color: 'var(--color-success-600)' },
                    { value: pending, color: 'var(--color-warning-600)' },
                    { value: failed, color: 'var(--color-danger-600)' },
                  ]}
                />
              ) : undefined
            }
            loading={stats.isPending}
          />
          <KpiTile
            label="Pending"
            value={s ? formatNumber(pending) : 'Unavailable'}
            detail="Awaiting confirmation from the provider"
            to="/payments?status=pending"
            link="View pending payments"
            loading={stats.isPending}
          />
        </section>
      )}

      <Card className="space-y-5 p-5 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="payment-history-title" className="text-lg font-semibold text-ink-900">
              Payment history
            </h2>
            <p className="text-xs text-ink-500">
              Every online purchase and its voucher fulfilment. Select a row for full details.
            </p>
          </div>
          <p role="status" className="text-xs text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${formatNumber(query.data.count)} payments in this view`
                : query.isError
                  ? 'Payment count unavailable'
                  : 'Loading payments...'}
          </p>
        </div>

        <FilterBar
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search reference, email or name"
              ariaLabel="Search payments"
            />
          }
          filters={
            <div className="w-full sm:w-44">
              <Select
                aria-label="Status"
                size="sm"
                value={list.state.filters.status ?? ''}
                onChange={(e) => list.setFilter('status', e.target.value || undefined)}
                options={PAYMENT_STATUS_FILTERS}
              />
            </div>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />

        {query.isError && query.data && (
          <Alert tone="warning" title="Payments could not be refreshed">
            Showing the last loaded transactions. Refresh again to check for changes.
          </Alert>
        )}

        <DataTable
          caption="Payments"
          columns={columns}
          rows={query.data?.results}
          rowKey={(p) => p.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          ordering={list.state.ordering}
          onOrderingChange={list.setOrdering}
          onRowClick={(p) => select(p.id)}
          empty={
            list.activeFilterCount > 0 ? (
              <EmptyState
                icon={<Receipt className="size-6" aria-hidden />}
                title="No payments match"
                description="Try another status or search term."
                action={
                  <Button variant="secondary" onClick={list.clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Receipt className="size-6" aria-hidden />}
                title="No payments yet"
                description="Purchases made on your storefront will be listed here."
              />
            )
          }
        />

        {query.data && query.data.count > 0 && (
          <Pagination
            count={query.data.count}
            page={list.state.page}
            totalPages={query.data.total_pages}
            pageSize={list.state.page_size}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            itemLabel="payments"
          />
        )}
      </Card>

      <PaymentDrawer paymentId={selectedId} onClose={() => select(null)} />
    </div>
  );
}
