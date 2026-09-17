import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { usePrincipal } from '@/app/auth/useAuth';
import { Button, Card, Select, Input, Dialog } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { Pagination, SearchInput, useListParams } from '@/components/data';
import { http } from '@/services/api/http';
import type { Paginated } from '@/types/api';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatBytes } from '@/lib/formatting/units';
import { formatDateTime } from '@/lib/formatting/dates';
import { CustomerTabs } from './CustomerTabs';
import { usePlanOptions } from '@/features/plans/queries';
import { useRouterOptions } from '@/features/routers/queries';

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
const label = (value: string) => value.replaceAll('_', ' ');
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
  const [selected, setSelected] = useState<number | null>(null);
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
  const filters = [
    ['status', 'Code status', ['unused', 'sold', 'used', 'active', 'expired', 'disabled']],
    ['activity', 'Connection', ['online', 'offline', 'never_connected', 'unknown']],
    ['source', 'Source', ['admin', 'agent', 'customer']],
  ] as const;
  return (
    <div className="space-y-5">
      <CustomerTabs />
      <h1 className="text-2xl font-semibold">Customers</h1>
      <p>
        Access-code purchases and observed printed or agent voucher users. Each purchase remains
        separate.
      </p>
      <Card className="grid gap-4 p-4 md:grid-cols-3">
        <SearchInput
          value={list.state.search}
          onChange={list.setSearch}
          placeholder="Name, email, phone, reference or MAC"
        />
        {filters.map(([key, title, values]) => (
          <Select
            key={key}
            aria-label={title}
            value={list.state.filters[key] || ''}
            onChange={(e) => list.setFilter(key, e.target.value)}
            options={[
              { value: '', label: `All ${title.toLowerCase()}` },
              ...values.map((value) => ({
                value,
                label: value === 'used' ? 'Used (ever used)' : label(value),
              })),
            ]}
          />
        ))}
        <Select
          aria-label="Plan"
          value={list.state.filters.plan || ''}
          onChange={(e) => list.setFilter('plan', e.target.value)}
          options={[
            { value: '', label: 'All plans' },
            ...(plans.data || []).map((p) => ({ value: String(p.id), label: p.name })),
          ]}
        />
        <Select
          aria-label="Router"
          value={list.state.filters.router || ''}
          onChange={(e) => list.setFilter('router', e.target.value)}
          options={[
            { value: '', label: 'All routers' },
            ...(routers.data || []).map((r) => ({ value: String(r.id), label: r.name })),
          ]}
        />
        <label>
          Purchased / issued from
          <Input
            type="date"
            value={list.state.filters.start || ''}
            onChange={(e) => list.setFilter('start', e.target.value)}
          />
        </label>
        <label>
          Through
          <Input
            type="date"
            value={list.state.filters.end || ''}
            onChange={(e) => list.setFilter('end', e.target.value)}
          />
        </label>
        <Button onClick={() => void query.refetch()} disabled={!valid || query.isFetching}>
          Refresh
        </Button>
      </Card>
      <p className="text-sm text-ink-500">
        Used means ever used and can include expired or disabled codes. Never connected means no
        recorded session.
      </p>
      {!valid ? (
        <Alert tone="info">End date must not precede start date.</Alert>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isPending ? (
        <p role="status">Loading customers...</p>
      ) : (
        <>
          {!query.data.sync_fresh && (
            <Alert tone="info">
              Device synchronization is missing or stale. Purchases still appear; live connection
              evidence may be unavailable.
            </Alert>
          )}
          <p>
            {query.data.count} matching records ? Last accounting sync:{' '}
            {query.data.synced_at ? formatDateTime(query.data.synced_at) : 'Not yet recorded'}
          </p>
          {!query.data.results.length && (
            <Card className="p-6">No purchases or observed voucher users match these filters.</Card>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {query.data.results.map((row) => (
              <Card key={row.id} className="space-y-3 p-5">
                <h2 className="font-semibold">
                  {row.buyer_name || row.buyer_email || 'Unidentified voucher user'}
                </h2>
                <p>
                  {row.buyer_email} {row.buyer_phone}
                </p>
                <p>
                  {row.reference} ? {row.plan} ? {row.source}
                </p>
                <p>
                  Code: {row.status} ? Connection: {label(row.connection)}
                </p>
                <p>
                  {row.devices} devices ? {row.sessions} sessions ? {formatBytes(row.bytes_total)}
                </p>
                <p>Purchased / issued: {formatDateTime(row.date)}</p>
                <p>
                  Last seen: {row.last_seen ? formatDateTime(row.last_seen) : 'No recorded session'}
                </p>
                <Button variant="secondary" onClick={() => setSelected(row.id)}>
                  View details
                </Button>
              </Card>
            ))}
          </div>
          <Pagination
            count={query.data.count}
            page={list.state.page}
            totalPages={query.data.total_pages}
            pageSize={list.state.page_size}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
          />
        </>
      )}
      <Dialog
        open={selected !== null}
        onClose={() => setSelected(null)}
        title="Customer access details"
      >
        {detail.isPending ? (
          <p>Loading details...</p>
        ) : detail.isError ? (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
        ) : (
          detail.data && (
            <div className="space-y-3">
              <p>
                {detail.data.reference} ? {detail.data.plan}
              </p>
              <p>Access code: {detail.data.access_code || 'Hidden'}</p>
              <p>
                Expires:{' '}
                {detail.data.expires_at
                  ? formatDateTime(detail.data.expires_at)
                  : 'Not activated / no deadline recorded'}
              </p>
              <p>
                {detail.data.devices} devices ? {detail.data.sessions} sessions ?{' '}
                {formatBytes(detail.data.bytes_total)}
              </p>
              <Link to={`/customers/devices?voucher=${detail.data.id}`}>View device history</Link>
            </div>
          )
        )}
      </Dialog>
    </div>
  );
}
