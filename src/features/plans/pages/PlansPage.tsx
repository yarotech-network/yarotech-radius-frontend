import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  Info,
  LayoutGrid,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  Ticket,
  Trash2,
} from 'lucide-react';
import { BooleanBadge } from '@/components/layout/StatusBadge';
import { KpiTile } from '@/components/layout';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { Button, ButtonLink, ConfirmDialog, Menu, SegmentedControl, Select } from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatKobo } from '@/lib/formatting/money';
import { formatDate } from '@/lib/formatting/dates';
import { formatNumber } from '@/lib/formatting/units';
import { errorMessage } from '@/services/api/errors';
import { can } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import { useDashboardStats } from '@/features/dashboard/queries';
import type { InternetPlan, PlanListParams } from '@/types/api';
import { PlanDialog } from '../components/PlanDialog';
import { PlanSummary } from '../components/PlanSummary';
import { CataloguePlanCard, SalesChannels } from '../components/CataloguePlanCard';
import { PLANS_DEFAULT_ORDERING, useDeletePlan, usePlans, useUpdatePlan } from '../queries';

const FILTERS = ['is_active'] as const;
type CatalogueView = 'table' | 'cards';
const VIEW_KEY = 'plans.catalogueView';

function readView(): CatalogueView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
}

function priceRange(plans: InternetPlan[]) {
  const prices = plans.map((plan) => plan.price);
  if (prices.length === 0) return null;
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high
    ? formatKobo(low, { compact: true })
    : `${formatKobo(low, { compact: true })} – ${formatKobo(high, { compact: true })}`;
}

export default function PlansPage() {
  const principal = usePrincipal();
  const canManage = can(principal, 'plans.manage');
  const canGenerate = can(principal, 'vouchers.generate');
  const toast = useToast();
  const list = useListParams(FILTERS, { ordering: PLANS_DEFAULT_ORDERING });
  const debouncedSearch = useDebouncedValue(list.state.search);
  const params = useMemo<PlanListParams>(() => {
    const p: PlanListParams = { page: list.state.page, page_size: list.state.page_size };
    if (debouncedSearch) p.search = debouncedSearch;
    if (list.state.ordering) p.ordering = list.state.ordering;
    if (list.state.filters.is_active === 'archived') p.archived = true;
    else if (list.state.filters.is_active) p.is_active = list.state.filters.is_active === 'true';
    return p;
  }, [list.state, debouncedSearch]);
  const query = usePlans(params);
  const stats = useDashboardStats(can(principal, 'plans.view'));
  const update = useUpdatePlan();
  const remove = useDeletePlan();
  const [editor, setEditor] = useState<{ open: boolean; plan?: InternetPlan }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<InternetPlan | null>(null);
  const [view, setView] = useState<CatalogueView>(readView);

  function changeView(next: CatalogueView) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Preference only; the page works without storage.
    }
  }

  async function toggleActive(plan: InternetPlan) {
    try {
      await update.mutateAsync({ id: plan.id, payload: { is_active: !plan.is_active } });
      toast.success(plan.is_active ? `${plan.name} deactivated` : `${plan.name} activated`);
    } catch (error) {
      toast.error('Could not update plan', errorMessage(error));
    }
  }

  const canIssue = (plan: InternetPlan) =>
    canGenerate && plan.is_active && !plan.archived_at && plan.plan_type !== 'iot_mac';

  function planActions(plan: InternetPlan) {
    const items = [
      ...(canIssue(plan)
        ? [
            {
              key: 'gen',
              label: 'Generate vouchers',
              icon: <Ticket className="h-4 w-4" aria-hidden />,
              href: `/vouchers/generate?plan=${plan.id}`,
            },
          ]
        : []),
      ...(canManage && !plan.archived_at
        ? [
            {
              key: 'edit',
              label: 'Edit',
              icon: <Pencil className="h-4 w-4" aria-hidden />,
              onSelect: () => setEditor({ open: true, plan }),
            },
            {
              key: 'toggle',
              label: plan.is_active ? 'Deactivate' : 'Activate',
              onSelect: () => void toggleActive(plan),
            },
            'separator' as const,
            {
              key: 'delete',
              label: 'Archive',
              icon: <Trash2 className="h-4 w-4" aria-hidden />,
              tone: 'danger' as const,
              onSelect: () => setPendingDelete(plan),
            },
          ]
        : []),
    ];
    if (items.length === 0) return null;
    return (
      <Menu
        trigger={(props) => (
          <Button {...props} variant="ghost" size="icon" aria-label={`Actions for ${plan.name}`}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        )}
        items={items}
      />
    );
  }

  const columns: Column<InternetPlan>[] = [
    {
      key: 'name',
      header: 'Plan',
      primary: true,
      cell: (plan) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold break-words text-ink-900">{plan.name}</span>
            <BooleanBadge
              value={plan.is_active}
              trueLabel="Active"
              falseLabel={plan.archived_at ? 'Archived' : 'Inactive'}
              size="sm"
            />
          </div>
          <PlanSummary plan={plan} className="mt-1" />
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      sortField: 'price',
      align: 'right',
      cell: (plan) => (
        <span className="text-base font-semibold text-ink-900 tabular-nums">
          {formatKobo(plan.price)}
        </span>
      ),
    },
    {
      key: 'channels',
      header: 'Sold through',
      hideBelow: 'md',
      cell: (plan) => <SalesChannels plan={plan} />,
    },
    {
      key: 'devices',
      header: 'Devices',
      hideBelow: 'lg',
      align: 'right',
      cell: (plan) => <span className="text-ink-700 tabular-nums">{plan.max_devices ?? 1}</span>,
    },
    {
      key: 'prefix',
      header: 'Prefix',
      hideBelow: 'xl',
      cell: (plan) =>
        plan.voucher_prefix ? (
          <code className="rounded bg-fill px-1.5 py-0.5 text-xs">{plan.voucher_prefix}</code>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: 'created',
      header: 'Created',
      hideBelow: 'xl',
      sortField: 'created_at',
      cell: (plan) => <span className="text-ink-600">{formatDate(plan.created_at)}</span>,
    },
  ];

  const results = query.data?.results;
  // Catalogue-wide insights are only honest when the whole, unfiltered catalogue is loaded.
  const fullCatalogue =
    results &&
    list.activeFilterCount === 0 &&
    !debouncedSearch &&
    query.data?.count === results.length
      ? results
      : null;
  const onSale = fullCatalogue?.filter((plan) => plan.is_active && !plan.archived_at);
  const s = stats.data;

  const emptyState =
    list.activeFilterCount > 0 ? (
      <EmptyState
        icon={<Layers className="h-6 w-6" aria-hidden />}
        title="No plans match"
        description="Try a different search or clear the filters."
        action={
          <Button variant="secondary" onClick={list.clearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={<Layers className="h-6 w-6" aria-hidden />}
        title="No plans yet"
        description={
          canManage
            ? 'Create your first plan to start generating vouchers.'
            : 'Plans will appear here once a manager creates them.'
        }
        action={
          canManage ? (
            <Button onClick={() => setEditor({ open: true })}>Create a plan</Button>
          ) : undefined
        }
      />
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Service catalogue</p>
          <h1 className="text-2xl font-bold text-ink-900">Hotspot Plans</h1>
          <p className="mt-1 text-sm text-ink-500">
            Internet packages your customers buy. Every voucher is generated from an active plan.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            aria-label="Refresh plans"
            variant="secondary"
            size="sm"
            leadingIcon={
              <RefreshCw
                className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''}
              />
            }
            disabled={query.isFetching}
            onClick={() => {
              void query.refetch();
              void stats.refetch();
            }}
          >
            {query.isFetching ? 'Refreshing...' : 'Refresh'}
          </Button>
          {canManage && (
            <Button
              size="sm"
              leadingIcon={<Plus className="size-4" aria-hidden />}
              onClick={() => setEditor({ open: true })}
            >
              New plan
            </Button>
          )}
        </div>
      </header>

      <section aria-label="Plan summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {s?.total_plans != null && s.active_plans != null && (
          <KpiTile
            label="Plans on sale"
            value={`${formatNumber(s.active_plans)} of ${formatNumber(s.total_plans)}`}
            detail={`${formatNumber(s.total_plans - s.active_plans)} inactive · archived excluded`}
          />
        )}
        {onSale && (
          <>
            <KpiTile
              label="Price range"
              value={priceRange(onSale) ?? 'No plans on sale'}
              detail="Cheapest to dearest plan on sale"
            />
            <KpiTile
              label="On your storefront"
              value={formatNumber(onSale.filter((plan) => plan.is_public !== false).length)}
              detail={`${formatNumber(onSale.filter((plan) => plan.is_public === false).length)} on sale but hidden from customers`}
            />
            <KpiTile
              label="Agents can sell"
              value={formatNumber(onSale.filter((plan) => plan.agent_enabled !== false).length)}
              detail="Active plans enabled for agents"
            />
          </>
        )}
      </section>

      <section aria-labelledby="plan-catalogue-title" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="plan-catalogue-title" className="text-lg font-semibold text-ink-900">
              Plan catalogue
            </h2>
            <p role="status" className="text-sm text-ink-500">
              {query.isPlaceholderData
                ? 'Updating results...'
                : query.data
                  ? `${query.data.count} ${list.activeFilterCount ? 'matching' : 'total'} plans`
                  : 'Prices shown in NGN'}
            </p>
          </div>
          <SegmentedControl
            ariaLabel="Catalogue view"
            size="sm"
            value={view}
            onChange={changeView}
            options={[
              {
                value: 'table',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <Rows3 aria-hidden className="size-3.5" /> Table
                  </span>
                ),
              },
              {
                value: 'cards',
                label: (
                  <span className="inline-flex items-center gap-1.5">
                    <LayoutGrid aria-hidden className="size-3.5" /> Cards
                  </span>
                ),
              },
            ]}
          />
        </div>
        <FilterBar
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search plans"
              ariaLabel="Search plans"
            />
          }
          filters={
            <Select
              aria-label="Status"
              size="sm"
              value={list.state.filters.is_active ?? ''}
              onChange={(e) => list.setFilter('is_active', e.target.value || undefined)}
              options={[
                { value: '', label: 'All plans' },
                { value: 'true', label: 'Active only' },
                { value: 'false', label: 'Inactive only' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
        {query.isError && query.data && (
          <Alert tone="warning" title="Plans could not be refreshed">
            Showing the last loaded results. Refresh again to check for changes.
          </Alert>
        )}
        {view === 'table' || !results || results.length === 0 ? (
          <DataTable
            caption="Internet plans"
            columns={columns}
            rows={results}
            rowKey={(plan) => plan.id}
            loading={query.isPending}
            refreshing={query.isFetching && !query.isPending}
            error={query.error}
            onRetry={() => void query.refetch()}
            ordering={list.state.ordering}
            onOrderingChange={list.setOrdering}
            empty={emptyState}
            rowActions={planActions}
          />
        ) : (
          <ul
            aria-label="Internet plans"
            className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${query.isFetching ? 'opacity-70' : ''}`}
          >
            {results.map((plan) => (
              <li key={plan.id} className="min-w-0">
                <CataloguePlanCard
                  plan={plan}
                  actions={planActions(plan)}
                  primaryAction={
                    canIssue(plan) ? (
                      <ButtonLink
                        to={`/vouchers/generate?plan=${plan.id}`}
                        variant="secondary"
                        size="sm"
                        block
                        leadingIcon={<Ticket className="size-4" aria-hidden />}
                      >
                        Generate vouchers
                      </ButtonLink>
                    ) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
        {query.data && query.data.count > 0 && (
          <Pagination
            count={query.data.count}
            page={list.state.page}
            totalPages={query.data.total_pages}
            pageSize={list.state.page_size}
            onPageChange={list.setPage}
            onPageSizeChange={list.setPageSize}
            itemLabel="plans"
          />
        )}
      </section>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-500">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <strong className="font-medium text-ink-700">
            Free Hotspot access is not available.
          </strong>{' '}
          It needs enforced time limits, repeat-visit cooldowns and router support; a zero-price
          plan is not an automatic free-access policy.
        </span>
      </p>

      <PlanDialog
        open={editor.open}
        {...(editor.plan ? { plan: editor.plan } : {})}
        onClose={() => setEditor({ open: false })}
        onSaved={(saved) => {
          setEditor({ open: false });
          toast.success(
            editor.plan ? 'Plan updated' : 'Plan created',
            editor.plan ? undefined : `${saved.name} is ready.`,
          );
        }}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        tone="danger"
        title={`Archive ${pendingDelete?.name ?? 'plan'}?`}
        description="Stops new sales and issuance permanently. Existing vouchers and payment history are retained."
        confirmLabel="Archive plan"
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync(pendingDelete.id);
          toast.success('Plan archived');
        }}
      />
      {!canManage && canGenerate && (
        <p className="text-xs text-ink-500">
          Need a new plan? Ask a manager — you can still{' '}
          <Link to="/vouchers/generate" className="text-brand-600 hover:underline">
            generate vouchers
          </Link>{' '}
          from active plans.
        </p>
      )}
    </div>
  );
}
