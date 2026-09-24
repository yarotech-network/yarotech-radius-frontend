import { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CreditCard, RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/layout';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { Button, Select, Tabs } from '@/components/ui';
import { Alert, EmptyState } from '@/components/feedback';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatKobo } from '@/lib/formatting/money';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import type {
  PaymentListParams,
  PaymentStatus,
  PaymentTransaction,
  PlatformSubscriptionPayment,
  PlatformWalletPayment,
  PlatformWalletPaymentListParams,
  SubscriptionPaymentListParams,
} from '@/types/api';
import { usePricing } from '@/features/settings/queries';
import {
  usePlatformPayments,
  usePlatformSubscriptionPayments,
  usePlatformWalletPayments,
  useTenantName,
} from '../queries';
import { TenantSelect } from '../components/TenantSelect';

import '../platform-payments.css';

type Source = 'vouchers' | 'wallet' | 'subscriptions';
const SOURCES: { value: Source; label: string }[] = [
  { value: 'vouchers', label: 'Voucher sales' },
  { value: 'wallet', label: 'Agent wallet top-ups' },
  { value: 'subscriptions', label: 'Subscriptions' },
];
const FILTERS = ['tenant', 'status'] as const;
const STATUSES: readonly string[] = ['pending', 'success', 'failed', 'abandoned'];

function sourceFrom(raw: string | null): Source {
  return raw === 'wallet' || raw === 'subscriptions' ? raw : 'vouchers';
}

/** `/platform/payments` — money across all tenants, split by source (three read-only endpoints). */
export default function PlatformPaymentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const source = sourceFrom(searchParams.get('source'));
  const list = useListParams(FILTERS);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const tenantName = useTenantName();
  const pricing = usePricing();
  useEffect(() => {
    document.title = 'Payments · Platform · Yarotech RADIUS';
  }, []);

  function setSource(next: Source) {
    const params = new URLSearchParams(searchParams);
    if (next === 'vouchers') params.delete('source');
    else params.set('source', next);
    params.delete('page');
    params.delete('search');
    // "abandoned" only exists for voucher sales.
    if (next !== 'vouchers' && params.get('status') === 'abandoned') params.delete('status');
    setSearchParams(params, { replace: true });
  }

  const { page, page_size: pageSize } = list.state;
  const tenant = Number(list.state.filters.tenant);
  const tenantId = Number.isInteger(tenant) && tenant > 0 ? tenant : undefined;
  const status = STATUSES.includes(list.state.filters.status ?? '')
    ? (list.state.filters.status as PaymentStatus)
    : undefined;

  const voucherParams = useMemo<PaymentListParams>(() => {
    const p: PaymentListParams = { page, page_size: pageSize };
    if (debouncedSearch) p.search = debouncedSearch;
    if (tenantId) p.tenant = tenantId;
    if (status) p.status = status;
    return p;
  }, [page, pageSize, debouncedSearch, tenantId, status]);
  const walletParams = useMemo<PlatformWalletPaymentListParams>(() => {
    const p: PlatformWalletPaymentListParams = { page, page_size: pageSize };
    if (debouncedSearch) p.search = debouncedSearch;
    if (tenantId) p.wallet__agent__tenant = tenantId;
    if (status && status !== 'abandoned') p.status = status;
    return p;
  }, [page, pageSize, debouncedSearch, tenantId, status]);
  const subscriptionParams = useMemo<SubscriptionPaymentListParams>(() => {
    const p: SubscriptionPaymentListParams = { page, page_size: pageSize };
    if (tenantId) p.tenant = tenantId;
    if (status && status !== 'abandoned') p.status = status;
    return p;
  }, [page, pageSize, tenantId, status]);

  const vouchers = usePlatformPayments(voucherParams, source === 'vouchers');
  const wallet = usePlatformWalletPayments(walletParams, source === 'wallet');
  const subscriptions = usePlatformSubscriptionPayments(
    subscriptionParams,
    source === 'subscriptions',
  );
  const active = source === 'vouchers' ? vouchers : source === 'wallet' ? wallet : subscriptions;
  const planName = (id: number) => pricing.data?.find((p) => p.id === id)?.name ?? `Plan #${id}`;

  const tenantCell = (id: number) => (
    <Link to={`/platform/tenants/${id}`} className="text-brand-700 hover:underline">
      {tenantName(id)}
    </Link>
  );
  const when = (iso: string) => (
    <time dateTime={iso} title={formatDateTime(iso)} className="text-ink-600">
      {formatRelative(iso)}
    </time>
  );
  const completed = (iso: string | null) =>
    iso ? (
      <span title={formatDateTime(iso)}>{formatRelative(iso)}</span>
    ) : (
      <span className="text-ink-400">—</span>
    );

  const voucherColumns: Column<PaymentTransaction>[] = [
    {
      key: 'reference',
      header: 'Reference',
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <code className="font-mono text-sm font-semibold break-all text-ink-900">
            {p.reference}
          </code>
          <div className="mt-1 text-xs break-all text-ink-500">
            {p.customer_email || p.customer_phone || 'Anonymous customer'}
          </div>
        </div>
      ),
    },
    { key: 'tenant', header: 'Tenant', cell: (p) => tenantCell(p.tenant) },
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
      cell: (p) => <StatusBadge status={p.status} size="sm" dot />,
    },
    {
      key: 'voucher',
      header: 'Voucher',
      hideBelow: 'lg',
      cell: (p) =>
        p.voucher_username ? (
          <code className="font-mono text-[13px]">{p.voucher_username}</code>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    { key: 'created', header: 'Created', hideBelow: 'md', cell: (p) => when(p.created_at) },
  ];
  const walletColumns: Column<PlatformWalletPayment>[] = [
    {
      key: 'reference',
      header: 'Reference',
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <code className="font-mono text-sm font-semibold break-all text-ink-900">
            {p.reference}
          </code>
          <div className="text-xs text-ink-500">Agent #{p.agent_id}</div>
        </div>
      ),
    },
    { key: 'tenant', header: 'Tenant', cell: (p) => tenantCell(p.tenant_id) },
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
      cell: (p) => <StatusBadge status={p.status} size="sm" dot />,
    },
    { key: 'created', header: 'Created', hideBelow: 'md', cell: (p) => when(p.created_at) },
    {
      key: 'completed',
      header: 'Completed',
      hideBelow: 'lg',
      cell: (p) => completed(p.completed_at),
    },
  ];
  const subscriptionColumns: Column<PlatformSubscriptionPayment>[] = [
    {
      key: 'reference',
      header: 'Reference',
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <code className="font-mono text-sm font-semibold break-all text-ink-900">
            {p.reference}
          </code>
          <div className="text-xs text-ink-500">{planName(p.plan)}</div>
        </div>
      ),
    },
    { key: 'tenant', header: 'Tenant', cell: (p) => tenantCell(p.tenant) },
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
      cell: (p) => <StatusBadge status={p.status} size="sm" dot />,
    },
    { key: 'created', header: 'Created', hideBelow: 'md', cell: (p) => when(p.created_at) },
    {
      key: 'completed',
      header: 'Completed',
      hideBelow: 'lg',
      cell: (p) => completed(p.completed_at),
    },
  ];

  const statusOptions = [
    { value: '', label: 'All statuses' },
    { value: 'success', label: 'Successful' },
    { value: 'pending', label: 'Pending' },
    { value: 'failed', label: 'Failed' },
    ...(source === 'vouchers' ? [{ value: 'abandoned', label: 'Abandoned' }] : []),
  ];

  const emptyState = (
    <EmptyState
      icon={<CreditCard className="h-6 w-6" aria-hidden />}
      title={
        list.activeFilterCount > 0 || debouncedSearch ? 'No payments match' : 'No payments yet'
      }
      action={
        list.activeFilterCount > 0 || debouncedSearch ? (
          <Button
            variant="secondary"
            onClick={() => {
              list.clearFilters();
              list.setSearch('');
            }}
          >
            Clear filters
          </Button>
        ) : undefined
      }
    />
  );
  const pagination = active.data && active.data.count > 0 && (
    <Pagination
      count={active.data.count}
      page={list.state.page}
      totalPages={active.data.total_pages}
      pageSize={list.state.page_size}
      onPageChange={list.setPage}
      onPageSizeChange={list.setPageSize}
      itemLabel="payments"
    />
  );

  return (
    <div className="platform-payments min-w-0 space-y-6">
      <header className="payments-page-header">
        <div>
          <p className="payments-eyebrow">
            <CreditCard size={15} aria-hidden /> Platform administration
          </p>
          <h1>Payments</h1>
          <p className="payments-subtitle">
            Track customer purchases, wallet funding and subscriptions in one place.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={active.isFetching}
          leadingIcon={<RefreshCw className={active.isFetching ? 'animate-spin' : ''} />}
          onClick={() => void active.refetch()}
        >
          Refresh payments
        </Button>
      </header>
      <section
        aria-labelledby="payment-source-title"
        className="payments-directory-panel space-y-4"
      >
        <div className="overflow-x-auto">
          <Tabs
            items={SOURCES}
            value={source}
            onChange={setSource}
            ariaLabel="Payment source"
            className="payments-source-tabs"
          />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="payment-source-title" className="text-lg font-semibold text-brand-950">
            {SOURCES.find((item) => item.value === source)?.label}
          </h2>
          <p role="status" className="text-sm text-ink-500">
            {active.isPlaceholderData
              ? 'Updating results...'
              : active.data
                ? `${active.data.count} payments in this view`
                : active.isError
                  ? 'Payment count unavailable'
                  : 'Loading payments...'}
          </p>
        </div>
        <p className="text-sm text-ink-500">
          {source === 'vouchers'
            ? 'Customer payments for access codes.'
            : source === 'wallet'
              ? 'Agent payments to fund their wallets.'
              : 'Operator payments for platform subscription plans.'}{' '}
          Amounts are shown in naira. Pending payments are not confirmed collections.
        </p>
        <FilterBar
          className="payments-filter-bar"
          search={
            source === 'subscriptions' ? undefined : (
              <label className="payments-filter-label">
                Search reference
                <SearchInput
                  value={list.state.search}
                  onChange={list.setSearch}
                  placeholder="Search reference"
                  ariaLabel="Search payments"
                />
              </label>
            )
          }
          filters={
            <div className="payments-filter-grid">
              <label className="payments-filter-label">
                Operator
                <TenantSelect
                  value={list.state.filters.tenant ?? ''}
                  onChange={(v) => list.setFilter('tenant', v || undefined)}
                />
              </label>
              <label className="payments-filter-label">
                Payment status
                <Select
                  aria-label="Status"
                  size="sm"
                  value={list.state.filters.status ?? ''}
                  onChange={(e) => list.setFilter('status', e.target.value || undefined)}
                  options={statusOptions}
                />
              </label>
            </div>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
        {active.isError && active.data && (
          <Alert tone="warning" title="Payments could not be refreshed">
            Showing the last loaded results for this payment source. Refresh again to check for
            changes.
          </Alert>
        )}
        {source === 'vouchers' && (
          <DataTable
            className="payments-table"
            caption="Voucher sales"
            columns={voucherColumns}
            rows={vouchers.data?.results}
            rowKey={(p) => p.id}
            loading={vouchers.isPending}
            refreshing={vouchers.isFetching && !vouchers.isPending}
            error={vouchers.error}
            onRetry={() => void vouchers.refetch()}
            empty={emptyState}
          />
        )}
        {source === 'wallet' && (
          <DataTable
            className="payments-table"
            caption="Agent wallet top-ups"
            columns={walletColumns}
            rows={wallet.data?.results}
            rowKey={(p) => p.id}
            loading={wallet.isPending}
            refreshing={wallet.isFetching && !wallet.isPending}
            error={wallet.error}
            onRetry={() => void wallet.refetch()}
            empty={emptyState}
          />
        )}
        {source === 'subscriptions' && (
          <DataTable
            className="payments-table"
            caption="Subscription payments"
            columns={subscriptionColumns}
            rows={subscriptions.data?.results}
            rowKey={(p) => p.id}
            loading={subscriptions.isPending}
            refreshing={subscriptions.isFetching && !subscriptions.isPending}
            error={subscriptions.error}
            onRetry={() => void subscriptions.refetch()}
            empty={emptyState}
          />
        )}
        {pagination}
      </section>
    </div>
  );
}
