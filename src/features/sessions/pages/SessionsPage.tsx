import { CustomerTabs } from '@/features/customers/CustomerTabs';
import { NetworkCards } from '@/features/dashboard/components/NetworkCards';
import { useMemo, useState } from 'react';
import { Activity, Pause, Play, RefreshCw, Unplug } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { Button, Card, ConfirmDialog, Select } from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatBytes, formatDuration } from '@/lib/formatting/units';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { can } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import { useDisconnectSession, useLiveUsers } from '@/features/dashboard/queries';
import { useRouterOptions } from '@/features/routers/queries';
import type { LiveUser, LiveUsersParams } from '@/types/api';

const FILTERS = ['router'] as const;

export default function SessionsPage() {
  const principal = usePrincipal();
  const toast = useToast();
  const canDisconnect = can(principal, 'sessions.disconnect');
  const list = useListParams(FILTERS);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const [paused, setPaused] = useState(false);
  const params = useMemo<LiveUsersParams>(() => {
    const p: LiveUsersParams = { page: list.state.page, page_size: list.state.page_size };
    if (debouncedSearch) p.username = debouncedSearch;
    if (list.state.filters.router) p.router = list.state.filters.router;
    return p;
  }, [list.state, debouncedSearch]);
  const query = useLiveUsers(params, { live: !paused });
  const routers = useRouterOptions();
  const disconnect = useDisconnectSession();
  const [pending, setPending] = useState<LiveUser | null>(null);

  const columns: Column<LiveUser>[] = [
    {
      key: 'user',
      header: 'Voucher',
      primary: true,
      cell: (s) => (
        <div className="min-w-0">
          <code className="font-mono text-sm font-semibold break-all text-brand-950">
            {s.username}
          </code>
          <div className="mt-1 text-xs break-words text-ink-500">
            {s.router_name ?? s.ip_address}
          </div>
        </div>
      ),
    },
    {
      key: 'router',
      header: 'Router',
      hideBelow: 'lg',
      mobileHidden: true,
      cell: (s) => (
        <span className="text-ink-700">
          {s.router_name ?? <span className="text-ink-400">Unknown ({s.ip_address})</span>}
        </span>
      ),
    },
    {
      key: 'since',
      header: 'Connected',
      cell: (s) =>
        s.connected_at ? (
          <span title={formatDateTime(s.connected_at)}>{formatRelative(s.connected_at)}</span>
        ) : (
          '—'
        ),
    },
    {
      key: 'duration',
      header: 'Duration',
      hideBelow: 'md',
      cell: (s) => <span className="tabular-nums">{formatDuration(s.session_time)}</span>,
    },
    {
      key: 'down',
      header: 'Download',
      align: 'right',
      cell: (s) => <span className="tabular-nums">{formatBytes(s.bytes_out)}</span>,
    },
    {
      key: 'up',
      header: 'Upload',
      align: 'right',
      hideBelow: 'sm',
      cell: (s) => <span className="tabular-nums">{formatBytes(s.bytes_in)}</span>,
    },
  ];

  const observed = query.data?.observed_at;

  return (
    <div className="space-y-6">
      <CustomerTabs />
      <PageHeader
        title="Live sessions"
        description="Devices currently online through your routers."
        meta={
          <span className="inline-flex items-center gap-2 text-xs text-ink-500" aria-live="polite">
            <span
              className={[
                'inline-block h-2 w-2 rounded-full',
                paused || query.isError ? 'bg-ink-300' : 'animate-pulse bg-success-600',
              ].join(' ')}
              aria-hidden
            />
            {query.isError
              ? 'Updates unavailable'
              : paused
                ? 'Updates paused'
                : query.isFetching
                  ? 'Refreshing…'
                  : observed
                    ? `Updated ${formatRelative(observed)}`
                    : 'Live'}
          </span>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin' : ''} />}
              onClick={() => void query.refetch()}
            >
              Refresh sessions
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={
                paused ? (
                  <Play className="h-4 w-4" aria-hidden />
                ) : (
                  <Pause className="h-4 w-4" aria-hidden />
                )
              }
              onClick={() => setPaused((p) => !p)}
              aria-pressed={paused}
            >
              {paused ? 'Resume updates' : 'Pause updates'}
            </Button>
          </div>
        }
      />
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Activity className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-950">Monitor hotspot sessions</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Find a voucher session, review its connection time and traffic, and identify the
              router reporting it.
            </p>
            <p className="mt-3 text-xs font-medium text-brand-700">
              {observed
                ? `Data observed ${formatDateTime(observed)}`
                : 'Waiting for a session observation.'}
            </p>
            {paused && (
              <p className="mt-2 text-xs text-ink-600">
                Automatic updates are paused. Manual refresh remains available.
              </p>
            )}
          </div>
        </div>
      </Card>
      <NetworkCards live={!paused} />
      <section aria-labelledby="sessions-directory-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sessions-directory-title" className="text-lg font-semibold text-brand-950">
            Session directory
          </h2>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} sessions in this view`
                : query.isError
                  ? 'Session count unavailable'
                  : 'Loading sessions...'}
          </p>
        </div>
        <FilterBar
          inline
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search by voucher username"
              ariaLabel="Search sessions"
            />
          }
          filters={
            <div className="w-48">
              <Select
                aria-label="Router"
                size="sm"
                value={list.state.filters.router ?? ''}
                onChange={(e) => list.setFilter('router', e.target.value || undefined)}
                options={[
                  { value: '', label: 'All routers' },
                  ...(routers.data ?? []).map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
            </div>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
        {query.isError && query.data && (
          <Alert tone="warning" title="Sessions could not be refreshed">
            Showing the last observed sessions. Connections may have changed since that observation.
          </Alert>
        )}
        {routers.isError && (
          <Alert
            tone="warning"
            title="Router filters could not be loaded"
            actions={
              <Button
                size="sm"
                variant="secondary"
                disabled={routers.isFetching}
                onClick={() => void routers.refetch()}
              >
                Retry router list
              </Button>
            }
          >
            You can still search sessions by voucher username.
          </Alert>
        )}
        <DataTable
          caption="Live sessions"
          columns={columns}
          rows={query.data?.users}
          rowKey={(s) => s.session_id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          empty={
            <EmptyState
              icon={<Activity className="h-6 w-6" aria-hidden />}
              title={
                list.activeFilterCount > 0 ? 'No matching sessions' : 'Nobody is online right now'
              }
              description={
                list.activeFilterCount > 0
                  ? 'Try clearing the filters.'
                  : 'Sessions appear here as soon as a customer logs in with a voucher.'
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
          {...(canDisconnect
            ? {
                rowActions: (s: LiveUser) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<Unplug className="h-4 w-4" aria-hidden />}
                    onClick={() => setPending(s)}
                    aria-label={`Disconnect ${s.username}`}
                  >
                    <span className="hidden sm:inline">Disconnect</span>
                  </Button>
                ),
              }
            : {})}
        />
        {query.data && query.data.count > 0 && (
          <Pagination
            count={query.data.count}
            page={list.state.page}
            totalPages={query.data.total_pages}
            pageSize={list.state.page_size}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            itemLabel="sessions"
          />
        )}
        <p className="mt-3 text-xs text-ink-500">
          Client IP and device addresses are not reported by the accounting feed; only router-side
          data is shown.
        </p>
      </section>
      <ConfirmDialog
        open={pending !== null && canDisconnect}
        onClose={() => setPending(null)}
        tone="danger"
        title={`Disconnect ${pending?.username ?? 'session'}?`}
        description={
          <>
            <p>
              Sends a disconnect request to the router. The voucher stays valid and the customer can
              log in again.
            </p>
            {pending && (
              <p className="mt-2 break-words">
                Router: {pending.router_name ?? pending.ip_address}. Session: {pending.session_id}.
              </p>
            )}
          </>
        }
        confirmLabel="Disconnect"
        onConfirm={async () => {
          if (!pending || !canDisconnect) return;
          const res = await disconnect.mutateAsync(pending.session_id);
          if (res.acknowledged)
            toast.success('Disconnect sent', `${pending.username} was disconnected by the router.`);
          else
            toast.info(
              'Request sent',
              'The router did not acknowledge the disconnect yet; the session may take a moment to drop.',
            );
        }}
      />
    </div>
  );
}
