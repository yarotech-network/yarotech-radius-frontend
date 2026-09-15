import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Users, Ticket, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, Dialog, Select, Input } from '@/components/ui';
import { ErrorState, Alert } from '@/components/feedback';
import { Pagination, SearchInput, useListParams } from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatBytes } from '@/lib/formatting/units';
import { formatDateTime } from '@/lib/formatting/dates';
import { deviceUsageApi } from './deviceUsageApi';

const FILTERS = ['period', 'activity', 'start', 'end'] as const;
const statuses = {
  online: 'Online (recent accounting)',
  offline: 'Offline',
  unknown: 'Connection unknown',
};

export default function CustomersPage() {
  const principal = usePrincipal();
  const scope =
    principal.kind === 'member'
      ? principal.tenantId
      : principal.kind === 'platform_staff'
        ? principal.activeTenantId
        : null;
  const list = useListParams(FILTERS);
  const search = useDebouncedValue(list.state.search);
  const period = list.state.filters.period || 'all';
  const activity = list.state.filters.activity || 'all';
  const start = list.state.filters.start || '';
  const end = list.state.filters.end || '';
  const validDates = period !== 'custom' || Boolean(start && end && start <= end);
  const params = {
    period,
    activity,
    search,
    ...(period === 'custom' ? { start, end } : {}),
    page: list.state.page,
    page_size: list.state.page_size,
  };
  const [selected, setSelected] = useState<string | null>(null);
  const [codePage, setCodePage] = useState(1);
  const query = useQuery({
    queryKey: ['customer-devices', scope, principal.user.id, params],
    queryFn: () => deviceUsageApi.list(params),
    enabled: validDates,
    refetchInterval: 60_000,
  });
  const detailParams = { ...params, page: codePage, page_size: 10 };
  const detail = useQuery({
    queryKey: ['customer-device-codes', scope, principal.user.id, selected, detailParams],
    queryFn: () => deviceUsageApi.codes(selected!, detailParams),
    enabled: Boolean(selected) && validDates,
    gcTime: 0,
  });
  const change = (name: (typeof FILTERS)[number], value: string) => {
    setSelected(null);
    list.setFilter(name, value);
  };
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Customers"
        description="Internet users identified by device MAC address. Access codes used, not purchases or login attempts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/sessions"
              className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700"
            >
              Live sessions
            </Link>
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw />}
              disabled={query.isFetching || !validDates}
              onClick={() => void query.refetch()}
            >
              Refresh
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-5">
          <Users className="mb-3 size-5 text-brand-600" />
          <p className="text-sm text-ink-500">Devices in selected period</p>
          <p className="mt-1 text-3xl font-semibold">
            {validDates ? (query.data?.summary.devices ?? '--') : '--'}
          </p>
        </Card>
        <Card className="p-5">
          <Ticket className="mb-3 size-5 text-brand-600" />
          <p className="text-sm text-ink-500">Distinct access codes used</p>
          <p className="mt-1 text-3xl font-semibold">
            {validDates ? (query.data?.summary.distinct_codes ?? '--') : '--'}
          </p>
          <p className="mt-2 text-xs text-ink-500">
            A shared code counts once across matching devices.
          </p>
        </Card>
      </div>
      <Card className="grid gap-4 p-4 md:grid-cols-3">
        <SearchInput
          value={list.state.search}
          onChange={list.setSearch}
          placeholder="Search device MAC address"
        />
        <Select
          aria-label="Activity period"
          value={period}
          onChange={(e) => change('period', e.target.value)}
          options={[
            { value: 'all', label: 'All time' },
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'This week' },
            { value: 'month', label: 'This month' },
            { value: 'custom', label: 'Custom dates' },
          ]}
        />
        <Select
          aria-label="Connection status"
          value={activity}
          onChange={(e) => change('activity', e.target.value)}
          options={[
            { value: 'all', label: 'All connections' },
            { value: 'online', label: 'Online now (recent accounting)' },
            { value: 'offline', label: 'Offline (closed sessions)' },
            { value: 'unknown', label: 'Connection unknown' },
          ]}
        />
        {period === 'custom' && (
          <>
            <label className="text-sm">
              From
              <Input type="date" value={start} onChange={(e) => change('start', e.target.value)} />
            </label>
            <label className="text-sm">
              Through
              <Input type="date" value={end} onChange={(e) => change('end', e.target.value)} />
            </label>
          </>
        )}
      </Card>
      {!validDates ? (
        <Alert tone="info">Choose a start date and an end date on or after it.</Alert>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <Card className="p-8" role="status">
          Loading device history...
        </Card>
      ) : (
        <>
          <p className="text-sm text-ink-500">
            {query.data.synced_at
              ? `Last accounting sync: ${formatDateTime(query.data.synced_at)}`
              : 'Waiting for the first accounting sync.'}{' '}
            | Dates: {query.data.timezone}
          </p>
          {!query.data.results.length ? (
            <Card className="px-6 py-12 text-center">
              <Users className="mx-auto mb-4 size-9 text-brand-600" />
              <h2 className="text-lg font-semibold">No observed devices</h2>
              <p className="mt-2 text-sm text-ink-500">
                Devices appear automatically after accounting records include their MAC and a tenant
                access code. Try a different period or connection filter.
              </p>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {query.data.results.map((device) => (
                <Card key={device.mac_address} className="min-w-0 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-mono font-semibold break-all">{device.mac_address}</h2>
                    <span
                      className={
                        device.status === 'online'
                          ? 'text-xs text-success-700'
                          : 'text-xs text-ink-500'
                      }
                    >
                      {statuses[device.status]}
                    </span>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-ink-500">Codes used in period</dt>
                      <dd className="mt-1 text-2xl font-semibold">{device.codes_used}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Lifetime codes used</dt>
                      <dd className="mt-1 text-2xl font-semibold">{device.lifetime_codes_used}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Recorded sessions</dt>
                      <dd>{device.sessions}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Recorded data</dt>
                      <dd>{formatBytes(device.bytes_total)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">First matching session</dt>
                      <dd>{formatDateTime(device.first_seen)}</dd>
                    </div>
                    <div>
                      <dt className="text-ink-500">Last recorded activity</dt>
                      <dd>{formatDateTime(device.last_seen)}</dd>
                    </div>
                  </dl>
                  <Button
                    className="mt-5"
                    variant="secondary"
                    onClick={() => {
                      setSelected(device.mac_address);
                      setCodePage(1);
                    }}
                  >
                    View access-code history
                  </Button>
                </Card>
              ))}
            </div>
          )}
          <Pagination
            count={query.data.count}
            totalPages={query.data.total_pages}
            page={list.state.page}
            pageSize={list.state.page_size}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            itemLabel="devices"
          />
          <Alert tone="info">
            {query.data.accounting_note} Reconnecting with the same code does not increase codes
            used. A device can have used more than one unexpired code.
          </Alert>
        </>
      )}
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Access-code history"
        description={selected}
        size="lg"
      >
        {detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        ) : detail.isPending ? (
          <p role="status">Loading access-code history...</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-500">
              Distinct codes used by this MAC in the selected period. This does not identify who
              purchased them.
            </p>
            {!detail.data.results.length && <p>No codes used in this period.</p>}
            {detail.data.results.map((code) => (
              <Card key={code.voucher_id} className="p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <h3 className="font-mono font-semibold break-all">
                    {code.access_code}{' '}
                    <span className="font-sans text-xs text-ink-500">
                      Voucher #{code.voucher_id}
                    </span>
                  </h3>
                  <span className="text-sm capitalize">{code.status}</span>
                </div>
                <p className="mt-2 text-sm">
                  {code.plan} | Device allowance: {code.device_limit}
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ink-500">First matching use</dt>
                    <dd>{formatDateTime(code.first_seen)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Last used</dt>
                    <dd>{formatDateTime(code.last_seen)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Expires</dt>
                    <dd>{code.expires_at ? formatDateTime(code.expires_at) : 'Not set'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Sessions / data</dt>
                    <dd>
                      {code.sessions} / {formatBytes(code.bytes_total)}
                    </dd>
                  </div>
                </dl>
              </Card>
            ))}
            <Pagination
              count={detail.data.count}
              page={codePage}
              totalPages={detail.data.total_pages}
              pageSize={10}
              onPageChange={setCodePage}
              itemLabel="access codes"
            />
          </div>
        )}
      </Dialog>
    </div>
  );
}
