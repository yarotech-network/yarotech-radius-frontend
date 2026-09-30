import { PageMetrics } from '@/features/dashboard/components/PageMetrics';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Check, Copy, Receipt } from 'lucide-react';
import { Badge, Button, Card, Select } from '@/components/ui';
import { PaymentStatusBadge } from '@/features/payments/components/PaymentStatusBadge';
import { Alert, EmptyState } from '@/components/feedback';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatKobo } from '@/lib/formatting/money';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import type { PaymentListParams, PaymentStatus, PaymentTransaction } from '@/types/api';
import { PAYMENTS_DEFAULT_ORDERING, usePayments } from '../queries';
import { PAYMENT_STATUS_FILTERS } from '../paymentRules';
import { PaymentDrawer } from '../components/PaymentDrawer';

const FILTERS = ['status'] as const;

export default function PaymentsPage() {
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
      header: 'Reference',
      primary: true,
      cell: (p) => (
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                select(p.id);
              }}
              className="dashboard-data-link text-left font-mono text-sm font-bold tracking-wide break-all"
            >
              {/* {p.reference} */}
              {p.customer_email}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copyRef(p.reference);
              }}
              title="Copy reference"
              className="inline-flex size-5 shrink-0 items-center justify-center rounded text-ink-400 transition hover:bg-surface-muted hover:text-ink-700"
            >
              {copiedRef === p.reference ? (
                <Check className="size-3 text-emerald-600" />
              ) : (
                <Copy className="size-3" />
              )}
            </button>
          </div>
          {/* <div className="mt-0.5 text-xs text-ink-500">{customerLabel(p)}</div> */}
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (p) => (
        <span className="font-bold text-ink-900 tabular-nums">{formatKobo(p.amount)}</span>
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
      header: 'Voucher Code',
      hideBelow: 'md',
      cell: (p) =>
        p.voucher_username ? (
          <code className="text-ink-800 rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs font-semibold break-all">
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
          className="text-xs text-ink-600"
        >
          {formatDateTime(p.created_at)}
        </time>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Premium Hero Header */}
   

      {/* Intro Banner */}
      <PageMetrics section="payments" />

      {/* Payment History Container Card */}
      <Card className="space-y-5 border-border/70 p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-4">
          <div>
            <h2
              id="payment-history-title"
              className="text-xl font-bold tracking-tight text-ink-900"
            >
              Payment History
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Transaction audit log for online purchases and voucher fulfillments.
            </p>
          </div>
          <p
            role="status"
            className="rounded-full border border-border/50 bg-surface-muted px-3 py-1 text-xs font-medium text-ink-500"
          >
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} payments in this view`
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
              placeholder="Search reference, email or customer name"
              ariaLabel="Search payments"
            />
          }
          filters={
            <div className="w-44">
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
          <div className="border-t border-border/60 pt-4">
            <Pagination
              count={query.data.count}
              page={list.state.page}
              totalPages={query.data.total_pages}
              pageSize={list.state.page_size}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              itemLabel="payments"
            />
          </div>
        )}
      </Card>

      <PaymentDrawer paymentId={selectedId} onClose={() => select(null)} />
    </div>
  );
}
