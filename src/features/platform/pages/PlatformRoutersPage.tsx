import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { Radio, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { Button, Card, Select } from '@/components/ui';
import { Alert, EmptyState } from '@/components/feedback';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import type { DeploymentStatus, NasDevice, OnboardingState, RouterListParams } from '@/types/api';
import { RouterStateBadges } from '@/features/routers/components/RouterStateBadges';
import { ONBOARDING_FILTER_OPTIONS } from '@/features/routers/routerSchemas';
import { usePlatformRouters, useTenantIndex, useTenantName } from '../queries';
import { TenantSelect } from '../components/TenantSelect';

const FILTERS = ['tenant', 'onboarding_state', 'deployment_status', 'is_active'] as const;
const STATES = ONBOARDING_FILTER_OPTIONS.map((o) => o.value).filter(Boolean) as readonly string[];
const DEPLOYMENTS: readonly string[] = ['not_deployed', 'deploying', 'deployed', 'failed'];

/** `/platform/routers` — read-only fleet view across tenants (`platform/routers/`). */
export default function PlatformRoutersPage() {
  const list = useListParams(FILTERS);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const tenantName = useTenantName();
  const tenantIndex = useTenantIndex();
  useEffect(() => {
    document.title = 'Router fleet · Platform · Yarotech RADIUS';
  }, []);

  const params = useMemo<RouterListParams>(() => {
    const p: RouterListParams = { page: list.state.page, page_size: list.state.page_size };
    if (debouncedSearch) p.search = debouncedSearch;
    const tenant = Number(list.state.filters.tenant);
    if (Number.isInteger(tenant) && tenant > 0) p.tenant = tenant;
    const state = list.state.filters.onboarding_state;
    if (state && STATES.includes(state)) p.onboarding_state = state as OnboardingState;
    const dep = list.state.filters.deployment_status;
    if (dep && DEPLOYMENTS.includes(dep)) p.deployment_status = dep as DeploymentStatus;
    if (list.state.filters.is_active) p.is_active = list.state.filters.is_active === 'true';
    return p;
  }, [list.state, debouncedSearch]);
  const query = usePlatformRouters(params);

  const columns: Column<NasDevice>[] = [
    {
      key: 'name',
      header: 'Router',
      primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <div className="font-semibold break-words text-ink-900">{r.name}</div>
          <div className="mt-1 text-xs break-words text-ink-500">
            <code className="font-mono">{r.ip_address}</code>
            {r.location ? ` · ${r.location}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'tenant',
      header: 'Operator / tenant',
      cell: (r) => (
        <Link
          to={`/platform/tenants/${r.tenant}`}
          className="font-medium break-words text-brand-700 hover:underline"
        >
          {r.tenant_name || tenantName(r.tenant)}
        </Link>
      ),
    },
    { key: 'state', header: 'Setup status', cell: (r) => <RouterStateBadges router={r} /> },
    {
      key: 'vpn',
      header: 'VPN',
      hideBelow: 'lg',
      cell: (r) =>
        r.wireguard_ip ? (
          <code className="font-mono text-xs">{r.wireguard_ip}</code>
        ) : (
          <span className="text-ink-400">Not configured</span>
        ),
    },
    {
      key: 'seen',
      header: 'Last observation',
      hideBelow: 'md',
      cell: (r) =>
        r.last_seen_at ? (
          <time dateTime={r.last_seen_at} title={formatDateTime(r.last_seen_at)}>
            {formatRelative(r.last_seen_at)}
          </time>
        ) : (
          <span className="text-ink-400">No observation recorded</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Router fleet"
        description="Every MikroTik router registered on the platform. Onboarding actions happen inside each operator's workspace."
        actions={
          <Button
            variant="secondary"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            leadingIcon={
              <RefreshCw
                className={query.isFetching ? 'size-4 animate-spin' : 'size-4'}
                aria-hidden
              />
            }
          >
            Refresh fleet
          </Button>
        }
      />
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Radio className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-950">
              Router visibility across operators
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Find each router's operator, review onboarding and VPN deployment, and open the tenant
              profile for context. Router management remains in the operator workspace.
            </p>
            <p className="mt-3 text-sm text-brand-800">
              Setup status and the last recorded observation do not confirm that a router is
              currently online.
            </p>
          </div>
        </div>
      </Card>
      <section aria-labelledby="fleet-directory-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="fleet-directory-title" className="text-lg font-semibold text-brand-950">
            Fleet directory
          </h2>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} routers in this view`
                : query.isError
                  ? 'Router count unavailable'
                  : 'Loading routers...'}
          </p>
        </div>
        <FilterBar
          inline
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search name, IP or location"
              ariaLabel="Search routers"
            />
          }
          filters={
            <div className="flex items-center gap-2 [&>div]:w-44 [&>div]:shrink-0">
              <TenantSelect
                value={list.state.filters.tenant ?? ''}
                onChange={(v) => list.setFilter('tenant', v || undefined)}
              />
              <Select
                aria-label="Onboarding state"
                size="sm"
                value={list.state.filters.onboarding_state ?? ''}
                onChange={(e) => list.setFilter('onboarding_state', e.target.value || undefined)}
                options={ONBOARDING_FILTER_OPTIONS}
              />
              <Select
                aria-label="Deployment"
                size="sm"
                value={list.state.filters.deployment_status ?? ''}
                onChange={(e) => list.setFilter('deployment_status', e.target.value || undefined)}
                options={[
                  { value: '', label: 'Any deployment' },
                  { value: 'not_deployed', label: 'Not deployed' },
                  { value: 'deploying', label: 'Deploying' },
                  { value: 'deployed', label: 'Deployed' },
                  { value: 'failed', label: 'Failed' },
                ]}
              />
              <Select
                aria-label="Active"
                size="sm"
                value={list.state.filters.is_active ?? ''}
                onChange={(e) => list.setFilter('is_active', e.target.value || undefined)}
                options={[
                  { value: '', label: 'Active or not' },
                  { value: 'true', label: 'Active only' },
                  { value: 'false', label: 'Inactive only' },
                ]}
              />
            </div>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
        {tenantIndex.isError && (
          <Alert tone="warning" title="Tenant filters could not be loaded">
            Some tenant names or choices may be unavailable.
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              disabled={tenantIndex.isFetching}
              onClick={() => void tenantIndex.refetch()}
            >
              Retry tenant filters
            </Button>
          </Alert>
        )}
        {query.isError && query.data && (
          <Alert tone="warning" title="Fleet could not be refreshed">
            Showing the last loaded routers. Refresh again to check for changes.
          </Alert>
        )}
        <DataTable
          caption="Router fleet"
          columns={columns}
          rows={query.data?.results}
          rowKey={(r) => r.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          empty={
            <EmptyState
              icon={<Radio className="h-6 w-6" aria-hidden />}
              title={
                list.activeFilterCount > 0 || debouncedSearch
                  ? 'No routers match'
                  : 'No routers registered yet'
              }
              description={
                list.activeFilterCount > 0 || debouncedSearch
                  ? undefined
                  : 'Routers appear here once operators add them in their workspace.'
              }
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
            itemLabel="routers"
          />
        )}
      </section>
    </div>
  );
}
