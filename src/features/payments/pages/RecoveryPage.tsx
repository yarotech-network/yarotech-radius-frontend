import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { LifeBuoy, RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/layout';
import { Button, Card, Select, Tooltip } from '@/components/ui';
import { Alert, EmptyState } from '@/components/feedback';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { formatKobo } from '@/lib/formatting/money';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { usePlanOptions } from '@/features/plans/queries';
import type { PaymentRecovery, PaymentStatus, RecoveryListParams } from '@/types/api';
import { useRecoveryList } from '../queries';
import {
  DELIVERY_LABELS,
  FULFILLMENT_LABELS,
  PAYMENT_STATUS_FILTERS,
  needsAttention,
} from '../paymentRules';
import { RecoveryDrawer } from '../components/RecoveryDrawer';

const FILTERS = ['status', 'plan', 'attention'] as const;

export default function RecoveryPage() {
  const [params, setParams] = useSearchParams();
  const list = useListParams(FILTERS);
  const plans = usePlanOptions(false);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const attentionOnly = list.state.filters.attention === '1';
  const selectedId = Number(params.get('payment')) || null;
  const query = useRecoveryList(
    useMemo(() => {
      const p: RecoveryListParams = { page: list.state.page, page_size: list.state.page_size };
      if (debouncedSearch) p.search = debouncedSearch;
      if (list.state.filters.status) p.status = list.state.filters.status as PaymentStatus;
      if (list.state.filters.plan) p.plan = Number(list.state.filters.plan);
      return p;
    }, [list.state, debouncedSearch]),
  );
  // Fulfilment/delivery are computed per row by the server and not filterable there; narrow the current page client-side.
  const rows = attentionOnly ? query.data?.results.filter(needsAttention) : query.data?.results;
  const attentionCount = query.data?.results.filter(needsAttention).length ?? 0;

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

  const columns: Column<PaymentRecovery>[] = [
    {
      key: 'reference',
      header: 'Reference',
      primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              select(r.id);
            }}
            className="text-left font-mono text-sm font-semibold break-all text-brand-700 hover:underline focus-visible:underline"
          >
            {r.reference}
          </button>
          {needsAttention(r) && (
            <p className="mt-1 text-xs font-medium text-warning-700">
              {r.fulfillment_status === 'paid_unfulfilled'
                ? (r.purchase_kind === 'iot' ? 'Payment received; device access not granted' : 'Payment received; voucher not issued')
                : 'Voucher issued; credentials email failed'}
            </p>
          )}
          <div className="mt-1 text-xs text-ink-500">
            {r.verified_at ? (
              <span title={formatDateTime(r.verified_at)}>
                Verified {formatRelative(r.verified_at)}
              </span>
            ) : (
              'Not verified with Paystack'
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => (
        <span className="font-semibold text-ink-900 tabular-nums">{formatKobo(r.amount)}</span>
      ),
    },
    { key: 'status', header: 'Payment', cell: (r) => <StatusBadge status={r.status} size="sm" /> },
    {
      key: 'fulfillment',
      header: 'Voucher',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge status={r.fulfillment_status} size="sm" />
          <span className="sr-only">{FULFILLMENT_LABELS[r.fulfillment_status]}</span>
        </span>
      ),
    },
    {
      key: 'delivery',
      header: 'Email',
      hideBelow: 'md',
      cell: (r) => (
        <Tooltip content={DELIVERY_LABELS[r.delivery_status]}>
          <span>
            <StatusBadge status={r.delivery_status} size="sm" />
          </span>
        </Tooltip>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Premium Hero Header */}
      <div className="router-page-hero">
        <div className="router-page-hero-inner">
          <div className="router-page-hero-text">
            <span className="router-page-hero-eyebrow">
              <LifeBuoy className="size-3" aria-hidden /> Support & Fulfilment
            </span>
            <h1 className="router-page-hero-title">Payment Recovery</h1>
            <p className="router-page-hero-desc">
              Find customers who paid but did not get their voucher, re-run fulfilment, and resend credentials.
            </p>
          </div>
          <div className="router-page-hero-actions">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* Hero Stats Strip */}
        <div className="router-page-hero-strip">
          <div className="router-page-hero-stat">
            <LifeBuoy className="size-4 text-amber-400" aria-hidden />
            <span>
              {attentionCount > 0
                ? `${attentionCount} payment${attentionCount !== 1 ? 's' : ''} need attention on this view`
                : 'All payments fulfilled'}
            </span>
          </div>
        </div>
      </div>
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <LifeBuoy className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-950">
              Resolve missing vouchers and delivery failures
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Review payment, voucher and email status separately. Open a reference to see the
              available recovery actions and email history.
            </p>
            <p className="mt-3 text-xs font-medium text-brand-700">
              Needs attention checks the current page only. Browse other pages to review additional
              payments.
            </p>
          </div>
        </div>
      </Card>
      {attentionCount > 0 && !attentionOnly && (
        <Alert
          tone="warning"
          className="mb-4"
          title={`${attentionCount} ${attentionCount === 1 ? 'payment needs' : 'payments need'} attention on this page`}
          actions={
            <Button size="sm" variant="secondary" onClick={() => list.setFilter('attention', '1')}>
              Show only those
            </Button>
          }
        >
          Paid without a voucher, or the credentials email failed.
        </Alert>
      )}
      <section aria-labelledby="recovery-queue-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="recovery-queue-title" className="text-lg font-semibold text-brand-950">
            Recovery queue
          </h2>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${rows?.length ?? 0} shown on this page; ${query.data.count} total before attention filtering`
                : query.isError
                  ? 'Payment count unavailable'
                  : 'Loading payments...'}
          </p>
        </div>
        <FilterBar
          inline
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search by reference"
              ariaLabel="Search payments by reference"
            />
          }
          filters={
            <div className="flex items-center gap-2 [&>div]:w-44 [&>div]:shrink-0">
              <Select
                aria-label="Needs attention"
                size="sm"
                value={attentionOnly ? '1' : ''}
                onChange={(e) => list.setFilter('attention', e.target.value || undefined)}
                options={[
                  { value: '', label: 'All payments' },
                  { value: '1', label: 'Needs attention' },
                ]}
              />
              <Select
                aria-label="Payment status"
                size="sm"
                value={list.state.filters.status ?? ''}
                onChange={(e) => list.setFilter('status', e.target.value || undefined)}
                options={PAYMENT_STATUS_FILTERS}
              />
              <Select
                aria-label="Plan"
                size="sm"
                value={list.state.filters.plan ?? ''}
                onChange={(e) => list.setFilter('plan', e.target.value || undefined)}
                options={[
                  { value: '', label: 'All plans' },
                  ...(plans.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              />
            </div>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
        {plans.isError && (
          <Alert
            tone="warning"
            title="Plan filters could not be loaded"
            actions={
              <Button
                size="sm"
                variant="secondary"
                disabled={plans.isFetching}
                onClick={() => void plans.refetch()}
              >
                Retry plan filters
              </Button>
            }
          >
            Search and payment status filters remain available.
          </Alert>
        )}
        {query.isError && query.data && (
          <Alert tone="warning" title="Recovery queue could not be refreshed">
            Showing the last loaded payments. Refresh again to check their current status.
          </Alert>
        )}
        <DataTable
          caption="Payment recovery"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          onRowClick={(r) => select(r.id)}
          empty={
            attentionOnly && (query.data?.results.length ?? 0) > 0 ? (
              <EmptyState
                icon={<LifeBuoy className="h-6 w-6" aria-hidden />}
                title="Nothing needs attention on this page"
                description="No paid-without-voucher or failed-email cases were found on this page. Other payments may still be pending or have email delivery in progress."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => list.setFilter('attention', undefined)}
                  >
                    Show all payments
                  </Button>
                }
              />
            ) : list.activeFilterCount > 0 ? (
              <EmptyState
                icon={<LifeBuoy className="h-6 w-6" aria-hidden />}
                title="No payments match"
                action={
                  <Button variant="secondary" onClick={list.clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<LifeBuoy className="h-6 w-6" aria-hidden />}
                title="No payments yet"
                description="Storefront purchases will show up here once customers start buying."
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
      </section>
      <RecoveryDrawer paymentId={selectedId} onClose={() => select(null)} />
    </div>
  );
}
