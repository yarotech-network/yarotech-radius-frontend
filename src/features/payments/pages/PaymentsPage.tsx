import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { LifeBuoy, Receipt, RefreshCw } from 'lucide-react';
import { PageHeader, StatusBadge } from '@/components/layout';
import { Badge, Button, ButtonLink, Card, Select } from '@/components/ui';
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
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { formatKobo } from '@/lib/formatting/money';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { can } from '@/services/auth/principal';
import type { PaymentListParams, PaymentStatus, PaymentTransaction } from '@/types/api';
import { PAYMENTS_DEFAULT_ORDERING, usePayments } from '../queries';
import { PAYMENT_STATUS_FILTERS, customerLabel } from '../paymentRules';
import { PaymentDrawer } from '../components/PaymentDrawer';

const FILTERS = ['status'] as const;

export default function PaymentsPage() {
  const principal = usePrincipal();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const list = useListParams(FILTERS, { ordering: PAYMENTS_DEFAULT_ORDERING });
  const debouncedSearch = useDebouncedValue(list.state.search);
  const selectedId = Number(params.get('payment')) || null;
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
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              select(p.id);
            }}
            className="text-left font-mono text-sm font-semibold break-all text-brand-700 hover:underline focus-visible:underline"
          >
            {p.reference}
          </button>
          <div className="mt-1 text-xs break-words text-ink-500">{customerLabel(p)}</div>
        </div>
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
    { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} size="sm" /> },
    {
      key: 'voucher',
      header: 'Voucher',
      hideBelow: 'md',
      cell: (p) =>
        p.voucher_username ? (
          <code className="font-mono text-[13px] break-all">{p.voucher_username}</code>
        ) : p.status === 'success' && !p.voucher ? (
          <Badge tone="warning" size="sm">
            Paid, no voucher
          </Badge>
        ) : (
          <span className="text-ink-400">{p.voucher ? 'Voucher linked' : 'Not issued'}</span>
        ),
    },
    {
      key: 'created',
      header: 'Created',
      hideBelow: 'lg',
      sortField: 'created_at',
      cell: (p) => (
        <time dateTime={p.created_at} title={formatDateTime(p.created_at)} className="text-ink-600">
          {formatRelative(p.created_at)}
        </time>
      ),
    },
    {
      key: 'paid',
      header: 'Paid',
      hideBelow: 'xl',
      sortField: 'paid_at',
      cell: (p) =>
        p.paid_at ? (
          <span title={formatDateTime(p.paid_at)}>{formatRelative(p.paid_at)}</span>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Customer purchases made through your storefront."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin' : ''} />}
              onClick={() => void query.refetch()}
            >
              Refresh payments
            </Button>
            {can(principal, 'payments.recovery.view') && (
              <ButtonLink
                to="/payments/recovery"
                variant="secondary"
                leadingIcon={<LifeBuoy className="h-4 w-4" aria-hidden />}
              >
                Recovery
              </ButtonLink>
            )}
          </div>
        }
      />
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Receipt className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-950">Track customer purchases</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Find a transaction by reference or customer, check its payment status, and open the
              details to see its linked voucher.
            </p>
            <p className="mt-3 text-xs font-medium text-brand-700">
              Payment confirmation and voucher issuance are separate. Review successful payments
              without a voucher.
            </p>
          </div>
        </div>
      </Card>
      <section aria-labelledby="payment-history-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="payment-history-title" className="text-lg font-semibold text-brand-950">
            Payment history
          </h2>
          <p role="status" className="text-sm text-ink-500">
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
              placeholder="Search reference, email or name"
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
                icon={<Receipt className="h-6 w-6" aria-hidden />}
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
                icon={<Receipt className="h-6 w-6" aria-hidden />}
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
      </section>
      <PaymentDrawer
        paymentId={selectedId}
        onClose={() => select(null)}
        onOpenRecovery={(id) => navigate(`/payments/recovery?payment=${id}`)}
      />
    </div>
  );
}
