import { useEffect, useMemo, useState } from 'react';
import { MonitorSmartphone, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader, BooleanBadge } from '@/components/layout';
import { Button, Card, ConfirmDialog, Menu, Select } from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import {
  DataTable,
  FilterBar,
  Pagination,
  SearchInput,
  useListParams,
  type Column,
} from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { formatDateTime, formatRelative, isPast } from '@/lib/formatting/dates';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { can } from '@/services/auth/principal';
import { errorMessage } from '@/services/api/errors';
import { usePlanOptions } from '@/features/plans/queries';
import type { DeviceListParams, MacDevice } from '@/types/api';
import { useDeleteDevice, useDevices } from '../queries';
import { DeviceDialog } from '../components/DeviceDialog';

const FILTERS = ['is_active', 'plan'] as const;
const MoreIcon = () => <span aria-hidden>···</span>;

export default function DevicesPage() {
  useEffect(() => {
    document.title = 'Devices | Yarotech RADIUS';
  }, []);
  const principal = usePrincipal();
  const canManage = can(principal, 'devices.manage');
  const toast = useToast();
  const list = useListParams(FILTERS);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const plans = usePlanOptions(false);
  const remove = useDeleteDevice();
  const [dialog, setDialog] = useState<{ open: boolean; device?: MacDevice }>({ open: false });
  const [deleting, setDeleting] = useState<MacDevice | null>(null);

  const params = useMemo(() => {
    const p: DeviceListParams = { page: list.state.page, page_size: list.state.page_size };
    if (debouncedSearch) p.search = debouncedSearch;
    if (list.state.filters.is_active) p.is_active = list.state.filters.is_active === 'true';
    if (list.state.filters.plan) p.plan = Number(list.state.filters.plan);
    return p;
  }, [list.state, debouncedSearch]);
  const query = useDevices(params);

  const columns: Column<MacDevice>[] = [
    {
      key: 'device',
      header: 'Device',
      primary: true,
      cell: (d) => (
        <div className="min-w-0">
          {canManage ? (
            <button
              type="button"
              className="text-left font-semibold break-all text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
              onClick={(event) => {
                event.stopPropagation();
                setDialog({ open: true, device: d });
              }}
            >
              {d.device_name}
            </button>
          ) : (
            <div className="font-medium break-all text-ink-900">{d.device_name}</div>
          )}
          <code className="font-mono text-xs break-all text-ink-500">{d.mac_address}</code>
          <p className="mt-1 text-xs text-ink-500 md:hidden">
            {isPast(d.expires_at) ? 'Expired' : 'Access until'} {formatDateTime(d.expires_at)}
          </p>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan',
      cell: (d) => <span className="break-words text-ink-700">{d.plan_name}</span>,
    },
    {
      key: 'expires',
      header: 'Access until',
      hideBelow: 'md',
      cell: (d) => (
        <span
          className={isPast(d.expires_at) ? 'text-danger-700' : 'text-ink-700'}
          title={formatDateTime(d.expires_at)}
        >
          {isPast(d.expires_at)
            ? `Expired ${formatRelative(d.expires_at)}`
            : formatRelative(d.expires_at)}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      cell: (d) => <BooleanBadge value={d.is_active} trueLabel="Active" falseLabel="Inactive" />,
    },
    {
      key: 'created',
      header: 'Registered',
      hideBelow: 'xl',
      cell: (d) => (
        <time dateTime={d.created_at} title={formatDateTime(d.created_at)} className="text-ink-600">
          {formatRelative(d.created_at)}
        </time>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Devices"
        description="Smart TVs, printers and other equipment allowed online by MAC address without a voucher."
        actions={
          <div className="flex flex-wrap gap-2">
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
              Refresh devices
            </Button>
            {canManage && (
              <Button
                leadingIcon={<Plus className="h-4 w-4" aria-hidden />}
                onClick={() => setDialog({ open: true })}
              >
                Register device
              </Button>
            )}
          </div>
        }
      />
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <MonitorSmartphone className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-brand-950">
              Manage access for your equipment
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Register TVs, printers and other devices by MAC address. Choose their internet plan
              and review when their access expires.
            </p>
            <p className="mt-3 text-sm text-brand-800">
              Active is the registration setting. Access also requires an unexpired registration and
              a configured network.
            </p>
          </div>
        </div>
      </Card>
      <section aria-labelledby="device-directory-title" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="device-directory-title" className="text-lg font-semibold text-brand-950">
            Registered devices
          </h2>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} matching ${query.data.count === 1 ? 'device' : 'devices'}`
                : 'Device directory'}
          </p>
        </div>
        <FilterBar
          inline
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search name or MAC"
              ariaLabel="Search devices"
            />
          }
          filters={
            <>
              <Select
                aria-label="Status"
                size="sm"
                value={list.state.filters.is_active ?? ''}
                onChange={(e) => list.setFilter('is_active', e.target.value || undefined)}
                options={[
                  { value: '', label: 'Active and inactive' },
                  { value: 'true', label: 'Active only' },
                  { value: 'false', label: 'Inactive only' },
                ]}
              />
              <Select
                aria-label="Plan"
                size="sm"
                value={list.state.filters.plan ?? ''}
                onChange={(e) => list.setFilter('plan', e.target.value || undefined)}
                disabled={plans.isPending}
                options={[
                  { value: '', label: plans.isPending ? 'Loading plans...' : 'All plans' },
                  ...(list.state.filters.plan &&
                  !plans.data?.some((plan) => String(plan.id) === list.state.filters.plan)
                    ? [
                        {
                          value: list.state.filters.plan,
                          label: `Selected plan #${list.state.filters.plan}`,
                        },
                      ]
                    : []),
                  ...(plans.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
                ]}
              />
            </>
          }
          activeCount={list.activeFilterCount}
          onClear={list.clearFilters}
        />
        {plans.isError && (
          <Alert
            tone="warning"
            title="Plan filters unavailable"
            actions={
              <Button size="sm" variant="secondary" onClick={() => void plans.refetch()}>
                Retry plans
              </Button>
            }
          >
            Search and status filters are still available.
          </Alert>
        )}
        {query.isError && query.data && (
          <Alert tone="warning" title="Devices could not be refreshed">
            Showing the last loaded devices. Refresh to try again.
          </Alert>
        )}
        <DataTable
          caption="Devices"
          columns={columns}
          rows={query.data?.results}
          rowKey={(d) => d.id}
          loading={query.isPending}
          refreshing={query.isFetching && !query.isPending}
          error={query.data ? null : query.error}
          onRetry={() => void query.refetch()}
          {...(canManage
            ? {
                onRowClick: (d: MacDevice) => setDialog({ open: true, device: d }),
                rowActions: (d: MacDevice) => (
                  <Menu
                    trigger={(props) => (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Actions for ${d.device_name}`}
                        {...props}
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onClick();
                        }}
                      >
                        <MoreIcon />
                      </Button>
                    )}
                    items={[
                      {
                        key: 'edit',
                        label: 'Edit',
                        icon: <Pencil className="h-4 w-4" aria-hidden />,
                        onSelect: () => setDialog({ open: true, device: d }),
                      },
                      {
                        key: 'delete',
                        label: 'Remove',
                        icon: <Trash2 className="h-4 w-4" aria-hidden />,
                        tone: 'danger',
                        onSelect: () => setDeleting(d),
                      },
                    ]}
                  />
                ),
              }
            : {})}
          empty={
            list.activeFilterCount > 0 ? (
              <EmptyState
                icon={<MonitorSmartphone className="h-6 w-6" aria-hidden />}
                title="No devices match"
                description="Try another plan, status or search term."
                action={
                  <Button variant="secondary" onClick={list.clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<MonitorSmartphone className="h-6 w-6" aria-hidden />}
                title="No devices registered"
                description={
                  canManage
                    ? 'Register a MAC address to let a device connect without a voucher.'
                    : 'Registered devices will appear here.'
                }
                action={
                  canManage ? (
                    <Button onClick={() => setDialog({ open: true })}>Register device</Button>
                  ) : undefined
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
            itemLabel="devices"
          />
        )}
      </section>
      <DeviceDialog
        open={dialog.open}
        {...(dialog.device ? { device: dialog.device } : {})}
        onClose={() => setDialog({ open: false })}
        onSaved={(saved) => {
          setDialog({ open: false });
          toast.success(
            dialog.device ? 'Device updated' : 'Device registered',
            `${saved.device_name} · ${saved.mac_address}`,
          );
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        tone="danger"
        title={deleting ? `Remove ${deleting.device_name}?` : ''}
        description="The device will no longer be allowed online by MAC address. You can register it again later."
        confirmLabel="Remove device"
        onConfirm={async () => {
          if (!deleting || !canManage) return;
          try {
            await remove.mutateAsync(deleting.id);
            toast.success('Device removed', `${deleting.device_name} no longer has access.`);
          } catch (error) {
            toast.error('Could not remove device', errorMessage(error));
          }
        }}
      />
    </div>
  );
}
