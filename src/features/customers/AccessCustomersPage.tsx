import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import {
  ChevronRight,
  Globe,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Store,
  Users,
  X,
} from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { Button, Card, Dialog, Input, SegmentedControl, Select } from '@/components/ui';
import { KpiTile, MiniBar } from '@/components/layout';
import { StatusBadge } from '@/components/layout/StatusBadge';
import { Alert, EmptyState, ErrorState } from '@/components/feedback';
import { DataTable, Pagination, SearchInput, useListParams, type Column } from '@/components/data';
import { http } from '@/services/api/http';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { cn } from '@/lib/utilities/cn';
import { formatBytes, formatNumber } from '@/lib/formatting/units';
import { formatDate, formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { CustomerTabs } from './CustomerTabs';
import { usePlanOptions } from '@/features/plans/queries';
import { useRouterOptions } from '@/features/routers/queries';
import { AccessDetails, ConnectionBadge, CustomerAvatar } from './AccessDetails';
import {
  CONNECTION,
  SOURCE_LABELS,
  expiryText,
  label,
  type Access,
  type AccessResponse,
  type ConnectionState,
} from './customerAccess';

const FILTERS = ['status', 'activity', 'source', 'plan', 'router', 'start', 'end'] as const;
const MORE_FILTERS = ['source', 'plan', 'router', 'start', 'end'] as const;
const CONNECTION_ORDER: ConnectionState[] = ['online', 'offline', 'never_connected', 'unknown'];
const STATUSES = ['unused', 'sold', 'used', 'active', 'expired', 'disabled'] as const;

const SOURCE_ICONS = { customer: Globe, agent: Store, admin: ShieldCheck } as const;
const SOURCE_COLORS: Record<string, string> = {
  customer: 'var(--color-brand-600)',
  agent: 'var(--color-success-600)',
  admin: 'var(--color-ink-300)',
};

/** Sentence-case label for a code status filter option or chip. */
function statusLabel(value: string) {
  if (value === 'used') return 'Used (ever used)';
  if (value === 'sold') return 'Sold (purchase history)';
  const text = label(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function AccessCustomersPage() {
  const principal = usePrincipal();
  const scope =
    principal.kind === 'member'
      ? principal.tenantId
      : principal.kind === 'platform_staff'
        ? principal.activeTenantId
        : null;
  const list = useListParams(FILTERS);
  const plans = usePlanOptions(false);
  const routers = useRouterOptions();
  const search = useDebouncedValue(list.state.search);
  // The open record lives in the URL (?details=<id>) so it can be shared or linked to.
  const [urlParams, setUrlParams] = useSearchParams();
  const selected = Number(urlParams.get('details')) || null;
  function setSelected(id: number | null) {
    setUrlParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('details', String(id));
        else next.delete('details');
        return next;
      },
      { replace: true },
    );
  }
  const filters = list.state.filters;
  const moreActive = MORE_FILTERS.filter((key) => filters[key]).length;
  const [moreOpen, setMoreOpen] = useState(moreActive > 0);
  const params = { ...list.query, search };
  const valid = !filters.start || !filters.end || filters.start <= filters.end;
  const query = useQuery({
    queryKey: ['customer-access', scope, principal.user.id, params],
    queryFn: () => http.get<AccessResponse>('/customer-access/', params),
    refetchInterval: 30_000,
    enabled: valid,
  });
  const detail = useQuery({
    queryKey: ['customer-access-detail', scope, principal.user.id, selected],
    queryFn: () => http.get<Access>(`/customer-access/${selected}/`),
    enabled: selected !== null,
    gcTime: 0,
  });
  const data = query.data;
  const summary = data?.summary;

  const columns: Column<Access>[] = [
    {
      key: 'customer',
      header: 'Customer',
      primary: true,
      cell: (row) => (
        <div className="flex min-w-52 items-center gap-3">
          <CustomerAvatar access={row} />
          <div className="min-w-0">
            <p className={row.buyer_name ? 'font-semibold text-ink-900' : 'text-ink-500 italic'}>
              {row.buyer_name || 'Name not provided'}
            </p>
            <p className="text-xs break-all text-ink-600">{row.buyer_email || 'No email'}</p>
            {row.buyer_phone && <p className="text-xs text-ink-500">{row.buyer_phone}</p>}
          </div>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (row) => {
        const Icon = SOURCE_ICONS[row.source as keyof typeof SOURCE_ICONS];
        return (
          <div className="min-w-0">
            <p className="font-medium text-ink-900">{row.plan}</p>
            <p className="inline-flex items-center gap-1 text-xs whitespace-nowrap text-ink-500">
              {Icon && <Icon aria-hidden className="size-3.5 shrink-0" />}
              {SOURCE_LABELS[row.source] ?? label(row.source)}
            </p>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Code status',
      cell: (row) => (
        <div className="space-y-1">
          <StatusBadge status={row.status} size="sm" />
          <p
            className="text-xs whitespace-nowrap text-ink-500"
            title={row.expires_at ? formatDateTime(row.expires_at) : undefined}
          >
            {expiryText(row)}
          </p>
        </div>
      ),
    },
    {
      key: 'connection',
      header: 'Connection',
      cell: (row) => (
        <div className="space-y-1">
          <ConnectionBadge value={row.connection} />
          <p className="text-xs whitespace-nowrap text-ink-500">
            {row.last_seen ? (
              <span title={formatDateTime(row.last_seen)}>
                Seen {formatRelative(row.last_seen)}
              </span>
            ) : (
              'No recorded session'
            )}
          </p>
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      align: 'right',
      hideBelow: 'lg',
      cell: (row) => (
        <div className="whitespace-nowrap">
          <p className="font-medium text-ink-900 tabular-nums">{formatBytes(row.bytes_total)}</p>
          <p className="text-xs text-ink-500">
            {formatNumber(row.devices)} {row.devices === 1 ? 'device' : 'devices'} ·{' '}
            {formatNumber(row.sessions)} {row.sessions === 1 ? 'session' : 'sessions'}
          </p>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Purchased',
      hideBelow: 'xl',
      cell: (row) => (
        <div className="whitespace-nowrap" title={formatDateTime(row.date)}>
          <p className="text-ink-700">{formatDate(row.date)}</p>
          <p className="text-xs text-ink-500">{formatRelative(row.date)}</p>
        </div>
      ),
    },
  ];

  // Removable chips for everything narrowing the list, so nothing filters out of sight.
  const chips = [
    filters.status && { key: 'status', text: `Status: ${statusLabel(filters.status)}` },
    filters.source && {
      key: 'source',
      text: `Source: ${SOURCE_LABELS[filters.source] ?? label(filters.source)}`,
    },
    filters.plan && {
      key: 'plan',
      text: `Plan: ${plans.data?.find((p) => String(p.id) === filters.plan)?.name ?? filters.plan}`,
    },
    filters.router && {
      key: 'router',
      text: `Router: ${routers.data?.find((r) => String(r.id) === filters.router)?.name ?? 'Selected'}`,
    },
    filters.start && { key: 'start', text: `From ${formatDate(filters.start)}` },
    filters.end && { key: 'end', text: `Through ${formatDate(filters.end)}` },
  ].filter(Boolean) as { key: (typeof FILTERS)[number]; text: string }[];

  const connectionOptions = [
    { value: '', label: <OptionCount text="All" count={summary?.total} /> },
    ...CONNECTION_ORDER.map((state) => ({
      value: state,
      label: <OptionCount text={CONNECTION[state]!.text} count={summary?.connection[state]} />,
    })),
  ];
  const online = summary?.connection.online ?? 0;
  const sources = summary?.sources ?? {};

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Access history</p>
          <h1 className="text-2xl font-bold text-ink-900">Customers</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Everyone who bought an access code or used a printed or agent voucher. Each purchase is
            its own record.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && <SyncPill fresh={data.sync_fresh} syncedAt={data.synced_at} />}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={!valid || query.isFetching}
            leadingIcon={
              <RefreshCw
                className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
              />
            }
          >
            Refresh
          </Button>
        </div>
      </header>

      <CustomerTabs />

      {(query.isPending || summary) && (
        <section aria-label="Customer summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiTile
            label="Customer records"
            value={summary ? formatNumber(summary.total) : '—'}
            detail={
              summary
                ? `${formatNumber(sources.customer ?? 0)} bought online · ${formatNumber(sources.agent ?? 0)} agent · ${formatNumber(sources.admin ?? 0)} staff`
                : 'Purchases and voucher users'
            }
            extra={
              summary && summary.total > 0 ? (
                <MiniBar
                  parts={Object.keys(SOURCE_LABELS).map((key) => ({
                    value: sources[key] ?? 0,
                    color: SOURCE_COLORS[key]!,
                  }))}
                />
              ) : undefined
            }
            loading={query.isPending}
          />
          <KpiTile
            label="Online now"
            live={online > 0}
            value={summary ? formatNumber(online) : '—'}
            detail={
              data && !data.sync_fresh
                ? 'Device sync delayed — may be out of date'
                : summary && summary.total > 0
                  ? `${Math.round((online / summary.total) * 100)}% of customers connected`
                  : 'Connected in the last 5 minutes'
            }
            loading={query.isPending}
          />
          <KpiTile
            label="Never connected"
            value={summary ? formatNumber(summary.connection.never_connected) : '—'}
            detail="Bought or issued, no session yet"
            loading={query.isPending}
          />
          <KpiTile
            label="Data used"
            value={summary ? formatBytes(summary.bytes_total) : '—'}
            detail="Across the records shown"
            loading={query.isPending}
          />
        </section>
      )}

      <Card padded={false} className="space-y-4 p-4 md:p-5">
        <section aria-label="Customer filters" className="space-y-3">
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              ariaLabel="Connection"
              size="sm"
              options={connectionOptions}
              value={(filters.activity ?? '') as '' | ConnectionState}
              onChange={(value) => list.setFilter('activity', value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-72">
              <SearchInput
                value={list.state.search}
                onChange={list.setSearch}
                placeholder="Name, email, phone, ref or MAC"
                ariaLabel="Search customers"
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                aria-label="Code status"
                size="sm"
                value={filters.status || ''}
                onChange={(e) => list.setFilter('status', e.target.value)}
                options={[
                  { value: '', label: 'All code statuses' },
                  ...STATUSES.map((value) => ({ value, label: statusLabel(value) })),
                ]}
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={moreOpen}
              aria-controls="customer-more-filters"
              leadingIcon={<SlidersHorizontal className="size-4" aria-hidden />}
              onClick={() => setMoreOpen((open) => !open)}
            >
              More filters{moreActive > 0 ? ` (${moreActive})` : ''}
            </Button>
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
          <div
            id="customer-more-filters"
            hidden={!moreOpen}
            className="grid gap-3 rounded-card border border-border bg-surface-muted p-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
              Source
              <Select
                aria-label="Source"
                size="sm"
                value={filters.source || ''}
                onChange={(e) => list.setFilter('source', e.target.value)}
                options={[
                  { value: '', label: 'All sources' },
                  ...Object.entries(SOURCE_LABELS).map(([value, text]) => ({ value, label: text })),
                ]}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
              Plan
              <Select
                aria-label="Plan"
                size="sm"
                value={filters.plan || ''}
                onChange={(e) => list.setFilter('plan', e.target.value)}
                options={[
                  { value: '', label: 'All plans' },
                  ...(plans.data || []).map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
              Router
              <Select
                aria-label="Router"
                size="sm"
                value={filters.router || ''}
                onChange={(e) => list.setFilter('router', e.target.value)}
                options={[
                  { value: '', label: 'All routers' },
                  ...(routers.data || []).map((r) => ({ value: String(r.id), label: r.name })),
                ]}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
              Purchased from
              <Input
                type="date"
                value={filters.start || ''}
                onChange={(e) => list.setFilter('start', e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
              Through
              <Input
                type="date"
                value={filters.end || ''}
                onChange={(e) => list.setFilter('end', e.target.value)}
              />
            </label>
          </div>
          {chips.length > 0 && (
            <ul aria-label="Active filters" className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <li key={chip.key}>
                  <button
                    type="button"
                    onClick={() => list.setFilter(chip.key, '')}
                    aria-label={`Remove filter ${chip.text}`}
                    className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-800 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-600"
                  >
                    {chip.text}
                    <X aria-hidden className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {!valid ? (
          <Alert tone="info">End date must not precede start date.</Alert>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : (
          <section aria-label="Customer records" className="space-y-3">
            {data && !data.sync_fresh && (
              <Alert tone="info">
                Device synchronization is missing or stale. Purchases still appear; live connection
                evidence may be unavailable.
              </Alert>
            )}
            <p role="status" className="text-sm text-ink-500">
              {!data
                ? 'Loading customers...'
                : `${formatNumber(data.count)} matching ${data.count === 1 ? 'record' : 'records'} · Last accounting sync: ${
                    data.synced_at ? formatDateTime(data.synced_at) : 'Not yet recorded'
                  }`}
            </p>
            <DataTable
              columns={columns}
              rows={data?.results}
              rowKey={(row) => row.id}
              caption="Customer purchases and voucher users"
              loading={query.isPending}
              refreshing={query.isFetching && !query.isPending}
              onRowClick={(row) => setSelected(row.id)}
              rowActions={(row) => (
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ChevronRight aria-hidden />}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(row.id);
                  }}
                >
                  View details
                </Button>
              )}
              empty={
                <EmptyState
                  icon={<Users className="size-6" aria-hidden />}
                  title="No customers match"
                  description="No purchases or observed voucher users match these filters."
                  action={
                    list.activeFilterCount > 0 ? (
                      <Button variant="secondary" onClick={list.clearFilters}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                />
              }
            />
            {data && data.count > 0 && (
              <Pagination
                count={data.count}
                page={list.state.page}
                totalPages={data.total_pages}
                pageSize={list.state.page_size}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                itemLabel="records"
              />
            )}
          </section>
        )}
      </Card>

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        variant="drawer"
        size="md"
        title="Customer access details"
      >
        {detail.isPending ? (
          <p role="status" className="text-sm text-ink-500">
            Loading details...
          </p>
        ) : detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        ) : (
          detail.data && <AccessDetails access={detail.data} />
        )}
      </Dialog>
    </div>
  );
}

function OptionCount({ text, count }: { text: string; count: number | undefined }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      {text}
      {count !== undefined && (
        <span className="rounded-full bg-fill px-1.5 text-[11px] font-semibold text-ink-600 tabular-nums">
          {formatNumber(count)}
        </span>
      )}
    </span>
  );
}

/** How current the live connection evidence is. */
function SyncPill({ fresh, syncedAt }: { fresh: boolean; syncedAt: string | null }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        fresh
          ? 'border-success-100 bg-success-50 text-success-700'
          : 'border-warning-100 bg-warning-50 text-warning-700',
      )}
      title={syncedAt ? `Last accounting sync ${formatDateTime(syncedAt)}` : undefined}
    >
      <span
        aria-hidden
        className={cn('size-1.5 rounded-full', fresh ? 'bg-success-600' : 'bg-warning-600')}
      />
      {fresh
        ? `Live · synced ${syncedAt ? formatRelative(syncedAt) : 'recently'}`
        : 'Device sync delayed'}
    </span>
  );
}
