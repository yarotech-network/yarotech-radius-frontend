import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Plus, RefreshCw, Store, X } from 'lucide-react';
import { KpiTile, MiniBar, StatusBadge } from '@/components/layout';
import { Button, Card, Select } from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import { DataTable, Pagination, SearchInput, useListParams, type Column } from '@/components/data';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { formatKobo } from '@/lib/formatting/money';
import { formatNumber } from '@/lib/formatting/units';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import type { AgentListParams, AgentProfile, AgentStatus } from '@/types/api';
import { useAgents } from '../queries';
import { AGENT_STATUS_FILTERS } from '../agentRules';
import { formatCommission, initials } from '../agentSchemas';
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
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700"
          >
            {initials(a.shop_name || a.username)}
          </span>
          <div className="min-w-0">
            <Link to={`/agents/${a.id}`} className="dashboard-data-link font-semibold break-all">
              {a.username}
            </Link>
            <div className="mt-0.5 truncate text-xs text-ink-500">
              {a.shop_name || 'No shop name'}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      hideBelow: 'md',
      cell: (a) => (
        <span className="font-mono text-xs font-semibold break-all text-ink-700">
          {a.phone || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (a) => <StatusBadge status={a.status} size="sm" dot />,
    },
    {
      key: 'commission',
      header: 'Commission',
      align: 'right',
      hideBelow: 'lg',
      cell: (a) => (
        <span className="text-ink-800 font-medium tabular-nums">
          {formatCommission(a.commission_rate)}%
        </span>
      ),
    },
    {
      key: 'wallet',
      header: 'Wallet balance',
      align: 'right',
      cell: (a) =>
        a.wallet_balance === null ? (
          <span className="text-xs text-ink-500">Unavailable</span>
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
        <time
          dateTime={a.created_at}
          title={formatDateTime(a.created_at)}
          className="text-xs text-ink-600"
        >
          {formatRelative(a.created_at)}
        </time>
      ),
    },
  ];

  const summary = query.data?.summary;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Reseller network</p>
          <h1 className="text-2xl font-bold text-ink-900">Agents</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Resellers who sell your vouchers from a prepaid wallet. New agents need your approval
            before they can sell.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Refresh agents"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            leadingIcon={
              <RefreshCw
                className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
                aria-hidden
              />
            }
          >
            {query.isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>
          <Button
            size="sm"
            leadingIcon={<Plus className="size-4" aria-hidden />}
            onClick={() => setCreating(true)}
          >
            Add agent
          </Button>
        </div>
      </header>

      {(query.isPending || summary) && (
        <section aria-label="Agent summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiTile
            label="Agents"
            value={summary ? formatNumber(summary.total) : '—'}
            detail={
              summary
                ? `${formatNumber(summary.active)} active · ${formatNumber(summary.pending)} pending · ${formatNumber(summary.suspended)} suspended`
                : 'Everyone in your network'
            }
            extra={
              summary && summary.total > 0 ? (
                <MiniBar
                  parts={[
                    { value: summary.active, color: 'var(--color-success-600)' },
                    { value: summary.pending, color: 'var(--color-warning-600)' },
                    { value: summary.suspended, color: 'var(--color-ink-300)' },
                  ]}
                />
              ) : undefined
            }
            loading={query.isPending}
          />
          <KpiTile
            label="Active"
            value={summary ? formatNumber(summary.active) : '—'}
            detail="Approved and able to sell"
            to="/agents?status=active"
            link="Show active agents"
            loading={query.isPending}
          />
          <KpiTile
            label="Awaiting approval"
            value={summary ? formatNumber(summary.pending) : '—'}
            detail={
              summary && summary.pending > 0
                ? 'Review and approve to let them sell'
                : 'Nobody is waiting'
            }
            extra={
              summary && summary.pending > 0 ? (
                <span aria-hidden className="block h-1 rounded-full bg-warning-600" />
              ) : undefined
            }
            to="/agents?status=pending"
            link="Show agents awaiting approval"
            loading={query.isPending}
          />
          <KpiTile
            label="Wallet float"
            value={summary ? formatKobo(summary.wallet_total) : '—'}
            detail="Prepaid balance held by all agents"
            loading={query.isPending}
          />
        </section>
      )}

      <Card padded={false} className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Agent directory</h2>
            <p className="text-xs text-ink-500">
              Open an agent to change their commission, approve or suspend them, and see their
              sales.
            </p>
          </div>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results…'
              : query.data
                ? `${formatNumber(query.data.count)} matching ${query.data.count === 1 ? 'agent' : 'agents'}`
                : query.isError
                  ? 'Agent count unavailable'
                  : 'Loading agents…'}
          </p>
        </div>

        <section aria-label="Agent filters" className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-72">
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search username, shop or phone"
              ariaLabel="Search agents"
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              aria-label="Status"
              size="sm"
              value={list.state.filters.status ?? ''}
              onChange={(e) => list.setFilter('status', e.target.value || undefined)}
              options={AGENT_STATUS_FILTERS}
            />
          </div>
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
        </section>

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
          onRowClick={(a) => navigate(`/agents/${a.id}`)}
          empty={
            list.activeFilterCount > 0 ? (
              <EmptyState
                icon={<Store className="size-6" aria-hidden />}
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
                icon={<Store className="size-6" aria-hidden />}
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
      </Card>

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
