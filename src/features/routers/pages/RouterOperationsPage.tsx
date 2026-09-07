import { Activity, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, Select, Skeleton } from '@/components/ui';
import { Alert, EmptyState, ErrorState } from '@/components/feedback';
import { FilterBar, Pagination, useListParams } from '@/components/data';
import type { OperationAction, OperationStatus } from '@/types/api';
import { useRouterOperations, useRouterOptions } from '../queries';
import { isOperationOpen } from '../routerRules';
import { OperationRow } from '../components/VpnPanel';

const FILTERS = ['router', 'status', 'action'] as const;
const STATUS_OPTIONS: { value: OperationStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
];
const ACTION_OPTIONS: { value: OperationAction | ''; label: string }[] = [
  { value: '', label: 'All actions' },
  { value: 'provision', label: 'Provision' },
  { value: 'suspend', label: 'Suspend' },
];

export default function RouterOperationsPage() {
  const list = useListParams(FILTERS);
  const routers = useRouterOptions();
  const routerName = new Map((routers.data ?? []).map((r) => [r.id, r.name]));
  const { page, page_size, filters } = list.state;
  const query = useRouterOperations({
    page,
    page_size,
    ...(filters.router ? { router: filters.router } : {}),
    ...(filters.status ? { status: filters.status as OperationStatus } : {}),
    ...(filters.action ? { action: filters.action as OperationAction } : {}),
  });
  const live = query.data?.results.some(isOperationOpen) ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Provisioning operations"
        actions={
          <Button
            variant="secondary"
            disabled={query.isFetching}
            leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin' : ''} />}
            onClick={() => void query.refetch()}
          >
            Refresh operations
          </Button>
        }
        description="Every provision and suspend run across your routers. Open operations refresh automatically."
        backTo="/routers"
        crumbs={[{ label: 'Routers', to: '/routers' }, { label: 'Operations' }]}
        meta={
          live && (
            <span className="inline-flex items-center gap-1 text-xs text-brand-700">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden /> Auto-refreshing open
              operations
            </span>
          )
        }
      />
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Activity className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-brand-950">Follow router provisioning</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Review provision and suspend requests, their attempts and recorded failures. Open the
              router to inspect its configuration and available management actions.
            </p>
            <p className="mt-3 text-xs font-medium text-brand-700">
              Pending and running operations stay open until the server reports their outcome.
            </p>
          </div>
        </div>
      </Card>
      <section aria-labelledby="operation-history-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="operation-history-title" className="text-lg font-semibold text-brand-950">
            Operation history
          </h2>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data!.count} operations in this view`
                : query.isError
                  ? 'Operation count unavailable'
                  : 'Loading operations...'}
          </p>
        </div>
        <FilterBar
          inline
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
          filters={
            <div className="flex items-center gap-2 [&>div]:w-44 [&>div]:shrink-0">
              <Select
                aria-label="Router"
                size="sm"
                value={filters.router ?? ''}
                onChange={(e) => list.setFilter('router', e.target.value || undefined)}
                options={[
                  { value: '', label: 'All routers' },
                  ...(routers.data ?? []).map((r) => ({ value: r.id, label: r.name })),
                ]}
              />
              <Select
                aria-label="Status"
                size="sm"
                value={filters.status ?? ''}
                onChange={(e) => list.setFilter('status', e.target.value || undefined)}
                options={STATUS_OPTIONS}
              />
              <Select
                aria-label="Action"
                size="sm"
                value={filters.action ?? ''}
                onChange={(e) => list.setFilter('action', e.target.value || undefined)}
                options={ACTION_OPTIONS}
              />
            </div>
          }
        />
        {routers.isError && (
          <Alert
            tone="warning"
            title="Router names could not be loaded"
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
            Operation records remain available using their router IDs.
          </Alert>
        )}
        {query.isError && query.data && (
          <Alert tone="warning" title="Operations could not be refreshed">
            Showing the last loaded records. Their status may have changed; refresh again to check.
          </Alert>
        )}
        <Card padded={false}>
          {query.isPending ? (
            <div className="flex flex-col gap-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : query.isError && !query.data ? (
            <ErrorState
              error={query.error}
              onRetry={() => void query.refetch()}
              title="Operations could not be loaded"
            />
          ) : query.data!.results.length === 0 ? (
            <EmptyState
              title="No operations"
              description={
                list.activeFilterCount > 0
                  ? 'Nothing matches these filters.'
                  : 'Provisioning runs will appear here once you provision a router.'
              }
            />
          ) : (
            <>
              <ul className="divide-y divide-border" aria-label="Operations">
                {query.data!.results.map((op) => (
                  <OperationRow
                    key={op.id}
                    op={op}
                    showRouter={routerName.get(op.router) ?? `Router ${op.router.slice(0, 8)}`}
                  />
                ))}
              </ul>
              <div className="border-t border-border px-4 py-3">
                <Pagination
                  count={query.data!.count}
                  page={query.data!.current_page}
                  totalPages={query.data!.total_pages}
                  pageSize={page_size}
                  onPageChange={list.setPage}
                  onPageSizeChange={list.setPageSize}
                  itemLabel="operations"
                />
              </div>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}
