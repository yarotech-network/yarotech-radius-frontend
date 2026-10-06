import { RouterConnectionBadge } from '../components/RouterTelemetry';
import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AddRouterDialog } from '../components/AddRouterDialog';
import { ArrowUpRight, Plus, Radio, RefreshCw } from 'lucide-react';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { Button, ButtonLink, Select } from '@/components/ui';
import { Alert, EmptyState } from '@/components/feedback';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { can } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import type { DeploymentStatus, NasDevice, OnboardingState, RouterListParams } from '@/types/api';
import { RouterStateBadges } from '../components/RouterStateBadges';
import { ROUTERS_DEFAULT_ORDERING, useRouters } from '../queries';
import { FleetSummary } from '../components/FleetSummary';
import { useNetworkSummary } from '@/features/dashboard/queries';
import { formatNumber } from '@/lib/formatting/units';
import { RouterSetupGuide } from '../components/RouterSetupGuide';
import { ONBOARDING_FILTER_OPTIONS } from '../routerSchemas';

const FILTERS = ['onboarding_state', 'deployment_status', 'is_active'] as const;
const STATES = ONBOARDING_FILTER_OPTIONS.map((o) => o.value).filter(Boolean) as readonly string[];
const DEPLOYMENTS: readonly string[] = ['not_deployed', 'deploying', 'deployed', 'failed'];

export default function RoutersPage() {
  const principal = usePrincipal();
  const navigate = useNavigate();
  const location = useLocation();
  const canManage = can(principal, 'routers.manage');
  const [guideOpen, setGuideOpen] = useState(false);
  const isNewRoute = location.pathname.replace(/\/+$/, '') === '/routers/new';
  const dialogOpen = isNewRoute && canManage;
  // Preserve fleet filters when opening/closing the popup: the dialog route
  // carries the same search string as the fleet underneath.
  const addRouterTo = `/routers/new${location.search}`;
  const fleetTo = `/routers${location.search}`;
  function closeDialog() {
    navigate(fleetTo, { replace: true });
  }
  const list = useListParams(FILTERS, { ordering: ROUTERS_DEFAULT_ORDERING });
  const debouncedSearch = useDebouncedValue(list.state.search);
  const params = useMemo<RouterListParams>(() => {
    const p: RouterListParams = { page: list.state.page, page_size: list.state.page_size };
    if (debouncedSearch) p.search = debouncedSearch;
    if (list.state.ordering) p.ordering = list.state.ordering;
    const state = list.state.filters.onboarding_state;
    if (state && STATES.includes(state)) p.onboarding_state = state as OnboardingState;
    const dep = list.state.filters.deployment_status;
    if (dep && DEPLOYMENTS.includes(dep)) p.deployment_status = dep as DeploymentStatus;
    if (['true', 'false'].includes(list.state.filters.is_active ?? ''))
      p.is_active = list.state.filters.is_active === 'true';
    return p;
  }, [list.state, debouncedSearch]);
  const query = useRouters(params);
  // Same cached observation the fleet summary uses; gives live users per router.
  const networkAllowed = can(principal, 'sessions.view') && can(principal, 'routers.view');
  const network = useNetworkSummary(true, networkAllowed);
  const usersByRouter = useMemo(
    () => new Map(network.data?.routers.map((r) => [r.id, r.online_users]) ?? []),
    [network.data],
  );

  const columns: Column<NasDevice>[] = [
    {
      key: 'name',
      header: 'Router',
      primary: true,
      sortField: 'name',
      cell: (r) => (
        <div className="min-w-0">
          <Link
            to={`/routers/${r.id}`}
            onClick={(e) => e.stopPropagation()}
            className="dashboard-data-link font-semibold break-words"
          >
            {r.name}
          </Link>
          <div className="mt-1 text-xs break-words text-ink-500">
            <code className="font-mono break-all">{r.ip_address}</code>
            {r.location ? ` · ${r.location}` : ''}
          </div>
        </div>
      ),
    },
    { key: 'state', header: 'Setup status', cell: (r) => <RouterStateBadges router={r} /> },
    {
      key: 'connection',
      header: 'Connection',
      cell: (r) => <RouterConnectionBadge health={query.isError ? undefined : r.health} />,
    },
    ...(networkAllowed
      ? [
          {
            key: 'users',
            header: 'Online users',
            align: 'right' as const,
            hideBelow: 'md' as const,
            cell: (r: NasDevice) => {
              const users = usersByRouter.get(r.id);
              return users === undefined ? (
                <span className="text-ink-400" title="No current observation for this router">
                  —
                </span>
              ) : (
                <span className="font-medium text-ink-900 tabular-nums">{formatNumber(users)}</span>
              );
            },
          },
        ]
      : []),
    {
      key: 'vpn',
      header: 'VPN',
      hideBelow: 'lg',
      cell: (r) =>
        r.wireguard_ip ? (
          <code className="font-mono text-xs break-all">{r.wireguard_ip}</code>
        ) : (
          <span className="text-ink-400">Not configured</span>
        ),
    },
    {
      key: 'seen',
      header: 'Last seen',
      hideBelow: 'md',
      sortField: 'last_seen_at',
      cell: (r) =>
        r.last_seen_at ? (
          <span title={formatDateTime(r.last_seen_at)}>{formatRelative(r.last_seen_at)}</span>
        ) : (
          <span className="text-ink-400">No observation recorded</span>
        ),
    },
  ];

  return (
    <div className="router-page rv-portal space-y-6">
      {/* Compact portal-style header */}
      <div className="rv-portal-header">
        <div className="rv-portal-header-text">
          <p className="rv-portal-eyebrow">Network Infrastructure</p>
          <h1 className="rv-portal-title">Router Fleet</h1>
          <p className="rv-portal-desc">
            MikroTik hotspots registered as RADIUS clients — onboarding, VPN and provisioning in one
            place.
          </p>
          <div className="rv-portal-header-meta">
            <span role="status">
              {query.data
                ? `${query.data.count} total router${query.data.count !== 1 ? 's' : ''}`
                : 'Loading fleet...'}
            </span>
            <span aria-hidden>·</span>
            <span>MikroTik · RADIUS NAS</span>
            <span aria-hidden>·</span>
            <button
              type="button"
              className="rounded-sm font-semibold text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              aria-expanded={guideOpen}
              aria-controls="router-setup-guide"
              onClick={() => setGuideOpen((open) => !open)}
            >
              Setup guide
            </button>
            {canManage && (
              <Link
                to="/routers/operations"
                className="rounded-sm font-semibold text-brand-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Provisioning ops
              </Link>
            )}
          </div>
        </div>
        <div className="rv-portal-actions">
          <Button
            variant="secondary"
            disabled={query.isFetching}
            leadingIcon={
              <RefreshCw
                className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
              />
            }
            aria-label="Refresh routers"
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
          {canManage && (
            <ButtonLink to={addRouterTo} leadingIcon={<Plus className="size-4" aria-hidden />}>
              Add router
            </ButtonLink>
          )}
        </div>
      </div>

      <div id="router-setup-guide" hidden={!guideOpen}>
        <RouterSetupGuide canManage={canManage} />
      </div>

      <FleetSummary />

      {/* Router directory */}
      <section aria-labelledby="router-directory-title" className="rv-portal-card space-y-4">
        <div className="rv-portal-card-head">
          <div>
            <h2 id="router-directory-title" className="rv-portal-card-title">
              Router directory
            </h2>
            <p role="status" className="rv-portal-card-count">
              {query.isPlaceholderData
                ? 'Updating results...'
                : query.data
                  ? `${query.data.count} router${query.data.count !== 1 ? 's' : ''} in this view`
                  : query.isError
                    ? 'Router count unavailable'
                    : 'Loading routers...'}
            </p>
          </div>
        </div>

        <div className="router-status-filters" role="group" aria-label="Quick setup filters">
          {[
            { value: '', label: 'All states' },
            { value: 'pending', label: 'Pending review' },
            { value: 'waiting_for_vpn', label: 'Waiting for VPN' },
            { value: 'active', label: 'Active setup' },
            { value: 'suspended', label: 'Suspended' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={(list.state.filters.onboarding_state ?? '') === option.value}
              onClick={() => list.setFilter('onboarding_state', option.value || undefined)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-500">
          Setup states describe configuration progress. Last seen is a recorded observation, not a
          live connection indicator.
        </p>

        <div className="rv-portal-filter">
          <FilterBar
            search={
              <SearchInput
                value={list.state.search}
                onChange={list.setSearch}
                placeholder="Search name, IP or location"
                ariaLabel="Search routers"
              />
            }
            filters={
              <div className="flex flex-wrap items-center gap-2 [&>div]:w-full sm:[&>div]:w-44">
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
                    { value: '', label: 'Active and inactive' },
                    { value: 'true', label: 'Active only' },
                    { value: 'false', label: 'Inactive only' },
                  ]}
                />
              </div>
            }
            activeCount={list.activeFilterCount}
            onClear={list.clearFilters}
          />
        </div>
        {query.isError && query.data && (
          <Alert tone="warning" title="Routers could not be refreshed">
            Showing the last loaded records. Refresh again to check for changes.
          </Alert>
        )}
        <div className="rv-portal-table">
          <DataTable
            caption="Routers"
            columns={columns}
            rows={query.data?.results}
            rowKey={(r) => r.id}
            loading={query.isPending}
            refreshing={query.isFetching && !query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
            ordering={list.state.ordering}
            onOrderingChange={list.setOrdering}
            onRowClick={(r) => navigate(`/routers/${r.id}`)}
            rowActions={(r) => (
              <ButtonLink
                to={`/routers/${r.id}`}
                variant="secondary"
                size="sm"
                aria-label={`Open ${r.name}`}
                trailingIcon={<ArrowUpRight />}
              >
                Details
              </ButtonLink>
            )}
            empty={
              list.activeFilterCount > 0 ? (
                <EmptyState
                  icon={<Radio className="h-6 w-6" aria-hidden />}
                  title="No routers match"
                  description="Try another state or search term."
                  action={
                    <Button variant="secondary" onClick={list.clearFilters}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Radio className="h-6 w-6" aria-hidden />}
                  title="No routers yet"
                  description={
                    canManage
                      ? 'Register your first MikroTik to start onboarding it.'
                      : 'Routers will appear here once a manager registers them.'
                  }
                  action={
                    canManage ? <ButtonLink to={addRouterTo}>Add router</ButtonLink> : undefined
                  }
                />
              )
            }
          />
          {query.data && query.data.count > 0 && (
            <div className="rv-portal-table-foot">
              <Pagination
                count={query.data.count}
                page={list.state.page}
                totalPages={query.data.total_pages}
                pageSize={list.state.page_size}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                itemLabel="routers"
              />
            </div>
          )}
        </div>
      </section>

      {canManage && (
        <AddRouterDialog
          key={isNewRoute ? `new-${location.search}` : 'closed'}
          open={dialogOpen}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
