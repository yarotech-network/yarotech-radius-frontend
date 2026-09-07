import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, RefreshCw, Store } from 'lucide-react';
import { PageHeader, StatusBadge } from '@/components/layout';
import { Button, Card, Select } from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { formatKobo } from '@/lib/formatting/money';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import type { AgentListParams, AgentProfile, AgentStatus } from '@/types/api';
import { useAgents } from '../queries';
import { AGENT_STATUS_FILTERS } from '../agentRules';
import { formatCommission } from '../agentSchemas';
import { CreateAgentDialog } from '../components/AgentForms';

const FILTERS = ['status'] as const;

export default function AgentsPage() {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Agents · Yarotech RADIUS';
  }, []);
  const toast = useToast();
  const list = useListParams(FILTERS);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const [creating, setCreating] = useState(false);
  const params = useMemo(() => {
    const p: AgentListParams = { page: list.state.page, page_size: list.state.page_size };
    if (debouncedSearch) p.search = debouncedSearch;
    if (list.state.ordering) p.ordering = list.state.ordering;
    if (list.state.filters.status) p.status = list.state.filters.status as AgentStatus;
    return p;
  }, [list.state, debouncedSearch]);
  const query = useAgents(params);

  const columns: Column<AgentProfile>[] = [
    {
      key: 'agent',
      header: 'Agent',
      primary: true,
      cell: (a) => (
        <div className="min-w-0">
          <Link
            to={`/agents/${a.id}`}
            className="font-semibold break-all text-brand-700 hover:underline"
          >
            {a.username}
          </Link>
          <div className="mt-1 text-xs break-words text-ink-500">
            {a.shop_name || 'No shop name'}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'md',
      cell: (a) => (
        <span className="font-mono text-[13px] break-all text-ink-700">
          {a.phone || 'No phone recorded'}
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (a) => <StatusBadge status={a.status} size="sm" /> },
    {
      key: 'commission',
      header: 'Commission',
      align: 'right',
      hideBelow: 'lg',
      cell: (a) => <span className="tabular-nums">{formatCommission(a.commission_rate)}%</span>,
    },
    {
      key: 'wallet',
      header: 'Wallet',
      align: 'right',
      cell: (a) =>
        a.wallet_balance === null ? (
          <span className="text-ink-500">Unavailable</span>
        ) : (
          <span className="font-semibold text-ink-900 tabular-nums">
            {formatKobo(a.wallet_balance)}
          </span>
        ),
    },
    {
      key: 'created',
      header: 'Joined',
      hideBelow: 'xl',
      sortField: 'created_at',
      cell: (a) => (
        <time dateTime={a.created_at} title={formatDateTime(a.created_at)} className="text-ink-600">
          {formatRelative(a.created_at)}
        </time>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description="Resellers who sell your vouchers from a prepaid wallet."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
              Refresh agents
            </Button>
            <Button
              leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
              onClick={() => setCreating(true)}
            >
              Add agent
            </Button>
          </div>
        }
      />
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Store className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-950">Manage your reseller network</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Find agents by username, shop or phone. Open a profile to review their account,
              commission rate and voucher activity.
            </p>
            <p className="mt-3 text-sm text-brand-800">
              New agents need approval before selling. Wallet balances are shown in naira;
              commission rates are percentages.
            </p>
          </div>
        </div>
      </Card>
      <section aria-labelledby="agent-directory-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="agent-directory-title" className="text-lg font-semibold text-brand-950">
            Agent directory
          </h2>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} agents in this view`
                : query.isError
                  ? 'Agent count unavailable'
                  : 'Loading agents...'}
          </p>
        </div>
        <FilterBar
          inline
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search username, shop or phone"
              ariaLabel="Search agents"
            />
          }
          filters={
            <div className="w-44">
              <Select
                aria-label="Status"
                size="sm"
                value={list.state.filters.status ?? ''}
                onChange={(e) => list.setFilter('status', e.target.value || undefined)}
                options={AGENT_STATUS_FILTERS}
              />
            </div>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
        {query.isError && query.data && (
          <Alert tone="warning" title="Agents could not be refreshed">
            Showing the last loaded agents and wallet balances. Refresh again to check for changes.
          </Alert>
        )}
        <DataTable
          caption="Agents"
          columns={columns}
          rows={query.data?.results}
          rowKey={(a) => a.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          ordering={list.state.ordering}
          onOrderingChange={list.setOrdering}
          empty={
            list.activeFilterCount > 0 ? (
              <EmptyState
                icon={<Store className="h-6 w-6" aria-hidden />}
                title="No agents match"
                description="Try another status or search term."
                action={
                  <Button variant="secondary" onClick={list.clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Store className="h-6 w-6" aria-hidden />}
                title="No agents yet"
                description="Add a reseller and approve them to let them sell vouchers."
                action={<Button onClick={() => setCreating(true)}>Add agent</Button>}
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
            itemLabel="agents"
          />
        )}
      </section>
      <CreateAgentDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(agent) => {
          setCreating(false);
          toast.success('Agent added', `${agent.username} is pending approval.`);
          navigate(`/agents/${agent.id}`);
        }}
      />
    </div>
  );
}
