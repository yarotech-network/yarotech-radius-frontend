import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Check, Copy, FileDown, Plus, Printer, Ticket, X, Trash2 } from 'lucide-react';
import { StatusBadge } from '@/components/layout';
import {
  DataTable,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { Button, Checkbox, ConfirmDialog, Dialog, Input } from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatDateTime } from '@/lib/formatting/dates';
import { can } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import type { Voucher, VoucherListParams, VoucherStatus } from '@/types/api';
import { VoucherActions } from '../components/VoucherActions';
import { VoucherStatusFilter, type VoucherStatusTab } from '../components/VoucherStatusFilter';
import { usePrintVouchers } from '../hooks/usePrintVouchers';
import { VOUCHERS_DEFAULT_ORDERING, useDisableVoucher, useVouchers, useVoucherSummary, voucherKeys } from '../queries';
import { vouchersApi } from '../api';
import { ManualCodeDialog } from '../components/ManualCodeDialog';
import GenerateVouchersPage from './GenerateVouchersPage';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { downloadBlob } from '@/lib/utilities/download';
import { errorMessage, isApiError } from '@/services/api/errors';
import { useQueryClient } from '@tanstack/react-query';
import type { VoucherRemovalPreview } from '@/types/api';

const FILTERS = ['status', 'created_from_day', 'created_to_day'] as const;
const STATUSES: readonly VoucherStatus[] = [
  'unused',
  'sold',
  'used',
  'active',
  'expired',
  'disabled',
];

const pdfRendererUnavailable = (error: unknown) =>
  isApiError(error) && error.status === 503 &&
  error.message.startsWith('PDF generation is unavailable.');

export default function VouchersPage() {
  const principal = usePrincipal();
  const navigate = useNavigate();
  const toast = useToast();
  const canGenerate = can(principal, 'vouchers.generate');
  const canPrint = can(principal, 'vouchers.print');
  const canManage = can(principal, 'vouchers.manage');
  const client = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const list = useListParams(FILTERS, { ordering: VOUCHERS_DEFAULT_ORDERING });
  useEffect(() => {
    if (!searchParams.has('plan') && !searchParams.has('online')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('plan');
    next.delete('online');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const params = useMemo<VoucherListParams>(() => {
    const p: VoucherListParams = { page: list.state.page, page_size: list.state.page_size };
    if (debouncedSearch) p.search = debouncedSearch;
    if (list.state.ordering) p.ordering = list.state.ordering;
    const status = list.state.filters.status;
    if (status && (STATUSES as readonly string[]).includes(status))
      p.status = status as VoucherStatus;
    if (list.state.filters.created_from_day) p.created_from_day = list.state.filters.created_from_day;
    if (list.state.filters.created_to_day) p.created_to_day = list.state.filters.created_to_day;
    return p;
  }, [list.state, debouncedSearch]);
  const query = useVouchers(params);
  const summary = useVoucherSummary();
  const disable = useDisableVoucher();
  const printer = usePrintVouchers();
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [pendingDisable, setPendingDisable] = useState<Voucher | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<{ voucher: Voucher; action: 'mark-sold' | 'enable' | 'mark-expired' } | null>(null);
  const [removal, setRemoval] = useState<VoucherRemovalPreview | null>(null);
  const [removalError, setRemovalError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  const refresh = async () => {
    await client.invalidateQueries({ queryKey: voucherKeys.all });
  };
  const prepareRemoval = async (ids: number[]) => {
    setRemovalError('');
    try {
      setRemoval(await vouchersApi.removalPreview(ids));
    } catch (error) {
      setRemovalError(errorMessage(error));
    }
  };
  const download = async (voucher: Voucher, kind: 'pdf' | 'image') => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await vouchersApi.authorizePrint([voucher.id]);
      const blob = kind === 'pdf' ? await vouchersApi.pdf(voucher.id) : await vouchersApi.image(voucher.id);
      downloadBlob(blob, `voucher-${voucher.id}.${kind === 'pdf' ? 'pdf' : 'png'}`);
    } catch (error) {
      if (kind === 'pdf' && pdfRendererUnavailable(error)) {
        toast.info('Use the print dialog to save as PDF', 'The local PDF renderer is unavailable.');
        await printer.print([voucher.id]);
      } else {
        toast.error('Download unavailable', errorMessage(error));
      }
    } finally {
      setActionBusy(false);
    }
  };
  const downloadBulkPdf = async () => {
    if (actionBusy || selected.size === 0 || selected.size > 100) return;
    setActionBusy(true);
    try {
      const blob = await vouchersApi.bulkPdf([...selected]);
      downloadBlob(blob, 'vouchers.pdf');
    } catch (error) {
      if (isApiError(error) && error.status === 503 &&
        (error.message === 'The new print format is not enabled.' || pdfRendererUnavailable(error))) {
        toast.info('Use the print dialog to save as PDF',
          pdfRendererUnavailable(error) ? 'The local PDF renderer is unavailable.' :
            'Bulk PDF downloads will be available after voucher credential conversion.');
        await printer.print([...selected]);
      } else {
        toast.error('Could not download vouchers', errorMessage(error));
      }
    } finally {
      setActionBusy(false);
    }
  };

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
  const toggleAll = () => setSelected((previous) => {
    const next = new Set(previous);
    if (allSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    return next;
  });
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
    {
      key: 'username',
      header: <span className="inline-flex items-center gap-2">
        {(canPrint || canManage) && <Checkbox aria-label="Select all vouchers on this page"
          checked={allSelected} onChange={toggleAll} />}
        Voucher
      </span>,
      primary: true,
      cell: (v) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {(canPrint || canManage) && <Checkbox aria-label={`Select ${v.username}`}
              checked={visibleSelected.has(v.id)} onChange={() => toggleOne(v.id)}
              onClick={(e) => e.stopPropagation()} />}
            <Link
              to={`/vouchers/${v.id}`}
              onClick={(e) => e.stopPropagation()}
              className="dashboard-data-link font-mono text-sm font-bold tracking-wider break-all"
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
              className="inline-flex size-6 shrink-0 items-center justify-center rounded text-ink-400 transition hover:bg-surface-muted hover:text-ink-700"
            >
              {copiedId === v.id ? (
                <Check className="size-3.5 text-emerald-600" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (v) => <span className="font-semibold text-ink-900">{v.plan_name}</span>,
    },
    {
      key: 'price',
      header: 'Price',
      cell: (v) => <span className="tabular-nums text-ink-700">{v.price_display || 'Unavailable'}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortField: 'status',
      cell: (v) => <StatusBadge status={v.status} size="sm" dot />,
    },
    {
      key: 'devices',
      header: 'devices',
      cell: (v) => <span className="font-semibold text-ink-900">{v.device_limit} device{v.device_limit !== 1 ? 's' : ''}</span>,
    },
    {
      key: 'expires',
      header: 'Expires',
      sortField: 'expires_at',
      cell: (v) =>
        v.expires_at ? (
          <span className="text-xs font-medium text-ink-700" title={formatDateTime(v.expires_at)}>
            {formatDateTime(v.expires_at)}
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
      sortField: 'created_at',
      cell: (v) => (
        <span className="text-xs text-ink-600" title={formatDateTime(v.created_at)}>
          {formatDateTime(v.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 rv-portal">
      <div className="rv-portal-header">
        <div className="rv-portal-header-text">
          <h1 className="rv-portal-title">Voucher Inventory</h1>
          <p className="rv-portal-desc">
            Search, manage and export your hotspot access vouchers.
          </p>
        </div>
        <div className="rv-portal-actions">
          {canGenerate && (
            <Button
              leadingIcon={<Plus className="size-4" aria-hidden />}
              onClick={() => setGenerateOpen(true)}
            >
              Generate Voucher
            </Button>
          )}
          {canManage && <Button variant="secondary" onClick={() => setManualOpen(true)}>Manual Voucher</Button>}
        </div>
      </div>

      {/* Filter panel */}
      <section aria-labelledby="voucher-filters-title" className="rv-portal-card">
        <div className="rv-portal-card-head">
          <h2 id="voucher-filters-title" className="rv-portal-card-title">
            Filters
          </h2>
          <p className="rv-portal-card-count">
            {list.activeFilterCount > 0
              ? `${list.activeFilterCount} active`
              : 'Showing all records'}
          </p>
        </div>
        <div className="rv-voucher-filter-row">
          <div className="rv-voucher-filter-field">
            <label className="rv-voucher-filter-label" htmlFor="voucher-search">Search</label>
            <SearchInput
              id="voucher-search"
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search by username, access code or agent"
              ariaLabel="Search vouchers"
            />
          </div>
          <div className="rv-voucher-filter-field">
            <label className="rv-voucher-filter-label" htmlFor="voucher-created-from">Created from</label>
            <Input id="voucher-created-from" type="date" value={list.state.filters.created_from_day ?? ''} onChange={(event) => list.setFilter('created_from_day', event.target.value || undefined)} />
          </div>
          <div className="rv-voucher-filter-field">
            <label className="rv-voucher-filter-label" htmlFor="voucher-created-to">Created to</label>
            <Input id="voucher-created-to" type="date" value={list.state.filters.created_to_day ?? ''} onChange={(event) => list.setFilter('created_to_day', event.target.value || undefined)} />
          </div>
          {list.activeFilterCount > 0 && <Button variant="secondary" onClick={list.clearFilters}>Clear filters</Button>}
        </div>
      </section>

      <section aria-label="Workspace-wide voucher counts" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {(['available', 'sold', 'online', 'used', 'expired'] as const).map((key) => (
          <div key={key} className="rv-portal-card p-3">
            <p className="text-xs capitalize text-ink-500">{key}</p>
            <p className="text-xl font-semibold text-ink-900" aria-live="polite">{summary.isPending ? '…' : summary.data?.[key] ?? 'Unavailable'}</p>
          </div>
        ))}
      </section>
      {summary.isError && <Alert tone="warning" title="Voucher summary unavailable"
        actions={<Button size="sm" variant="secondary" onClick={() => void summary.refetch()}>Retry summary</Button>}>
        {summary.data ? 'Showing the last successful counts.' : 'The voucher list can still be used.'}
      </Alert>}

      {/* Records card */}
      <section aria-labelledby="voucher-records-title" className="rv-portal-card space-y-4">
        <div className="rv-portal-card-head">
          <div>
            <h2 id="voucher-records-title" className="rv-portal-card-title">
              Voucher records
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Sold includes successful purchases; Used means ever used. Both include codes later
              expired or disabled. Expired is based on the deadline; Disabled takes precedence.
            </p>
          </div>
          <div className="text-right">
            <p role="status" className="rv-portal-card-count">
              {query.isPlaceholderData
                ? 'Updating results...'
                : query.data
                  ? `${query.data.count} ${list.activeFilterCount ? 'matching' : 'total'} vouchers`
                  : query.isError
                    ? 'Voucher count unavailable'
                    : 'Loading vouchers...'}
            </p>
            {list.state.ordering === VOUCHERS_DEFAULT_ORDERING && <p className="mt-0.5 text-xs text-ink-500">Most recent first</p>}
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="overflow-x-auto pb-1">
          <VoucherStatusFilter
            value={statusTab}
            onChange={(v) => list.setFilter('status', v === 'all' ? undefined : v)}
          />
        </div>

        {/* Selection bar */}
        {(canPrint || canManage) && <div className="rv-voucher-selectbar">
          <span role="status" className="rv-voucher-selectbar-count">
            {selected.size} selected across pages
          </span>
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 p-1.5 dark:bg-brand-950/60">
              {canPrint && <Button
                size="sm"
                leadingIcon={<Printer className="h-4 w-4" aria-hidden />}
                loading={printer.printing}
                onClick={() => void printer.print([...selected])}
              >
                {printer.progress
                  ? `Preparing ${printer.progress.done}/${printer.progress.total}`
                  : 'Print selected'}
              </Button>}
              {canPrint && <Button size="sm" variant="secondary" loading={printer.printing}
                onClick={() => void printer.print([...selected], { showStatusLabels: true })}>
                Print with status
              </Button>}
              {canPrint && selected.size <= 100 && <Button size="sm" variant="secondary"
                leadingIcon={<FileDown className="h-4 w-4" aria-hidden />}
                loading={actionBusy} onClick={() => void downloadBulkPdf()}>
                Download PDF
              </Button>}
              {canPrint && selected.size > 100 && <span className="text-sm text-ink-600">Select at most 100 to download as PDF.</span>}
              {canManage && selected.size <= 100 && <Button size="sm" variant="danger" onClick={() => void prepareRemoval([...selected])} leadingIcon={<Trash2 className="h-4 w-4" aria-hidden />}>Remove selected</Button>}
              {selected.size > 100 && <span className="text-sm text-danger-700">Select at most 100 to remove.</span>}
              <Button
                size="sm"
                variant="ghost"
                aria-label="Clear selection"
                onClick={() => setSelected(new Set())}
              >
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}
        </div>}
        {removalError && <Alert tone="danger">{removalError}</Alert>}

        {query.isError && query.data && (
          <Alert tone="warning" title="Vouchers could not be refreshed"
            actions={<Button size="sm" variant="secondary" onClick={() => void query.refetch()}>Retry</Button>}>
            Showing the last loaded results.
          </Alert>
        )}

        {/* Data Table */}
        <div className="rv-portal-table">
          <DataTable
            caption="Vouchers"
            columns={columns}
            rowActionsHeader="Actions"
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
                description="Try another status, creation date or search term."
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
                  onMarkSold: (voucher) => setPendingStatus({ voucher, action: 'mark-sold' }),
                  onEnable: (voucher) => setPendingStatus({ voucher, action: 'enable' }),
                  onMarkExpired: (voucher) => setPendingStatus({ voucher, action: 'mark-expired' }),
                  onPdf: (voucher) => void download(voucher, 'pdf'),
                  onImage: (voucher) => void download(voucher, 'image'),
                  onDelete: (voucher) => void prepareRemoval([voucher.id]),
                  onEdit: (voucher) => navigate(`/vouchers/${voucher.id}?edit=1`),
                }}
              />
            )}
          />
        </div>

        {/* Pagination Section */}
        {query.data && query.data.count > 0 && (
          <div className="rv-portal-table-foot">
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
      </section>

      <ConfirmDialog
        open={pendingDisable !== null}
        onClose={() => setPendingDisable(null)}
        tone="danger"
        title={`Disable ${pendingDisable?.username ?? 'voucher'}?`}
        description="The code stops working for new logins. Eligible unused vouchers may be enabled again. Any active session is not cut off until it reconnects."
        confirmLabel="Disable voucher"
        onConfirm={async () => {
          if (!pendingDisable) return;
          await disable.mutateAsync(pendingDisable.id);
          toast.success('Voucher disabled', pendingDisable.username);
        }}
      />
      <ConfirmDialog open={pendingStatus !== null} onClose={() => setPendingStatus(null)}
        title={`${pendingStatus?.action.replaceAll('-', ' ')} ${pendingStatus?.voucher.username ?? 'voucher'}?`}
        description="This changes future voucher access. Existing active sessions are not disconnected."
        onConfirm={async () => {
          if (!pendingStatus) return;
          await vouchersApi.changeStatus(pendingStatus.voucher.id, pendingStatus.action);
          await refresh();
          toast.success('Voucher updated');
        }} />
      <ConfirmDialog open={removal !== null} onClose={() => setRemoval(null)} tone="danger"
        title={`Remove ${removal?.selected ?? 0} vouchers?`}
        description={`${removal?.potentially_deleted ?? 0} may be permanently deleted. ${removal?.preserved ?? 0} with history will be retained and hidden. New access is revoked; existing active sessions are not disconnected.`}
        confirmLabel="Remove vouchers" typeToConfirm="REMOVE"
        onConfirm={async () => {
          if (!removal) return;
          const result = await vouchersApi.removeSelected(removal.token, newIdempotencyKey('remove'));
          setSelected(new Set());
          await refresh();
          toast.success(`${result.deleted + result.preserved} vouchers removed`);
        }} />
      <Dialog open={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate Vouchers"
        description="Create a batch of hotspot access codes." size="lg">
        <GenerateVouchersPage embedded onDone={() => setGenerateOpen(false)} />
      </Dialog>
      <ManualCodeDialog open={manualOpen} onClose={() => setManualOpen(false)} />
    </div>
  );
}
