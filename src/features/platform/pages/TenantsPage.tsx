import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowUpRight, Building2, Plus, RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/components/layout';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { Badge, Button, ButtonLink, Select } from '@/components/ui';
import { Alert, EmptyState } from '@/components/feedback';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatDate } from '@/lib/formatting/dates';
import type { Tenant, TenantListParams } from '@/types/api';
import { useTenants } from '../queries';
import { TenantDialog } from '../components/TenantDialog';

import '../tenant-directory.css';

const FILTERS = ['is_active', 'kind'] as const;

/** `/platform/tenants` — every operator on the platform; create + open detail. */
export default function TenantsPage() {
  const navigate = useNavigate();
  const list = useListParams(FILTERS);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    document.title = 'Tenants · Platform · Yarotech RADIUS';
  }, []);

  const params = useMemo<TenantListParams>(() => {
    const p: TenantListParams = { page: list.state.page, page_size: list.state.page_size };
    if (debouncedSearch) p.search = debouncedSearch;
    if (list.state.filters.is_active) p.is_active = list.state.filters.is_active === 'true';
    // Default view hides the platform's own tenant; "platform" shows only it.
    const kind = list.state.filters.kind;
    if (kind === 'platform') p.is_platform_admin = true;
    else if (kind !== 'all') p.is_platform_admin = false;
    return p;
  }, [list.state, debouncedSearch]);
  const query = useTenants(params);

  const columns: Column<Tenant>[] = [
    {
      key: 'name',
      header: 'Tenant',
      primary: true,
      cell: (t) => (
        <div className="tenant-business">
          <span className="tenant-avatar" aria-hidden>
            {t.name
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((word) => word[0])
              .join('')
              .toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/platform/tenants/${t.id}`}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 font-semibold break-words text-brand-700 hover:underline"
              >
                {t.name}
              </Link>
              <Badge className="bg-surface-muted text-ink-600" size="sm">
                {t.is_platform_admin ? 'Platform' : 'Operator'}
              </Badge>
            </div>
            <code className="mt-1 block font-mono text-xs break-all text-ink-500">/s/{t.slug}</code>
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      hideBelow: 'xl',
      cell: (t) => (
        <div className="tenant-contact">
          <span>{t.email || 'No email provided'}</span>
          {t.phone && <span className="text-xs text-ink-500">{t.phone}</span>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (t) => (
        <StatusBadge
          status={t.is_active ? 'active' : 'inactive'}
          size="sm"
          dot
          className={t.is_active ? '' : 'bg-surface-muted'}
        />
      ),
    },
    {
      key: 'members',
      header: 'Members',
      align: 'right',
      hideBelow: 'sm',
      cell: (t) => <span className="tabular-nums">{t.member_count.toLocaleString()}</span>,
    },
    {
      key: 'vouchers',
      header: 'Vouchers',
      align: 'right',
      hideBelow: 'md',
      cell: (t) => <span className="tabular-nums">{t.voucher_count.toLocaleString()}</span>,
    },
    {
      key: 'created',
      header: 'Created',
      hideBelow: 'lg',
      cell: (t) => <span className="text-ink-600">{formatDate(t.created_at)}</span>,
    },
  ];

  return (
    <div className="tenant-directory min-w-0 space-y-6">
      <header className="tenant-page-header">
        <div>
          <p className="tenant-eyebrow">
            <Building2 size={15} aria-hidden /> Platform administration
          </p>
          <h1>Tenants</h1>
          <p className="tenant-subtitle">Your operator workspaces, organised in one place.</p>
        </div>
        <div className="tenant-header-actions">
          <Button
            variant="secondary"
            disabled={query.isFetching}
            leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin' : ''} />}
            onClick={() => void query.refetch()}
          >
            Refresh tenants
          </Button>
          <Button leadingIcon={<Plus aria-hidden />} onClick={() => setCreating(true)}>
            New tenant
          </Button>
        </div>
      </header>
      <section
        aria-labelledby="tenant-directory-title"
        className="tenant-directory-panel space-y-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="tenant-directory-title" className="text-lg font-semibold text-brand-950">
            Tenant directory
          </h2>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} tenants in this view`
                : query.isError
                  ? 'Tenant count unavailable'
                  : 'Loading tenants...'}
          </p>
        </div>
        <p className="text-sm text-ink-500">
          Open a business to manage its members, access and workspace settings.
        </p>
        <FilterBar
          className="tenant-filter-bar"
          search={
            <label className="tenant-filter-label">
              Search businesses
              <SearchInput
                value={list.state.search}
                onChange={list.setSearch}
                placeholder="Search name or slug"
                ariaLabel="Search tenants"
              />
            </label>
          }
          filters={
            <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:w-80">
              <label className="tenant-filter-label">
                Status
                <Select
                  aria-label="Status"
                  size="sm"
                  value={list.state.filters.is_active ?? ''}
                  onChange={(e) => list.setFilter('is_active', e.target.value || undefined)}
                  options={[
                    { value: '', label: 'Any status' },
                    { value: 'true', label: 'Active' },
                    { value: 'false', label: 'Inactive' },
                  ]}
                />
              </label>
              <label className="tenant-filter-label">
                Tenant type
                <Select
                  aria-label="Kind"
                  size="sm"
                  value={list.state.filters.kind ?? ''}
                  onChange={(e) => list.setFilter('kind', e.target.value || undefined)}
                  options={[
                    { value: '', label: 'Operators' },
                    { value: 'platform', label: 'Platform tenant' },
                    { value: 'all', label: 'All tenants' },
                  ]}
                />
              </label>
            </div>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
        {query.isError && query.data && (
          <Alert tone="warning" title="Tenants could not be refreshed">
            Showing the last loaded results. Refresh again to check for changes.
          </Alert>
        )}
        <DataTable
          className="tenant-directory-table"
          caption="Tenants"
          columns={columns}
          rows={query.data?.results}
          rowKey={(t) => t.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          onRowClick={(t) => void navigate(`/platform/tenants/${t.id}`)}
          rowActions={(t) => (
            <ButtonLink
              to={`/platform/tenants/${t.id}`}
              size="sm"
              variant="secondary"
              aria-label={`Open ${t.name}`}
              trailingIcon={<ArrowUpRight />}
            >
              Open
            </ButtonLink>
          )}
          empty={
            list.activeFilterCount > 0 || debouncedSearch ? (
              <EmptyState
                icon={<Building2 className="h-6 w-6" aria-hidden />}
                title="No tenants match"
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      list.clearFilters();
                      list.setSearch('');
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Building2 className="h-6 w-6" aria-hidden />}
                title="No tenants yet"
                description="Create the first operator workspace to get started."
                action={<Button onClick={() => setCreating(true)}>New tenant</Button>}
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
            itemLabel="tenants"
          />
        )}
      </section>
      <TenantDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(t) => void navigate(`/platform/tenants/${t.id}`)}
      />
    </div>
  );
}
