import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  Banknote,
  Cpu,
  Layers,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Store,
  Ticket,
  Trash2,
  Zap,
} from 'lucide-react';
import { BooleanBadge } from '@/components/layout/StatusBadge';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { Button, ButtonLink, Card, ConfirmDialog, Menu, Select } from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { formatKobo } from '@/lib/formatting/money';
import { formatDate } from '@/lib/formatting/dates';
import { errorMessage } from '@/services/api/errors';
import { can } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import type { InternetPlan, PlanListParams } from '@/types/api';
import { ServicePlansNav } from '../components/ServicePlansNav';
import { PlanDialog } from '../components/PlanDialog';
import { PlanSummary } from '../components/PlanSummary';
import { PLANS_DEFAULT_ORDERING, useDeletePlan, usePlans, useUpdatePlan } from '../queries';

const FILTERS = ['is_active'] as const;

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
  const update = useUpdatePlan();
  const remove = useDeletePlan();
  const [editor, setEditor] = useState<{ open: boolean; plan?: InternetPlan }>({ open: false });
  const [pendingDelete, setPendingDelete] = useState<InternetPlan | null>(null);

  async function toggleActive(plan: InternetPlan) {
    try {
      await update.mutateAsync({ id: plan.id, payload: { is_active: !plan.is_active } });
      toast.success(plan.is_active ? `${plan.name} deactivated` : `${plan.name} activated`);
    } catch (error) {
      toast.error('Could not update plan', errorMessage(error));
    }
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
          <p className="mt-1 text-xs text-ink-500">
            {plan.bandwidth_profile_name
              ? `Profile: ${plan.bandwidth_profile_name}`
              : 'Custom speed'}
          </p>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      sortField: 'price',
      align: 'right',
      cell: (plan) => (
        <span className="font-medium text-ink-900 tabular-nums">{formatKobo(plan.price)}</span>
      ),
    },
    {
      key: 'prefix',
      header: 'Voucher prefix',
      hideBelow: 'lg',
      cell: (plan) =>
        plan.voucher_prefix ? (
          <code className="rounded bg-surface-muted px-1.5 py-0.5 text-xs">
            {plan.voucher_prefix}
          </code>
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

  return (
    <div className="space-y-6">
      {/* Premium Hero Header */}
      <div className="router-page-hero">
        <div className="router-page-hero-inner">
          <div className="router-page-hero-text">
            <span className="router-page-hero-eyebrow">
              <Layers className="size-3" aria-hidden /> Service Catalogue
            </span>
            <h1 className="router-page-hero-title">Hotspot Plans</h1>
            <p className="router-page-hero-desc">
              Internet packages your customers buy. Every voucher is generated from an active plan.
            </p>
          </div>
          <div className="router-page-hero-actions">
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw className={query.isFetching ? 'animate-spin motion-reduce:animate-none' : ''} />}
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              {query.isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
            {canManage && (
              <Button
                leadingIcon={<Plus className="size-4" aria-hidden />}
                onClick={() => setEditor({ open: true })}
              >
                New plan
              </Button>
            )}
          </div>
        </div>

        {/* Hero Stats Strip */}
        <div className="router-page-hero-strip">
          <div className="router-page-hero-stat">
            <Layers className="size-4" aria-hidden />
            <span>
              {query.data
                ? `${query.data.count} total package${query.data.count !== 1 ? 's' : ''}`
                : 'Loading catalogue...'}
            </span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-stat">
            <Banknote className="size-4" aria-hidden />
            <span>Pricing in NGN (₦)</span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-links">
            {can(principal, 'settings.profile') && (
              <Link to="/storefront" className="router-page-hero-link">
                <Store className="size-3.5" aria-hidden /> View storefront
              </Link>
            )}
            <Link to="/plans/bandwidth" className="router-page-hero-link">
              <Zap className="size-3.5" aria-hidden /> Bandwidth profiles
            </Link>
          </div>
        </div>
      </div>

      <ServicePlansNav />

      {/* Intro Hero Banner */}
      <Card className="border-brand-200 bg-gradient-to-br from-brand-50/70 via-surface to-sky-50/50 dark:from-brand-950/40 dark:via-surface dark:to-slate-900/40">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 flex-1 gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
              <Layers className="size-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink-900">
                Build your internet catalogue
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-600">
                Set the price, duration, data allowance and speed for each package. Active plans are
                available for new sales; deactivate a plan to keep its history.
              </p>
            </div>
          </div>
          {can(principal, 'settings.profile') && (
            <ButtonLink to="/storefront" variant="secondary" leadingIcon={<Store />}>
              View storefront
            </ButtonLink>
          )}
        </div>
      </Card>

      <section aria-labelledby="plan-catalogue-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
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
        <DataTable
          caption="Internet plans"
          columns={columns}
          rows={query.data?.results}
          rowKey={(plan) => plan.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.error}
          onRetry={() => void query.refetch()}
          ordering={list.state.ordering}
          onOrderingChange={list.setOrdering}
          empty={
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
            )
          }
          rowActions={(plan) => {
            const items = [
              ...(canGenerate && plan.is_active && !plan.archived_at && plan.plan_type !== 'iot_mac'
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
                  <Button
                    {...props}
                    variant="ghost"
                    size="icon"
                    aria-label={`Actions for ${plan.name}`}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden />
                  </Button>
                )}
                items={items}
              />
            );
          }}
        />
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

      {/* Info Feature Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-ink-900">Free Hotspot access</h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-600">
              Not available
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Free access needs enforced time limits, repeat-visit cooldowns and router support. A
            zero-price plan is not an automatic free-access policy.
          </p>
        </Card>
        <Card className="border-border/60 transition-shadow hover:shadow-md">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-ink-900">
              <Link to="/devices" className="inline-flex items-center gap-1 hover:underline text-brand-600">
                IoT / MAC devices <ArrowRight className="size-3.5" />
              </Link>
            </h2>
            <span className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-ink-600">
              Device access
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-500">
            Register equipment by MAC address, assign its router and plan, and choose permanent or
            time-limited access.
          </p>
        </Card>
      </div>

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
        <p className="mt-4 text-xs text-ink-500">
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
