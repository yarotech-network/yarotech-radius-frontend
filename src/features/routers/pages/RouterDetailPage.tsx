import { RouterTelemetry, RouterConnectionBadge } from '../components/RouterTelemetry';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { MoreHorizontal, Pencil, Radio, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import {
  Button,
  Card,
  ConfirmDialog,
  DescriptionList,
  Dialog,
  Menu,
  Skeleton,
  Tabs,
} from '@/components/ui';
import { Alert, QueryBoundary, useToast } from '@/components/feedback';
import { usePrincipal } from '@/app/auth/useAuth';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { can, type Capability } from '@/services/auth/principal';
import { errorMessage, isApiError } from '@/services/api/errors';
import type { NasDevice } from '@/types/api';
import { useDeleteRouter, useRouter, useRouterHealth, useRouterOperations } from '../queries';
import { ONBOARDING_LABELS, canDeleteRouter, isRouterBusy } from '../routerRules';
import { RouterStateBadges } from '../components/RouterStateBadges';
import { RouterEditForm } from '../components/RouterEditForm';
import { OnboardingPanel } from '../components/OnboardingPanel';
import { ChecksPanel } from '../components/ChecksPanel';
import { VpnPanel } from '../components/VpnPanel';
import { SecretsPanel } from '../components/SecretsPanel';
import { RadiusTestPanel } from '../components/RadiusTestPanel';
import { RouterSetupScript } from '../components/RouterSetupScript';
import { HotspotSetupPanel } from '../components/HotspotSetupPanel';
import { HistoryPanel } from '../components/HistoryPanel';

type Tab = 'setup' | 'onboarding' | 'vpn' | 'secrets' | 'test' | 'history';
const TAB_ITEMS: { value: Tab; label: string; capability: Capability | null }[] = [
  { value: 'setup', label: 'Hotspot setup', capability: 'routers.manage' },
  { value: 'onboarding', label: 'Onboarding', capability: null },
  { value: 'vpn', label: 'VPN & provisioning', capability: null },
  { value: 'secrets', label: 'Secrets', capability: 'routers.manage' },
  { value: 'test', label: 'RADIUS test', capability: 'routers.test' },
  { value: 'history', label: 'History', capability: 'routers.diagnostics' },
];

export default function RouterDetailPage() {
  const { id = '' } = useParams();
  const query = useRouter(id);
  return (
    <QueryBoundary
      query={query}
      errorTitle="Router not found"
      skeleton={
        <>
          <PageHeader title={<Skeleton className="h-7 w-56" />} backTo="/routers" />
          <Card>
            <Skeleton className="h-24 w-full" />
          </Card>
          <Skeleton className="mt-4 h-64 w-full" />
        </>
      }
    >
      {(router) => (
        <RouterDetail
          key={router.id}
          router={router}
          refreshing={query.isFetching}
          refreshFailed={query.isError}
          onReload={() => void query.refetch()}
        />
      )}
    </QueryBoundary>
  );
}

function RouterDetail({
  router,
  onReload,
  refreshing,
  refreshFailed,
}: {
  router: NasDevice;
  onReload: () => void;
  refreshing: boolean;
  refreshFailed: boolean;
}) {
  const principal = usePrincipal();
  const canManage = can(principal, 'routers.manage');
  const canDiagnose = can(principal, 'routers.diagnostics');
  const tabs = TAB_ITEMS.filter((t) => t.capability === null || can(principal, t.capability)).map(
    ({ value, label }) => ({ value, label }),
  );
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = tabs.some((t) => t.value === tabParam) ? (tabParam as Tab) : 'onboarding';
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyNotice, setBusyNotice] = useState<string | null>(null);
  const health = useRouterHealth(router.id, canDiagnose);
  const ops = useRouterOperations({ router: router.id, page_size: 5 }, canManage);
  const remove = useDeleteRouter();
  const busy = isRouterBusy(router, ops.data?.results);
  const deletable = canDeleteRouter(router, ops.data?.results);

  function selectTab(next: Tab) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'onboarding') p.delete('tab');
        else p.set('tab', next);
        return p;
      },
      { replace: true },
    );
  }

  return (
    <div className="router-page space-y-6">
      <PageHeader
        backTo="/routers"
        crumbs={[{ label: 'Routers', to: '/routers' }, { label: router.name }]}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="min-w-0 break-words">{router.name}</span>
            <RouterStateBadges router={router} size="md" />
          </span>
        }
        description={[router.location, router.ip_address].filter(Boolean).join(' · ')}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={refreshing || health.isFetching || ops.isFetching}
              leadingIcon={
                <RefreshCw
                  className={
                    refreshing || health.isFetching || ops.isFetching ? 'animate-spin' : ''
                  }
                />
              }
              onClick={() => {
                onReload();
                if (canDiagnose) void health.refetch();
                if (canManage) void ops.refetch();
              }}
            >
              Refresh router
            </Button>
            {canManage && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  leadingIcon={<Pencil className="h-4 w-4" aria-hidden />}
                  onClick={() =>
                    busy
                      ? setBusyNotice(
                          'Wait for the current provisioning operation to finish before editing.',
                        )
                      : setEditing(true)
                  }
                >
                  Edit
                </Button>
                <Menu
                  trigger={(props) => (
                    <Button variant="ghost" size="md" aria-label="More actions" {...props}>
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  )}
                  items={[
                    {
                      key: 'delete',
                      label: deletable ? 'Delete router' : 'Delete (suspend VPN first)',
                      icon: <Trash2 className="h-4 w-4" aria-hidden />,
                      tone: 'danger',
                      disabled: !deletable,
                      onSelect: () => setDeleting(true),
                    },
                  ]}
                />
              </div>
            )}
          </div>
        }
      />

      {refreshFailed && (
        <Alert tone="warning" title="Router could not be refreshed">
          Showing the last loaded device record. Refresh again to check for changes.
        </Alert>
      )}
      {canDiagnose && health.isError && (
        <Alert tone="warning" title="Health information could not be refreshed">
          Current reachability is unknown. Use Refresh router to retry.
        </Alert>
      )}
      {canManage && ops.isError && (
        <Alert tone="warning" title="Recent operations could not be loaded">
          Refresh before managing this router to review any work in progress.
        </Alert>
      )}
      {busyNotice && (
        <Alert tone="warning" className="mb-4" onDismiss={() => setBusyNotice(null)}>
          {busyNotice}
        </Alert>
      )}

      {tab !== 'setup' && (
        <Card className="router-device-overview">
          <div className="mb-5 flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Radio className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-brand-950">Device overview</h2>
              <p className="mt-1 text-sm text-ink-600">
                Setup state, network identity and the latest available observations.
              </p>
            </div>
          </div>
          <DescriptionList
            columns={3}
            items={[
              { label: 'NAS IP', value: router.ip_address, mono: true },
              { label: 'VPN IP', value: router.wireguard_ip || 'Not configured', mono: true },
              { label: 'Location', value: router.location || 'Not provided' },
              { label: 'Onboarding', value: ONBOARDING_LABELS[router.onboarding_state] },
              {
                label: 'Reachability',
                value: !canDiagnose ? (
                  <span className="text-ink-400">—</span>
                ) : health.isPending ? (
                  <Skeleton className="h-4 w-32" />
                ) : health.isError ? (
                  <span className="text-ink-400">Unknown</span>
                ) : (
                  <RouterConnectionBadge health={health.data} />
                ),
              },
              {
                label: 'Last seen',
                value: router.last_seen_at ? (
                  <time dateTime={router.last_seen_at} title={formatDateTime(router.last_seen_at)}>
                    {formatRelative(router.last_seen_at)}
                  </time>
                ) : (
                  <span className="text-ink-400">No observation recorded</span>
                ),
              },
              ...(canDiagnose && health.data
                ? [
                    {
                      label: 'Monitor checked',
                      value: health.data.monitor_checked_at
                        ? formatDateTime(health.data.monitor_checked_at)
                        : 'Not yet observed',
                    },
                  ]
                : []),
              { label: 'Registered', value: formatDateTime(router.created_at) },
              { label: 'Updated', value: formatDateTime(router.updated_at) },
            ]}
          />
        </Card>
      )}

      {canDiagnose && !health.isPending && (
        <RouterTelemetry health={health.isError ? undefined : health.data} />
      )}

      <div className="router-section-heading">
        <h2>Device workspace</h2>
        <p>Continue setup or review this router's configuration and activity.</p>
      </div>
      <div className="router-section-tabs overflow-x-auto pb-1">
        <Tabs
          items={tabs}
          value={tab}
          onChange={selectTab}
          ariaLabel="Router sections"
          className="mb-4"
        />
      </div>
      <Card className="router-section-content">
        {tab === 'setup' && router.registration && (
          <RouterSetupScript
            key={`${router.id}:${router.is_active}:${router.onboarding_state}:${router.registration.script_sha256}`}
            router={router}
            refresh={onReload}
          />
        )}
        {tab === 'setup' && !router.registration && <HotspotSetupPanel router={router} />}
        {tab === 'onboarding' && (
          <div className="flex flex-col gap-8">
            <OnboardingPanel router={router} canManage={canManage} />
            {canDiagnose && (
              <section aria-labelledby="checks-heading">
                <h3 id="checks-heading" className="mb-2 text-sm font-semibold text-ink-900">
                  Checks
                </h3>
                <ChecksPanel routerId={router.id} />
              </section>
            )}
          </div>
        )}
        {tab === 'vpn' && <VpnPanel router={router} canManage={canManage} />}
        {tab === 'secrets' && (
          <SecretsPanel router={router} canManage={canManage} onReload={onReload} />
        )}
        {tab === 'test' && <RadiusTestPanel router={router} canManage={canManage} />}
        {tab === 'history' && <HistoryPanel routerId={router.id} />}
      </Card>

      {editing && canManage && (
        <Dialog open onClose={() => setEditing(false)} title={`Edit ${router.name}`} size="lg">
          <RouterEditForm
            router={router}
            onCancel={() => setEditing(false)}
            onSaved={(saved) => {
              setEditing(false);
              toast.success('Router updated', `${saved.name} saved.`);
            }}
          />
        </Dialog>
      )}
      <ConfirmDialog
        open={deleting && canManage && deletable}
        onClose={() => setDeleting(false)}
        tone="danger"
        title={`Delete ${router.name}?`}
        description="The router is removed as a RADIUS client and its history is deleted. Sessions already recorded are kept. This cannot be undone."
        confirmLabel="Delete router"
        onConfirm={async () => {
          if (!canManage || !deletable) return;
          try {
            await remove.mutateAsync(router.id);
            toast.success('Router deleted', `${router.name} was removed.`);
            navigate('/routers', { replace: true });
          } catch (error) {
            if (isApiError(error) && error.status === 409) {
              setDeleting(false);
              setBusyNotice(errorMessage(error));
              return;
            }
            throw error;
          }
        }}
      />
    </div>
  );
}
