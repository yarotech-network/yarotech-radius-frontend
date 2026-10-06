import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { MonitorSmartphone, RefreshCw, SlidersHorizontal, Users, X } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { Badge, Button, CopyButton, DescriptionList, Dialog, Input, Select } from '@/components/ui';
import type { BadgeTone } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/layout/StatusBadge';
import { Alert, EmptyState, ErrorState } from '@/components/feedback';
import { DataTable, Pagination, SearchInput, useListParams, type Column } from '@/components/data';
import { http } from '@/services/api/http';
import type { Paginated } from '@/types/api';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatBytes, formatNumber } from '@/lib/formatting/units';
import { formatDate, formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { CustomerTabs } from './CustomerTabs';
import { usePlanOptions } from '@/features/plans/queries';
import { useRouterOptions } from '@/features/routers/queries';
import { deviceUsageApi } from './deviceUsageApi';

type Access = {
  id: number;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  reference: string;
  plan: string;
  source: string;
  date: string;
  status: string;
  connection: string;
  devices: number;
  sessions: number;
  last_seen: string | null;
  bytes_total: number;
  expires_at: string | null;
  access_code: string | null;
};
type AccessResponse = Paginated<Access> & { synced_at: string | null; sync_fresh: boolean };
const FILTERS = ['status', 'activity', 'source', 'plan', 'router', 'start', 'end'] as const;
const MORE_FILTERS = ['source', 'plan', 'router', 'start', 'end'] as const;
const label = (value: string) => value.replaceAll('_', ' ');

const SOURCE_LABELS: Record<string, string> = {
  customer: 'Bought online',
  agent: 'Sold by agent',
  admin: 'Issued by staff',
};

/** Live connection: online stands out; offline is normal for a customer, so it stays neutral. */
const CONNECTION: Record<string, { tone: BadgeTone; text: string }> = {
  online: { tone: 'success', text: 'Online' },
  offline: { tone: 'neutral', text: 'Offline' },
  never_connected: { tone: 'outline', text: 'Never connected' },
  unknown: { tone: 'neutral', text: 'Unknown' },
};

function ConnectionBadge({ value }: { value: string }) {
  const known = CONNECTION[value] ?? { tone: 'neutral' as const, text: label(value) };
  return (
    <Badge tone={known.tone} size="sm" dot={value === 'online'}>
      {known.text}
    </Badge>
  );
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
  const moreActive = MORE_FILTERS.filter((key) => list.state.filters[key]).length;
  const [moreOpen, setMoreOpen] = useState(moreActive > 0);
  const params = { ...list.query, search };
  const valid =
    !list.state.filters.start ||
    !list.state.filters.end ||
    list.state.filters.start <= list.state.filters.end;
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
  const columns: Column<Access>[] = [
    {
      key: 'customer',
      header: 'Customer',
      primary: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className={row.buyer_name ? 'font-semibold text-ink-900' : 'text-ink-500 italic'}>
            {row.buyer_name || 'Name not provided'}
          </p>
          <p className="text-xs break-all text-ink-600">{row.buyer_email || 'No email'}</p>
          {row.buyer_phone && <p className="text-xs text-ink-500">{row.buyer_phone}</p>}
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (row) => (
        <div>
          <p className="text-ink-900">{row.plan}</p>
          <p className="text-xs text-ink-500">{SOURCE_LABELS[row.source] ?? label(row.source)}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Code status',
      cell: (row) => <StatusBadge status={row.status} size="sm" />,
    },
    {
      key: 'connection',
      header: 'Connection',
      cell: (row) => <ConnectionBadge value={row.connection} />,
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
      key: 'seen',
      header: 'Last seen',
      hideBelow: 'md',
      cell: (row) =>
        row.last_seen ? (
          <span className="whitespace-nowrap text-ink-700" title={formatDateTime(row.last_seen)}>
            {formatRelative(row.last_seen)}
          </span>
        ) : (
          <span className="text-xs whitespace-nowrap text-ink-400">No recorded session</span>
        ),
    },
    {
      key: 'date',
      header: 'Purchased',
      hideBelow: 'xl',
      cell: (row) => (
        <span className="whitespace-nowrap text-ink-600" title={formatDateTime(row.date)}>
          {formatDate(row.date)}
        </span>
      ),
    },
  ];
  const filters = [
    [
      'status',
      'Code status',
      'All code statuses',
      ['unused', 'sold', 'used', 'active', 'expired', 'disabled'],
    ],
    [
      'activity',
      'Connection',
      'All connections',
      ['online', 'offline', 'never_connected', 'unknown'],
    ],
  ] as const;
  const optionLabel = (value: string) =>
    value === 'used'
      ? 'Used (ever used)'
      : value === 'sold'
        ? 'Sold (purchase history)'
        : label(value);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Access history</p>
          <h1 className="text-2xl font-bold text-ink-900">Customers</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Access-code purchases and observed printed or agent voucher users. Each purchase remains
            separate.
          </p>
        </div>
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
      </header>

      <CustomerTabs />

      <section aria-label="Customer filters" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-72">
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Name, email, phone, ref or MAC"
              ariaLabel="Search customers"
            />
          </div>
          {filters.map(([key, title, allLabel, values]) => (
            <div key={key} className="w-full sm:w-48">
              <Select
                aria-label={title}
                size="sm"
                value={list.state.filters[key] || ''}
                onChange={(e) => list.setFilter(key, e.target.value)}
                options={[
                  { value: '', label: allLabel },
                  ...values.map((value) => ({ value, label: optionLabel(value) })),
                ]}
              />
            </div>
          ))}
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
              value={list.state.filters.source || ''}
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
              value={list.state.filters.plan || ''}
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
              value={list.state.filters.router || ''}
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
              value={list.state.filters.start || ''}
              onChange={(e) => list.setFilter('start', e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
            Through
            <Input
              type="date"
              value={list.state.filters.end || ''}
              onChange={(e) => list.setFilter('end', e.target.value)}
            />
          </label>
        </div>
        <p className="text-xs text-ink-500">
          Sold includes successful purchases; Used means ever used. Both can include expired or
          disabled codes. Never connected means no recorded session.
        </p>
      </section>

      {!valid ? (
        <Alert tone="info">End date must not precede start date.</Alert>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : (
        <section aria-label="Customer records" className="space-y-3">
          {query.data && !query.data.sync_fresh && (
            <Alert tone="info">
              Device synchronization is missing or stale. Purchases still appear; live connection
              evidence may be unavailable.
            </Alert>
          )}
          <p role="status" className="text-sm text-ink-500">
            {query.isPending
              ? 'Loading customers...'
              : `${formatNumber(query.data.count)} matching records · Last accounting sync: ${
                  query.data.synced_at ? formatDateTime(query.data.synced_at) : 'Not yet recorded'
                }`}
          </p>
          <DataTable
            columns={columns}
            rows={query.data?.results}
            rowKey={(row) => row.id}
            caption="Customer purchases and voucher users"
            loading={query.isPending}
            refreshing={query.isFetching && !query.isPending}
            onRowClick={(row) => setSelected(row.id)}
            rowActions={(row) => (
              <Button
                variant="secondary"
                size="sm"
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
          {query.data && query.data.count > 0 && (
            <Pagination
              count={query.data.count}
              page={list.state.page}
              totalPages={query.data.total_pages}
              pageSize={list.state.page_size}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              itemLabel="records"
            />
          )}
        </section>
      )}

      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
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

function AccessDetails({ access }: { access: Access }) {
  return (
    <div className="space-y-5">
      <div className="rounded-card border border-border bg-surface-muted p-4">
        <p className="text-xs font-medium text-ink-500">Access code</p>
        {access.access_code ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <code className="font-mono text-2xl font-bold tracking-widest break-all text-ink-900">
              {access.access_code}
            </code>
            <CopyButton value={access.access_code} label="Copy code" variant="secondary" />
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-500">Hidden</p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <StatusBadge status={access.status} size="sm" />
          <ConnectionBadge value={access.connection} />
        </div>
      </div>
      <DescriptionList
        items={[
          { label: 'Customer', value: access.buyer_name || 'Name not provided' },
          {
            label: 'Plan',
            value: `${access.plan} · ${SOURCE_LABELS[access.source] ?? label(access.source)}`,
          },
          { label: 'Email', value: access.buyer_email },
          { label: 'Phone', value: access.buyer_phone },
          {
            label: 'Reference',
            value: (
              <span className="inline-flex items-center gap-1">
                <code className="font-mono text-[13px] break-all">{access.reference}</code>
                <CopyButton value={access.reference} label="Copy reference" size="icon" />
              </span>
            ),
          },
          {
            label: 'Expires',
            value: access.expires_at
              ? formatDateTime(access.expires_at)
              : 'Not activated / no deadline recorded',
          },
          {
            label: 'Usage',
            value: `${formatNumber(access.devices)} ${access.devices === 1 ? 'device' : 'devices'} · ${formatNumber(access.sessions)} ${access.sessions === 1 ? 'session' : 'sessions'} · ${formatBytes(access.bytes_total)}`,
          },
          {
            label: 'Last seen',
            value: access.last_seen ? formatDateTime(access.last_seen) : 'No recorded session',
          },
        ]}
      />
      <CodeDevices voucherId={access.id} />
    </div>
  );
}

const DEVICE_STATUS: Record<string, { tone: BadgeTone; text: string }> = {
  online: { tone: 'success', text: 'Online' },
  offline: { tone: 'neutral', text: 'Offline' },
  unknown: { tone: 'neutral', text: 'Unknown' },
};

/** Devices (by MAC address) that have used this access code, from RADIUS accounting. */
function CodeDevices({ voucherId }: { voucherId: number }) {
  const devices = useQuery({
    queryKey: ['customer-access-devices', voucherId],
    queryFn: () => deviceUsageApi.list({ voucher: voucherId, page_size: 20 }),
    gcTime: 0,
  });
  return (
    <section aria-label="Devices on this code" className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
        <MonitorSmartphone aria-hidden className="size-4 text-ink-500" />
        Devices on this code
      </h3>
      {devices.isPending ? (
        <p role="status" className="text-sm text-ink-500">
          Loading devices...
        </p>
      ) : devices.isError ? (
        <ErrorState
          error={devices.error}
          title="Devices could not be loaded"
          onRetry={() => void devices.refetch()}
        />
      ) : devices.data.results.length === 0 ? (
        <p className="rounded-control bg-surface-muted px-3 py-2.5 text-sm text-ink-500">
          No device has a recorded session with this code yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border">
          {devices.data.results.map((device) => {
            const status = DEVICE_STATUS[device.status] ?? DEVICE_STATUS.unknown!;
            return (
              <li
                key={device.mac_address}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <code className="font-mono text-sm text-ink-900">{device.mac_address}</code>
                  <p className="text-xs text-ink-500">
                    Last seen {formatRelative(device.last_seen)} · {formatNumber(device.sessions)}{' '}
                    {device.sessions === 1 ? 'session' : 'sessions'} ·{' '}
                    {formatBytes(device.bytes_total)}
                  </p>
                </div>
                <Badge tone={status.tone} size="sm" dot={device.status === 'online'}>
                  {status.text}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      {devices.data && devices.data.count > devices.data.results.length && (
        <p className="text-xs text-ink-500">
          Showing {devices.data.results.length} of {formatNumber(devices.data.count)} devices.
        </p>
      )}
    </section>
  );
}
