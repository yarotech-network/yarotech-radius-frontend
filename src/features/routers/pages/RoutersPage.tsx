import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, ArrowUpRight, BookOpen, Cpu, Plus, Radio, RefreshCw, Wifi } from 'lucide-react';
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
import { RouterAllowance } from '../components/RouterAllowance';
import { ONBOARDING_FILTER_OPTIONS } from '../routerSchemas';

const FILTERS = ['onboarding_state', 'deployment_status', 'is_active'] as const;
const STATES = ONBOARDING_FILTER_OPTIONS.map((o) => o.value).filter(Boolean) as readonly string[];
const DEPLOYMENTS: readonly string[] = ['not_deployed', 'deploying', 'deployed', 'failed'];

export default function RoutersPage() {
  const principal = usePrincipal();
  const navigate = useNavigate();
  const canManage = can(principal, 'routers.manage');
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
            className="font-semibold break-words text-brand-700 hover:underline"
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
    <div className="router-page space-y-6">

      {/* Premium hero header */}
      <div className="router-page-hero">
        <div className="router-page-hero-inner">
          <div className="router-page-hero-text">
            <span className="router-page-hero-eyebrow">
              <Wifi className="size-3" aria-hidden /> Network Infrastructure
            </span>
            <h1 className="router-page-hero-title">Router Fleet</h1>
            <p className="router-page-hero-desc">
              MikroTik hotspots registered as RADIUS clients — onboarding, VPN and provisioning in one place.
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
            {canManage && (
              <ButtonLink to="/routers/new" leadingIcon={<Plus className="size-4" aria-hidden />}>
                Add router
              </ButtonLink>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="router-page-hero-strip">
          <div className="router-page-hero-stat">
            <Radio className="size-4" aria-hidden />
            <span>
              {query.data
                ? `${query.data.count} total router${query.data.count !== 1 ? 's' : ''}`
                : 'Loading fleet...'}
            </span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-stat">
            <Cpu className="size-4" aria-hidden />
            <span>MikroTik · RADIUS NAS</span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-links">
            <Link to="/guide" className="router-page-hero-link">
              <BookOpen className="size-3.5" aria-hidden /> Setup guide
            </Link>
            {canManage && (
              <Link to="/routers/operations" className="router-page-hero-link">
                <ArrowRight className="size-3.5" aria-hidden /> Provisioning ops
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Allowance + intro */}
      <div className="router-fleet-intro">
        <div className="router-intro-copy">
          <Radio className="size-6 shrink-0 text-brand-600" aria-hidden />
          <div>
            <h2>Connect and manage your MikroTik fleet</h2>
            <p>Review setup, configure VPN access and follow provisioning for each device.</p>
          </div>
        </div>
        <RouterAllowance />
      </div>

      {/* Router directory */}
      <section aria-labelledby="router-directory-title" className="space-y-4">
        <div className="router-directory-heading">
          <div>
            <h2 id="router-directory-title" className="router-directory-title">
              Router directory
            </h2>
            <p role="status" className="router-directory-count">
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
        {query.isError && query.data && (
          <Alert tone="warning" title="Routers could not be refreshed">
            Showing the last loaded records. Refresh again to check for changes.
          </Alert>
        )}
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
                  canManage ? <ButtonLink to="/routers/new">Add router</ButtonLink> : undefined
                }
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
            itemLabel="routers"
          />
        )}
      </section>
    </div>
  );
}
