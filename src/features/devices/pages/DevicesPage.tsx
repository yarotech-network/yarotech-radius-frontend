import { useEffect, useMemo, useState } from 'react';
import {
  MonitorSmartphone,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { KpiTile, MiniBar } from '@/components/layout';
import { Badge, Button, Card, ConfirmDialog, CopyButton, Menu, Select } from '@/components/ui';
import { Alert, EmptyState, useToast } from '@/components/feedback';
import { DataTable, Pagination, SearchInput, useListParams, type Column } from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { formatBytes, formatNumber } from '@/lib/formatting/units';
import { useDebouncedValue } from '@/lib/utilities/useDebouncedValue';
import { cn } from '@/lib/utilities/cn';
import { can } from '@/services/auth/principal';
import { errorMessage } from '@/services/api/errors';
import type { DeviceListParams, MacDevice } from '@/types/api';
import { useDeleteDevice, useDevicePlans, useDeviceRouters, useDevices } from '../queries';
import { DeviceLifecycleDialog } from '../components/DeviceLifecycleDialog';
import { DeviceDialog } from '../components/DeviceDialog';
import { STATUS_BADGE, accessText, effectiveStatus, sessionText } from '../deviceStatus';

const FILTERS = ['is_active', 'plan', 'router', 'include_deleted'] as const;

export default function DevicesPage() {
  const principal = usePrincipal();
  const scope =
    principal.kind === 'member'
      ? principal.tenantId
      : principal.kind === 'platform_staff'
        ? principal.activeTenantId
        : null;
  return <DeviceDirectory key={`${principal.user.id}:${scope}`} />;
}

function DeviceDirectory() {
  useEffect(() => {
    document.title = 'IoT & MAC devices | Yarotech RADIUS';
  }, []);
  const principal = usePrincipal();
  const canManage = can(principal, 'devices.manage');
  const toast = useToast();
  const list = useListParams(FILTERS);
  const debouncedSearch = useDebouncedValue(list.state.search);
  const plans = useDevicePlans(false);
  const routers = useDeviceRouters();
  const remove = useDeleteDevice();
  const [dialog, setDialog] = useState<{ open: boolean; device?: MacDevice }>({ open: false });
  const [managing, setManaging] = useState<MacDevice | null>(null);
  const [deleting, setDeleting] = useState<MacDevice | null>(null);

  const params = useMemo(() => {
    const p: DeviceListParams = { page: list.state.page, page_size: list.state.page_size };
    if (list.state.filters.include_deleted) p.include_deleted = true;
    if (list.state.filters.router) p.router = list.state.filters.router;
    if (debouncedSearch) p.search = debouncedSearch;
    if (list.state.filters.is_active) p.is_active = list.state.filters.is_active === 'true';
    if (list.state.filters.plan) p.plan = Number(list.state.filters.plan);
    return p;
  }, [list.state, debouncedSearch]);
  const query = useDevices(params);
  const summary = query.data?.summary;
  const open = (d: MacDevice) =>
    d.status === 'deleted' ? setManaging(d) : setDialog({ open: true, device: d });

  const columns: Column<MacDevice>[] = [
    {
      key: 'device',
      header: 'Device',
      primary: true,
      cell: (d) => (
        <div className="flex min-w-52 items-center gap-3">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"
          >
            <MonitorSmartphone className="size-4.5" />
          </span>
          <div className="min-w-0">
            {canManage ? (
              <button
                type="button"
                className="dashboard-data-link text-left font-semibold break-all"
                onClick={(event) => {
                  event.stopPropagation();
                  open(d);
                }}
              >
                {d.device_name}
              </button>
            ) : (
              <p className="font-semibold break-all text-ink-900">{d.device_name}</p>
            )}
            <span className="mt-0.5 flex items-center gap-0.5">
              <code className="font-mono text-xs text-ink-600">{d.mac_address}</code>
              <CopyButton
                value={d.mac_address}
                label={`Copy MAC address of ${d.device_name}`}
                size="icon"
                onClickCapture={(event) => event.stopPropagation()}
              />
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Access',
      cell: (d) => {
        const status = effectiveStatus(d);
        const badge = STATUS_BADGE[status];
        return (
          <div className="space-y-1">
            <Badge tone={badge.tone} size="sm" dot={status === 'active'}>
              {badge.text}
            </Badge>
            <p
              className={cn(
                'text-xs whitespace-nowrap',
                status === 'expired' ? 'font-medium text-warning-700' : 'text-ink-500',
              )}
              title={d.expires_at ? formatDateTime(d.expires_at) : undefined}
            >
              {accessText(d)}
            </p>
          </div>
        );
      },
    },
    {
      key: 'plan',
      header: 'Plan & site',
      hideBelow: 'md',
      cell: (d) => (
        <div className="min-w-0 text-sm">
          <p className="font-medium text-ink-900">{d.plan_name ?? 'No plan'}</p>
          <p className="text-xs text-ink-500">
            {d.router_name ?? 'No router'}
            {d.router_location ? ` · ${d.router_location}` : ''}
          </p>
        </div>
      ),
    },
    {
      key: 'activity',
      header: 'Activity',
      hideBelow: 'lg',
      cell: (d) => {
        const session = sessionText(d);
        const last = d.accounting?.last_connected_at;
        return (
          <div
            className="text-xs whitespace-nowrap"
            title="From recorded MAC sessions; an open record does not guarantee the device is online right now."
          >
            <p className="text-ink-800 flex items-center gap-1.5 font-medium">
              <span
                aria-hidden
                className={cn(
                  'size-1.5 rounded-full',
                  session.open ? 'bg-success-600' : 'bg-ink-300',
                )}
              />
              {session.text}
              {d.accounting?.bytes_total != null && (
                <>
                  <span aria-hidden className="text-ink-300">
                    ·
                  </span>
                  <span className="font-normal text-ink-500">
                    {formatBytes(d.accounting.bytes_total)}
                  </span>
                </>
              )}
            </p>
            {last && (
              <p className="mt-0.5 text-ink-500" title={formatDateTime(last)}>
                Last seen {formatRelative(last)}
              </p>
            )}
          </div>
        );
      },
    },
  ];

  const attention = (summary?.expired ?? 0) + (summary?.suspended ?? 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Network access</p>
          <h1 className="text-2xl font-bold text-ink-900">IoT &amp; MAC devices</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            Cameras, TVs, POS terminals and other equipment that connect by MAC address, without a
            voucher login.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Refresh devices"
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
          {canManage && (
            <Button
              size="sm"
              leadingIcon={<Plus className="size-4" aria-hidden />}
              onClick={() => setDialog({ open: true })}
            >
              Add device
            </Button>
          )}
        </div>
      </header>

      {(query.isPending || summary) && (
        <section aria-label="Device summary" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiTile
            label="Registered devices"
            value={summary ? formatNumber(summary.total) : '—'}
            detail={
              summary
                ? `${formatNumber(summary.active)} active · ${formatNumber(attention)} need attention`
                : 'Current registrations'
            }
            extra={
              summary && summary.total > 0 ? (
                <MiniBar
                  parts={[
                    { value: summary.active, color: 'var(--color-success-600)' },
                    { value: summary.expired, color: 'var(--color-warning-600)' },
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
            detail={
              summary
                ? `${formatNumber(summary.permanent)} with permanent access`
                : 'Allowed onto the network'
            }
            loading={query.isPending}
          />
          <KpiTile
            label="Expiring in 7 days"
            value={summary ? formatNumber(summary.expiring_7d) : '—'}
            detail={
              summary && summary.expiring_7d > 0
                ? 'Renew to avoid a cut-off'
                : 'Nothing due this week'
            }
            extra={
              summary && summary.expiring_7d > 0 ? (
                <span aria-hidden className="block h-1 rounded-full bg-warning-600" />
              ) : undefined
            }
            loading={query.isPending}
          />
          <KpiTile
            label="Expired or suspended"
            value={summary ? formatNumber(attention) : '—'}
            detail={
              summary
                ? `${formatNumber(summary.expired)} expired · ${formatNumber(summary.suspended)} suspended`
                : 'Not allowed onto the network'
            }
            loading={query.isPending}
          />
        </section>
      )}

      <Card padded={false} className="space-y-4 p-4 md:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink-900">Device directory</h2>
            <p className="text-xs text-ink-500">
              Activity comes from recorded MAC sessions. Saving a device does not by itself confirm
              network access; the router must be connected to Yarotech RADIUS.
            </p>
          </div>
          <p role="status" className="text-sm text-ink-500">
            {query.isPlaceholderData
              ? 'Updating results…'
              : query.data
                ? `${formatNumber(query.data.count)} matching ${query.data.count === 1 ? 'device' : 'devices'}`
                : 'Loading devices…'}
          </p>
        </div>

        <section aria-label="Device filters" className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-72">
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search name or MAC address"
              ariaLabel="Search devices"
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              aria-label="Status"
              size="sm"
              value={list.state.filters.is_active ?? ''}
              onChange={(e) => list.setFilter('is_active', e.target.value || undefined)}
              options={[
                { value: '', label: 'Any status' },
                { value: 'true', label: 'Switched on' },
                { value: 'false', label: 'Switched off' },
              ]}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              aria-label="Router"
              size="sm"
              value={list.state.filters.router ?? ''}
              onChange={(e) => list.setFilter('router', e.target.value || undefined)}
              disabled={routers.isPending}
              options={[
                { value: '', label: 'All routers' },
                ...(routers.data ?? []).map((r) => ({ value: r.id, label: r.name })),
              ]}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              aria-label="Plan"
              size="sm"
              value={list.state.filters.plan ?? ''}
              onChange={(e) => list.setFilter('plan', e.target.value || undefined)}
              disabled={plans.isPending}
              options={[
                { value: '', label: plans.isPending ? 'Loading plans…' : 'All plans' },
                ...(list.state.filters.plan &&
                !plans.data?.some((plan) => String(plan.id) === list.state.filters.plan)
                  ? [{ value: list.state.filters.plan, label: 'Selected plan unavailable' }]
                  : []),
                ...(plans.data ?? []).map((p) => ({ value: String(p.id), label: p.name })),
              ]}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              aria-label="Retained registrations"
              size="sm"
              value={list.state.filters.include_deleted ?? ''}
              onChange={(e) => list.setFilter('include_deleted', e.target.value || undefined)}
              options={[
                { value: '', label: 'Current registrations' },
                { value: 'true', label: 'Include removed' },
              ]}
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

        {routers.isError && (
          <Alert
            tone="warning"
            actions={
              <Button variant="secondary" onClick={() => void routers.refetch()}>
                Retry routers
              </Button>
            }
          >
            Router filters could not be loaded.
          </Alert>
        )}
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
          className="relative max-w-full min-w-0"
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
                onRowClick: open,
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
                        <MoreHorizontal className="size-4" />
                      </Button>
                    )}
                    items={
                      d.status === 'deleted'
                        ? [{ key: 'history', label: 'History', onSelect: () => setManaging(d) }]
                        : [
                            {
                              key: 'manage',
                              label: 'Manage access / Renew',
                              icon: <RotateCcw className="h-4 w-4" aria-hidden />,
                              onSelect: () => setManaging(d),
                            },
                            {
                              key: 'edit',
                              label: 'Edit',
                              icon: <Pencil className="h-4 w-4" aria-hidden />,
                              onSelect: () => setDialog({ open: true, device: d }),
                            },
                            'separator' as const,
                            {
                              key: 'delete',
                              label: 'Remove',
                              icon: <Trash2 className="h-4 w-4" aria-hidden />,
                              tone: 'danger' as const,
                              onSelect: () => setDeleting(d),
                            },
                          ]
                    }
                  />
                ),
              }
            : {})}
          empty={
            list.activeFilterCount > 0 ? (
              <EmptyState
                icon={<MonitorSmartphone className="size-6" aria-hidden />}
                title="No devices match"
                description="Try another router, plan or search term."
                action={
                  <Button variant="secondary" onClick={list.clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<MonitorSmartphone className="size-6" aria-hidden />}
                title="No devices registered yet"
                description={
                  canManage
                    ? 'Add a camera, TV or other equipment by its MAC address to let it online without a voucher.'
                    : 'Registered devices will show up here once a manager adds them.'
                }
                action={
                  canManage ? (
                    <Button onClick={() => setDialog({ open: true })}>Add device</Button>
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
      </Card>

      {canManage && dialog.open && (
        <DeviceDialog
          open={dialog.open}
          {...(dialog.device ? { device: dialog.device } : {})}
          onClose={() => setDialog({ open: false })}
          onSaved={() => {
            setDialog({ open: false });
            void query.refetch();
          }}
        />
      )}

      {canManage && managing !== null && (
        <DeviceLifecycleDialog device={managing} onClose={() => setManaging(null)} />
      )}

      {canManage && deleting !== null && (
        <ConfirmDialog
          open={deleting !== null}
          onClose={() => setDeleting(null)}
          tone="danger"
          title={`Remove ${deleting.device_name}?`}
          description="The device loses network access straight away. Its history is kept and can be viewed under “Include removed”."
          confirmLabel="Remove device"
          onConfirm={async () => {
            try {
              await remove.mutateAsync({ id: deleting.id, version: deleting.version ?? 0 });
              setDeleting(null);
              toast.success('Device removed', deleting.device_name);
              void query.refetch();
            } catch (error) {
              toast.error('Could not remove device', errorMessage(error));
            }
          }}
        />
      )}
    </div>
  );
}
