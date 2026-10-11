import { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';
import { ArrowLeft, CircleCheckBig, LifeBuoy, RefreshCw, X } from 'lucide-react';
import { KpiTile, StatusBadge } from '@/components/layout';
import { Button, ButtonLink, Card, SegmentedControl, Select, Tooltip } from '@/components/ui';
import { Alert, EmptyState } from '@/components/feedback';
import { DataTable, Pagination, SearchInput, useListParams, type Column } from '@/components/data';
import { formatKobo } from '@/lib/formatting/money';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { formatNumber } from '@/lib/formatting/units';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { cn } from '@/lib/utilities/cn';
import { usePlanOptions } from '@/features/plans/queries';
import type {
  PaymentRecovery,
  PaymentStatus,
  RecoveryAttention,
  RecoveryListParams,
} from '@/types/api';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { RecoveryDrawer } from '../components/RecoveryDrawer';
import { useRecoveryList } from '../queries';
import {
  DELIVERY_LABELS,
  FULFILLMENT_LABELS,
  PAYMENT_STATUS_FILTERS,
  needsAttention,
} from '../paymentRules';

const FILTERS = ['status', 'plan', 'attention'] as const;
const ATTENTION: RecoveryAttention[] = ['any', 'unfulfilled', 'email'];

/** Accepts the earlier `attention=1` links as "any problem". */
function attentionFrom(value: string | undefined): RecoveryAttention | '' {
  if (value === '1') return 'any';
  return ATTENTION.includes(value as RecoveryAttention) ? (value as RecoveryAttention) : '';
}

/** One plain sentence for what went wrong, or null when nothing needs doing. */
function problem(row: PaymentRecovery): string | null {
  if (!needsAttention(row)) return null;
  if (row.fulfillment_status === 'paid_unfulfilled')
    return row.purchase_kind === 'iot'
      ? 'Payment received; device access not granted'
      : 'Payment received; voucher not issued';
  return 'Voucher issued; credentials email failed';
}

export default function RecoveryPage() {
  useEffect(() => {
    document.title = 'Payment recovery | Yarotech RADIUS';
  }, []);
  const [params, setParams] = useSearchParams();
  const list = useListParams(FILTERS);
  const plans = usePlanOptions(false);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const attention = attentionFrom(list.state.filters.attention);
  const selectedId = Number(params.get('payment')) || null;
  const query = useRecoveryList(
    useMemo(() => {
      const p: RecoveryListParams = { page: list.state.page, page_size: list.state.page_size };
      if (debouncedSearch) p.search = debouncedSearch;
      if (list.state.filters.status) p.status = list.state.filters.status as PaymentStatus;
      if (list.state.filters.plan) p.plan = Number(list.state.filters.plan);
      if (attention) p.attention = attention;
      return p;
    }, [list.state, debouncedSearch, attention]),
  );
  const summary = query.data?.summary;
  const rows = query.data?.results;

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

  const showAttention = (value: RecoveryAttention | '') =>
    list.setFilter('attention', value || undefined);

  const columns: Column<PaymentRecovery>[] = [
    {
      key: 'reference',
      header: 'Payment',
      primary: true,
      cell: (r) => {
        const issue = problem(r);
        return (
          <div className="min-w-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                select(r.id);
              }}
              className="dashboard-data-link text-left font-mono text-sm font-semibold break-all"
            >
              {r.reference}
            </button>
            {issue && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-warning-700">
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-warning-600" />
                {issue}
              </p>
            )}
            <p className="mt-0.5 text-xs text-ink-500">
              {r.verified_at ? (
                <span title={formatDateTime(r.verified_at)}>
                  Verified {formatRelative(r.verified_at)}
                </span>
              ) : (
                'Not verified with the payment provider'
              )}
            </p>
          </div>
        );
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      cell: (r) => (
        <span className="font-semibold text-ink-900 tabular-nums">{formatKobo(r.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Paid?',
      cell: (r) => (
        <PaymentStatusBadge
          displayStatusCode={r.display_status_code}
          displayStatusLabel={r.display_status_label}
          status={r.status}
          size="sm"
        />
      ),
    },
    {
      key: 'fulfillment',
      header: 'Issued?',
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge status={r.fulfillment_status} size="sm" />
          <span className="sr-only">{FULFILLMENT_LABELS[r.fulfillment_status]}</span>
        </span>
      ),
    },
    {
      key: 'delivery',
      header: 'Emailed?',
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

  const count = (n: number | undefined) => (n === undefined ? undefined : formatNumber(n));
  const attentionOptions: { value: RecoveryAttention | ''; label: ReactNode }[] = [
    { value: '', label: 'All payments' },
    {
      value: 'any',
      label: <OptionCount text="Needs attention" count={count(summary?.needs_attention)} warn />,
    },
    {
      value: 'unfulfilled',
      label: <OptionCount text="Paid, nothing issued" count={count(summary?.unfulfilled)} />,
    },
    {
      value: 'email',
      label: <OptionCount text="Email failed" count={count(summary?.email_failed)} />,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Payments</p>
          <h1 className="text-2xl font-bold text-ink-900">Payment recovery</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Find customers who paid but didn&apos;t get their access, issue it again, and resend
            their credentials email.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink
            to="/payments"
            variant="secondary"
            size="sm"
            leadingIcon={<ArrowLeft className="size-4" aria-hidden />}
          >
            All payments
          </ButtonLink>
          <Button
            variant="secondary"
            size="sm"
            disabled={query.isFetching}
            leadingIcon={
              <RefreshCw
                className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
              />
            }
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Refreshing...' : 'Refresh recovery'}
          </Button>
        </div>
      </header>

      {(query.isPending || summary) && (
        <section aria-label="Recovery summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiTile
            label="Needs attention"
            value={summary ? formatNumber(summary.needs_attention) : '—'}
            detail={
              summary
                ? summary.needs_attention > 0
                  ? 'Customers waiting on you'
                  : 'Every paid customer is sorted'
                : 'Across all payments'
            }
            extra={
              summary && summary.needs_attention > 0 ? (
                <span aria-hidden className="block h-1 rounded-full bg-warning-600" />
              ) : undefined
            }
            loading={query.isPending}
          />
          <KpiTile
            label="Paid, nothing issued"
            value={summary ? formatNumber(summary.unfulfilled) : '—'}
            detail={
              summary && summary.unfulfilled > 0
                ? `${formatKobo(summary.unfulfilled_amount, { compact: true })} waiting to be issued`
                : 'No voucher or device access owed'
            }
            loading={query.isPending}
          />
          <KpiTile
            label="Email failed"
            value={summary ? formatNumber(summary.email_failed) : '—'}
            detail="Access issued; credentials email didn't arrive"
            loading={query.isPending}
          />
          <KpiTile
            label="Awaiting confirmation"
            value={summary ? formatNumber(summary.pending) : '—'}
            detail="Still pending with the payment provider"
            loading={query.isPending}
          />
        </section>
      )}

      <Card padded={false} className="space-y-4 p-4 md:p-5">
        <section aria-label="Recovery filters" className="space-y-3">
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              ariaLabel="Show"
              size="sm"
              options={attentionOptions}
              value={attention}
              onChange={showAttention}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-72">
              <SearchInput
                value={list.state.search}
                onChange={list.setSearch}
                placeholder="Search by payment reference"
                ariaLabel="Search payments by reference"
              />
            </div>
            <div className="w-full sm:w-44">
              <Select
                aria-label="Payment status"
                size="sm"
                value={list.state.filters.status ?? ''}
                onChange={(e) => list.setFilter('status', e.target.value || undefined)}
                options={PAYMENT_STATUS_FILTERS}
              />
            </div>
            <div className="w-full sm:w-44">
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
            {list.activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<X className="size-4" aria-hidden />}
                onClick={list.clearFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        </section>

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

        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-ink-900">Recovery queue</h2>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${formatNumber(query.data.count)} ${query.data.count === 1 ? 'payment' : 'payments'}`
                : query.isError
                  ? 'Payment count unavailable'
                  : 'Loading payments...'}
          </p>
        </div>

        <DataTable
          caption="Payment recovery"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.data ? null : query.error}
          onRetry={() => void query.refetch()}
          onRowClick={(r) => select(r.id)}
          rowActions={(r) => (
            <Button
              variant={needsAttention(r) ? 'secondary' : 'ghost'}
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                select(r.id);
              }}
            >
              {needsAttention(r) ? 'Fix' : 'Open'}
            </Button>
          )}
          empty={
            attention ? (
              <EmptyState
                icon={<CircleCheckBig className="size-6 text-success-600" aria-hidden />}
                title="Nothing needs attention"
                description="Every paid customer has their access, and no credentials emails have failed."
                action={
                  <Button variant="secondary" onClick={() => showAttention('')}>
                    Show all payments
                  </Button>
                }
              />
            ) : list.activeFilterCount > 0 ? (
              <EmptyState
                icon={<LifeBuoy className="size-6" aria-hidden />}
                title="No payments match"
                action={
                  <Button variant="secondary" onClick={list.clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<LifeBuoy className="size-6" aria-hidden />}
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
      </Card>
      <RecoveryDrawer paymentId={selectedId} onClose={() => select(null)} />
    </div>
  );
}

function OptionCount({
  text,
  count,
  warn,
}: {
  text: string;
  count: string | undefined;
  warn?: boolean;
}) {
  const active = warn && count !== undefined && count !== '0';
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {text}
      {count !== undefined && (
        <span
          className={cn(
            'rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
            active ? 'bg-warning-100 text-warning-700' : 'bg-fill text-ink-600',
          )}
        >
          {count}
        </span>
      )}
    </span>
  );
}
