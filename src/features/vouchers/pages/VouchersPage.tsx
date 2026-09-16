import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Check, Copy, Plus, Printer, RefreshCw, Ticket, X, Zap } from 'lucide-react';
import { StatusBadge } from '@/components/layout';
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
const STATUSES: readonly VoucherStatus[] = ['unused', 'sold', 'used', 'active', 'expired', 'disabled'];

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
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const copyCode = (voucher: Voucher) => {
    const textToCopy = voucher.access_code || voucher.username;
    void navigator.clipboard.writeText(textToCopy);
    setCopiedId(voucher.id);
    toast.success('Code copied to clipboard', textToCopy);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const pageIds = useMemo(() => query.data?.results.map((v) => v.id) ?? [], [query.data]);
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
      header: 'Voucher Code',
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
              className="font-mono text-sm font-bold tracking-wider text-brand-700 dark:text-brand-400 hover:underline focus-visible:underline break-all"
            >
              {v.username}
            </Link>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                copyCode(v);
              }}
              title="Copy code"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-surface-muted hover:text-ink-700 transition"
            >
              {copiedId === v.id ? (
                <Check className="size-3.5 text-emerald-600" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
          <div className="mt-0.5 text-xs text-ink-500">{describeSource(v)}</div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan & Price',
      cell: (v) => (
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-ink-900">{v.plan_name}</span>
            {v.price_display && (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                {v.price_display}
              </span>
            )}
          </div>
          {v.plan_duration && (
            <p className="text-xs text-ink-500">{v.plan_duration}</p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortField: 'status',
      cell: (v) => <StatusBadge status={v.status} size="sm" dot />,
    },
    {
      key: 'expires',
      header: 'Expires',
      hideBelow: 'lg',
      sortField: 'expires_at',
      cell: (v) =>
        v.expires_at ? (
          <span className="text-xs text-ink-700 font-medium" title={formatDateTime(v.expires_at)}>
            {formatRelative(v.expires_at)}
          </span>
        ) : (
          <span className="text-xs text-ink-400">
            {v.status === 'unused' ? 'Not activated' : '—'}
          </span>
        ),
    },
    {
      key: 'created',
      header: 'Created',
      hideBelow: 'md',
      sortField: 'created_at',
      cell: (v) => (
        <span className="text-xs text-ink-600" title={formatDateTime(v.created_at)}>
          {formatRelative(v.created_at)}
        </span>
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
              <Ticket className="size-3" aria-hidden /> Access Control & Sales
            </span>
            <h1 className="router-page-hero-title">Voucher Desk</h1>
            <p className="router-page-hero-desc">
              Every access code issued for your hotspot — generated by staff, sold by agents or bought online.
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
            {canGenerate && (
              <Button
                leadingIcon={<Plus className="size-4" aria-hidden />}
                onClick={() => navigate('/vouchers/generate')}
              >
                Generate vouchers
              </Button>
            )}
          </div>
        </div>

        {/* Hero Stats Strip */}
        <div className="router-page-hero-strip">
          <div className="router-page-hero-stat">
            <Ticket className="size-4" aria-hidden />
            <span>
              {query.data
                ? `${query.data.count} total voucher${query.data.count !== 1 ? 's' : ''}`
                : 'Loading vouchers...'}
            </span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-stat">
            <Zap className="size-4 text-amber-400" aria-hidden />
            <span>RADIUS Authentication & Sales</span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-links">
            <Link to="/plans" className="router-page-hero-link">
              <Plus className="size-3.5" aria-hidden /> Service plans
            </Link>
          </div>
        </div>
      </div>

      {/* Intro Banner */}
      <Card className="border-brand-200 bg-gradient-to-br from-brand-50/70 via-surface to-sky-50/50 dark:from-brand-950/40 dark:via-surface dark:to-slate-900/40">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
            <Ticket className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-900">Find and manage access codes</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Search for a voucher, narrow the list by status or plan, then open its details to
              review usage and available actions.
            </p>
            {canPrint && (
              <p className="mt-3 text-xs font-semibold text-brand-600 dark:text-brand-400">
                Select vouchers on the current page to print them together.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Enhanced Directory Container Card */}
      <Card className="p-5 md:p-6 border-border/70 space-y-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-4">
          <div>
            <h2 id="voucher-directory-title" className="text-xl font-bold tracking-tight text-ink-900">
              Voucher Directory
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Complete history of generated, sold, active, and expired access codes.
            </p>
          </div>
          <p role="status" className="text-xs font-medium text-ink-500 rounded-full bg-surface-muted px-3 py-1 border border-border/50">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} ${list.activeFilterCount ? 'matching' : 'total'} vouchers`
                : query.isError
                  ? 'Voucher count unavailable'
                  : 'Loading vouchers...'}
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="overflow-x-auto pb-1">
          <VoucherStatusFilter
            value={statusTab}
            onChange={(v) => list.setFilter('status', v === 'all' ? undefined : v)}
          />
        </div>

        {/* Search & Filter Toolbar */}
        <FilterBar
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search by username, access code or agent"
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
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 p-1.5 dark:bg-brand-950/60" role="status">
                <span className="text-xs font-semibold text-brand-700 dark:text-brand-300 px-2">{visibleSelected.size} selected</span>
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

        {/* Data Table */}
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

        {/* Pagination Section */}
        {query.data && query.data.count > 0 && (
          <div className="border-t border-border/60 pt-4">
            <Pagination
              count={query.data.count}
              page={list.state.page}
              totalPages={query.data.total_pages}
              pageSize={list.state.page_size}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              itemLabel="vouchers"
            />
          </div>
        )}
      </Card>

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
