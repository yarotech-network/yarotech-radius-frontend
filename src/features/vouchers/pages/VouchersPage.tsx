import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, Printer, RefreshCw, Ticket, X } from 'lucide-react';
import { PageHeader, StatusBadge } from '@/components/layout';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { Button, Card, Checkbox, ConfirmDialog, Select } from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { can } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import { usePlanOptions } from '@/features/plans/queries';
import type { Voucher, VoucherListParams, VoucherStatus } from '@/types/api';
import { VoucherActions } from '../components/VoucherActions';
import { VoucherStatusFilter, type VoucherStatusTab } from '../components/VoucherStatusFilter';
import { usePrintVouchers } from '../hooks/usePrintVouchers';
import { VOUCHERS_DEFAULT_ORDERING, useDisableVoucher, useVouchers } from '../queries';
import { describeSource } from '../voucherRules';

const FILTERS = ['status', 'plan', 'source'] as const;
const STATUSES: readonly VoucherStatus[] = ['unused', 'active', 'expired', 'disabled'];

export default function VouchersPage() {
  const principal = usePrincipal();
  const navigate = useNavigate();
  const toast = useToast();
  const canGenerate = can(principal, 'vouchers.generate');
  const canPrint = can(principal, 'vouchers.print');
  const list = useListParams(FILTERS, { ordering: VOUCHERS_DEFAULT_ORDERING });
  const debouncedSearch = useDebouncedValue(list.state.search);
  const params = useMemo<VoucherListParams>(() => {
    const p: VoucherListParams = { page: list.state.page, page_size: list.state.page_size };
    if (debouncedSearch) p.search = debouncedSearch;
    if (list.state.ordering) p.ordering = list.state.ordering;
    const status = list.state.filters.status;
    if (status && (STATUSES as readonly string[]).includes(status))
      p.status = status as VoucherStatus;
    if (list.state.filters.plan) p.plan = Number(list.state.filters.plan);
    return p;
  }, [list.state, debouncedSearch]);
  const query = useVouchers(params);
  const plans = usePlanOptions(false);
  const disable = useDisableVoucher();
  const printer = usePrintVouchers();
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [pendingDisable, setPendingDisable] = useState<Voucher | null>(null);

  const pageIds = useMemo(() => query.data?.results.map((v) => v.id) ?? [], [query.data]);
  // Selections only count while their rows are on screen (page/filter changes drop them).
  const visibleSelected = useMemo(
    () => new Set(pageIds.filter((id) => selected.has(id))),
    [pageIds, selected],
  );

  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pageIds));
  const toggleOne = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const statusTab: VoucherStatusTab = (STATUSES as readonly string[]).includes(
    list.state.filters.status ?? '',
  )
    ? (list.state.filters.status as VoucherStatus)
    : 'all';

  const columns: Column<Voucher>[] = [
    ...(canPrint
      ? [
          {
            key: 'select',
            width: '2.5rem',
            header: (
              <Checkbox
                aria-label="Select all vouchers on this page"
                checked={allSelected}
                onChange={toggleAll}
              />
            ),
            cell: (v: Voucher) => (
              <Checkbox
                aria-label={`Select ${v.username}`}
                checked={visibleSelected.has(v.id)}
                onChange={() => toggleOne(v.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ),
            mobileHidden: true,
          } satisfies Column<Voucher>,
        ]
      : []),
    {
      key: 'username',
      header: 'Voucher',
      primary: true,
      cell: (v) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {canPrint && (
              <span className="md:hidden">
                <Checkbox
                  aria-label={`Select ${v.username}`}
                  checked={visibleSelected.has(v.id)}
                  onChange={() => toggleOne(v.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </span>
            )}
            <Link
              to={`/vouchers/${v.id}`}
              onClick={(e) => e.stopPropagation()}
              className="min-w-0 font-mono text-sm font-semibold break-all text-brand-700 underline-offset-4 hover:underline focus-visible:underline"
            >
              {v.username}
            </Link>
          </div>
          <div className="mt-0.5 text-xs text-ink-500">{describeSource(v)}</div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (v) => (
        <span className="break-words whitespace-normal text-ink-700">{v.plan_name}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortField: 'status',
      cell: (v) => <StatusBadge status={v.status} size="sm" />,
    },
    {
      key: 'expires',
      header: 'Expires',
      hideBelow: 'lg',
      sortField: 'expires_at',
      cell: (v) =>
        v.expires_at ? (
          <span title={formatDateTime(v.expires_at)}>{formatRelative(v.expires_at)}</span>
        ) : (
          <span className="text-ink-400">
            {v.status === 'unused' ? 'Not activated' : 'Not available'}
          </span>
        ),
    },
    {
      key: 'created',
      header: 'Created',
      hideBelow: 'md',
      sortField: 'created_at',
      cell: (v) => (
        <span className="text-ink-600" title={formatDateTime(v.created_at)}>
          {formatRelative(v.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vouchers"
        description="Every access code issued for your hotspot — generated by staff, sold by agents or bought online."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin' : ''} />}
              onClick={() => void query.refetch()}
            >
              Refresh vouchers
            </Button>
            {canGenerate ? (
              <Button
                leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
                onClick={() => navigate('/vouchers/generate')}
              >
                Generate vouchers
              </Button>
            ) : null}
          </div>
        }
      />
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Ticket className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-950">Find and manage access codes</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Search for a voucher, narrow the list by status or plan, then open its details to
              review usage and available actions.
            </p>
            {canPrint && (
              <p className="mt-3 text-xs font-medium text-brand-700">
                Select vouchers on the current page to print them together.
              </p>
            )}
          </div>
        </div>
      </Card>
      <section aria-labelledby="voucher-directory-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="voucher-directory-title" className="text-lg font-semibold text-brand-950">
            Voucher directory
          </h2>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} ${list.activeFilterCount ? 'matching' : 'total'} vouchers`
                : query.isError
                  ? 'Voucher count unavailable'
                  : 'Loading vouchers...'}
          </p>
        </div>
        <div className="overflow-x-auto pb-1">
          <VoucherStatusFilter
            value={statusTab}
            onChange={(v) => list.setFilter('status', v === 'all' ? undefined : v)}
          />
        </div>
        <FilterBar
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search by username or agent"
              ariaLabel="Search vouchers"
            />
          }
          filters={
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
          }
          actions={
            visibleSelected.size > 0 ? (
              <div className="flex flex-wrap items-center gap-2" role="status">
                <span className="text-sm text-ink-700">{visibleSelected.size} selected</span>
                <Button
                  size="sm"
                  leadingIcon={<Printer className="h-4 w-4" aria-hidden />}
                  loading={printer.printing}
                  onClick={() => void printer.print([...visibleSelected])}
                >
                  {printer.progress
                    ? `Preparing ${printer.progress.done}/${printer.progress.total}`
                    : 'Print selected'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label="Clear selection"
                  onClick={() => setSelected(new Set())}
                >
                  <X className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            ) : undefined
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
            You can still search vouchers and filter by status.
          </Alert>
        )}
        {query.isError && query.data && (
          <Alert tone="warning" title="Vouchers could not be refreshed">
            Showing the last loaded results. Refresh again to check for changes.
          </Alert>
        )}
        <DataTable
          caption="Vouchers"
          columns={columns}
          rows={query.data?.results}
          rowKey={(v) => v.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          ordering={list.state.ordering}
          onOrderingChange={list.setOrdering}
          onRowClick={(v) => navigate(`/vouchers/${v.id}`)}
          empty={
            list.activeFilterCount > 0 ? (
              <EmptyState
                icon={<Ticket className="h-6 w-6" aria-hidden />}
                title="No vouchers match"
                description="Try another status, plan or search term."
                action={
                  <Button variant="secondary" onClick={list.clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Ticket className="h-6 w-6" aria-hidden />}
                title="No vouchers yet"
                description={
                  canGenerate
                    ? 'Generate a batch from one of your plans to get started.'
                    : 'Vouchers will show up here once they are generated.'
                }
                action={
                  canGenerate ? (
                    <Button onClick={() => navigate('/vouchers/generate')}>
                      Generate vouchers
                    </Button>
                  ) : undefined
                }
              />
            )
          }
          rowActions={(v) => (
            <VoucherActions
              voucher={v}
              handlers={{
                onPrint: (voucher) => void printer.print([voucher.id]),
                onDisable: setPendingDisable,
                onEdit: (voucher) => navigate(`/vouchers/${voucher.id}?edit=1`),
              }}
            />
          )}
        />
        {query.data && query.data.count > 0 && (
          <Pagination
            count={query.data.count}
            page={list.state.page}
            totalPages={query.data.total_pages}
            pageSize={list.state.page_size}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            itemLabel="vouchers"
          />
        )}
      </section>

      <ConfirmDialog
        open={pendingDisable !== null}
        onClose={() => setPendingDisable(null)}
        tone="danger"
        title={`Disable ${pendingDisable?.username ?? 'voucher'}?`}
        description="The code stops working immediately and cannot be re-enabled. Any active session is not cut off until it reconnects."
        confirmLabel="Disable voucher"
        onConfirm={async () => {
          if (!pendingDisable) return;
          await disable.mutateAsync(pendingDisable.id);
          toast.success('Voucher disabled', pendingDisable.username);
        }}
      />
    </div>
  );
}
