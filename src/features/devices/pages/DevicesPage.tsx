import { formatBytes } from '@/lib/formatting/units';
import '../devices.css';
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Cpu, MonitorSmartphone, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { BooleanBadge } from '@/components/layout';
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
import { useDeviceRouters } from '../queries';
import { useDevicePlans } from '../queries';
import type { DeviceListParams, MacDevice } from '@/types/api';
import { useDeleteDevice, useDevices } from '../queries';
import { DeviceLifecycleDialog } from '../components/DeviceLifecycleDialog';
import { DeviceDialog } from '../components/DeviceDialog';

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
    document.title = 'IoT / MAC Devices | Yarotech RADIUS';
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
  const [copiedMac, setCopiedMac] = useState<string | null>(null);

  const copyMac = (mac: string) => {
    void navigator.clipboard.writeText(mac);
    setCopiedMac(mac);
    toast.success('MAC address copied', mac);
    setTimeout(() => setCopiedMac(null), 2000);
  };

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

  const columns: Column<MacDevice>[] = [
    {
      key: 'device',
      header: 'Device Name',
      primary: true,
      cell: (d) => (
        <div className="min-w-0">
          {canManage ? (
            <button
              type="button"
              className="text-left font-semibold break-all text-brand-700 dark:text-brand-400 hover:underline focus-visible:outline-2 focus-visible:outline-brand-600"
              onClick={(event) => {
                event.stopPropagation();
                if (d.status === 'deleted') setManaging(d);
                else setDialog({ open: true, device: d });
              }}
            >
              {d.device_name}
            </button>
          ) : (
            <div className="font-semibold break-all text-ink-900">{d.device_name}</div>
          )}

          <p className="mt-1 text-xs text-ink-500 md:hidden">
            {d.expires_at
              ? `${isPast(d.expires_at) ? 'Expired' : 'Access until'} ${formatDateTime(d.expires_at)}`
              : 'Permanent access'}
          </p>
        </div>
      ),
    },
    {
      key: 'mac',
      header: 'MAC Address',
      cell: (d) => (
        <div className="inline-flex items-center gap-1.5 font-mono text-xs font-bold text-ink-800">
          <span>{d.mac_address}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              copyMac(d.mac_address);
            }}
            title="Copy MAC address"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded text-ink-400 hover:bg-surface-muted hover:text-ink-700 transition"
          >
            {copiedMac === d.mac_address ? (
              <Check className="size-3 text-emerald-600" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
        </div>
      ),
    },
    {
      key: 'plan',
      header: 'Plan / Policy',
      cell: (d) => <span className="break-words text-ink-700 font-medium">{d.plan_name}</span>,
    },
    {
      key: 'expires',
      header: 'Expiration',
      hideBelow: 'md',
      cell: (d) => (
        <span
          className={isPast(d.expires_at) ? 'text-xs font-semibold text-danger-700 dark:text-danger-400' : 'text-xs font-medium text-ink-700'}
          title={formatDateTime(d.expires_at)}
        >
          {!d.expires_at
            ? 'Permanent'
            : isPast(d.expires_at)
              ? `Expired ${formatRelative(d.expires_at)}`
              : formatRelative(d.expires_at)}
        </span>
      ),
    },
    {
      key: 'active',
      header: 'Status',
      cell: (d) => (
        <BooleanBadge
          value={(d.status ?? (d.is_active ? 'active' : 'suspended')) === 'active'}
          trueLabel={isPast(d.expires_at) ? 'Expired' : 'Active'}
          falseLabel={d.status ?? 'Suspended'}
        />
      ),
    },
    {
      key: 'router',
      header: 'Router / Site',
      cell: (d) => (
        <div className="text-xs">
          <span className="font-semibold text-ink-800">{d.router_name ?? 'Unassigned'}</span>
          {d.router_location && <p className="text-ink-500">{d.router_location}</p>}
        </div>
      ),
    },
    {
      key: 'session',
      header: 'Session',
      cell: (d) => (
        <span
          className="text-xs font-medium text-ink-600"
          title="Based on recorded MAC authentication sessions; an open record does not guarantee current connectivity."
        >
          {!d.accounting?.available
            ? 'Unavailable'
            : !d.accounting.session_count
              ? 'Not observed'
              : d.accounting.open_sessions
                ? `${d.accounting.open_sessions} open`
                : 'Closed'}
        </span>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      cell: (d) => (
        <span className="text-xs font-medium text-ink-600">
          {d.accounting?.bytes_total == null
            ? 'Not observed'
            : formatBytes(d.accounting.bytes_total)}
        </span>
      ),
    },
  ];

  const order = ['device', 'mac', 'router', 'active', 'plan', 'expires', 'session', 'usage'];
  columns.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  return (
    <div className="space-y-6">
      {/* Premium Hero Header */}
      <div className="router-page-hero">
        <div className="router-page-hero-inner">
          <div className="router-page-hero-text">
            <span className="router-page-hero-eyebrow">
              <Cpu className="size-3" aria-hidden /> Hardware Authentication
            </span>
            <h1 className="router-page-hero-title">IoT & MAC Devices</h1>
            <p className="router-page-hero-desc">
              Router-bound hardware equipment access managed directly by MAC address bypass.
            </p>
          </div>
          <div className="router-page-hero-actions">
            <Button
              variant="secondary"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
              leadingIcon={
                <RefreshCw
                  className={query.isFetching ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'}
                  aria-hidden
                />
              }
            >
              {query.isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
            {canManage && (
              <Button
                leadingIcon={<Plus className="size-4" aria-hidden />}
                onClick={() => setDialog({ open: true })}
              >
                Add device
              </Button>
            )}
          </div>
        </div>

        {/* Hero Stats Strip */}
        <div className="router-page-hero-strip">
          <div className="router-page-hero-stat">
            <MonitorSmartphone className="size-4" aria-hidden />
            <span>
              {query.data
                ? `${query.data.count} registered device${query.data.count !== 1 ? 's' : ''}`
                : 'Loading devices...'}
            </span>
          </div>
          <div className="router-page-hero-divider" />
          <div className="router-page-hero-stat">
            <Wifi className="size-4 text-emerald-400" aria-hidden />
            <span>RADIUS MAC Authentication Bypass</span>
          </div>
        </div>
      </div>

      <Alert tone="info">
        Connection and usage figures reflect recorded MAC sessions. Saving a device does not confirm
        network access. Access enforcement requires the configured RADIUS service and a successful router test.
      </Alert>

      {/* Directory Container Card */}
      <Card className="p-5 md:p-6 border-border/70 space-y-5 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 pb-4">
          <div>
            <h2 id="device-directory-title" className="text-xl font-bold tracking-tight text-ink-900">
              Registered Devices
            </h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Active and retained MAC device registrations across your routers.
            </p>
          </div>
          <p role="status" className="text-xs font-medium text-ink-500 rounded-full bg-surface-muted px-3 py-1 border border-border/50">
            {query.isPlaceholderData
              ? 'Updating results...'
              : query.data
                ? `${query.data.count} matching ${query.data.count === 1 ? 'device' : 'devices'}`
                : 'Device directory'}
          </p>
        </div>

        <FilterBar
          className="iot-filters"
          search={
            <SearchInput
              value={list.state.search}
              onChange={list.setSearch}
              placeholder="Search device name or MAC address"
              ariaLabel="Search devices"
            />
          }
          filters={
            <>
              <Select
                aria-label="Retained registrations"
                value={list.state.filters.include_deleted ?? ''}
                onChange={(e) => list.setFilter('include_deleted', e.target.value || undefined)}
                options={[
                  { value: '', label: 'Current registrations' },
                  { value: 'true', label: 'Include removed registrations' },
                ]}
              />
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
                onRowClick: (d: MacDevice) =>
                  d.status === 'deleted' ? setManaging(d) : setDialog({ open: true, device: d }),
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
                    items={[
                      {
                        key: 'manage',
                        label: 'Manage lifecycle',
                        onSelect: () => setManaging(d),
                      },
                      ...(d.status === 'deleted'
                        ? []
                        : [
                            {
                              key: 'edit',
                              label: 'Edit registration',
                              icon: <Pencil className="h-4 w-4" aria-hidden />,
                              onSelect: () => setDialog({ open: true, device: d }),
                            },
                            'separator' as const,
                            {
                              key: 'delete',
                              label: 'Remove registration',
                              icon: <Trash2 className="h-4 w-4" aria-hidden />,
                              tone: 'danger' as const,
                              onSelect: () => setDeleting(d),
                            },
                          ]),
                    ]}
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
                    ? 'Register equipment by MAC address to grant access.'
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
          <div className="border-t border-border/60 pt-4">
            <Pagination
              count={query.data.count}
              page={list.state.page}
              totalPages={query.data.total_pages}
              pageSize={list.state.page_size}
              onPageChange={list.setPage}
              onPageSizeChange={list.setPageSize}
              itemLabel="devices"
            />
          </div>
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
        <DeviceLifecycleDialog
          device={managing}
          onClose={() => setManaging(null)}
        />
      )}

      {canManage && deleting !== null && (
        <ConfirmDialog
          open={deleting !== null}
          onClose={() => setDeleting(null)}
          tone="danger"
          title={`Remove ${deleting.device_name}?`}
          description="Deletes the registration and revokes MAC authentication access."
          confirmLabel="Remove registration"
          onConfirm={async () => {
            try {
              await remove.mutateAsync({ id: deleting.id, version: deleting.version });
              setDeleting(null);
              toast.success('Registration removed', deleting.device_name);
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
