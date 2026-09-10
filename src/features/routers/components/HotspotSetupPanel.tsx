import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Check, Copy, Download, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { Alert, ErrorState, useToast } from '@/components/feedback';
import { http } from '@/services/api/http';
import { errorMessage, isApiError } from '@/services/api/errors';
import type { NasDevice } from '@/types/api';
import { HotspotLabPackage } from './HotspotLabPackage';
import { RouterDiscovery, type RouterInventory } from './RouterDiscovery';

type Port = {
  name: string;
  kind: 'ethernet' | 'wireless' | 'vlan' | 'bond' | 'other';
  role: 'wan' | 'management' | 'client' | 'unused';
  bridge: string;
};
type Configuration = {
  inventory_id?: string | null;
  model: string;
  routeros_version: string;
  service: 'hotspot';
  mode: 'fresh' | 'existing';
  bridge: string;
  hotspot_name: string;
  profile_name: string;
  gateway: string;
  radius_server: string;
  interfaces: Port[];
  inventory_confirmed: boolean;
};
export type HotspotSetupResult = {
  discovery?: RouterInventory | null;
  device_profile?: { model: string; routeros_version: string };
  compatibility?: {
    status: 'incomplete' | 'unsupported' | 'unverified' | 'discovery_required' | 'blocked';
    reasons?: string[];
    reason: string;
  };
  version: string;
  execution_enabled: boolean;
  supported_targets: string[];
  gate: string;
  inventory_source: string;
  ready: boolean;
  intent: null | {
    id: string;
    version: string;
    state: 'review' | 'revoked' | 'expired' | 'stale';
    created_at: string;
    expires_at: string;
    configuration: Configuration;
    script_preview: string | null;
  };
  evidence: { check_type: string; passed: boolean; checked_at: string | null; fresh: boolean }[];
};
const initial: Configuration = {
  model: '',
  routeros_version: '',
  service: 'hotspot',
  mode: 'fresh',
  bridge: 'yarotech-hotspot',
  hotspot_name: 'yarotech-hotspot',
  profile_name: 'yarotech-profile',
  gateway: '',
  radius_server: '',
  interfaces: [],
  inventory_confirmed: false,
};
const names: Record<string, string> = {
  wireguard_peer: 'WireGuard connection',
  radius_auth: 'RADIUS authentication',
  radius_acct: 'RADIUS accounting',
};

export function HotspotSetupPanel({ router }: { router: NasDevice }) {
  const query = useQuery({
    queryKey: ['routers', 'hotspot-setup', router.id],
    queryFn: () => http.get<HotspotSetupResult>(`/routers/${router.id}/hotspot-setup/`),
    refetchInterval: 60_000,
  });
  if (query.isPending) return <p role="status">Loading Hotspot setup...</p>;
  if (query.isError)
    return (
      <ErrorState
        title="Hotspot setup is unavailable"
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <SetupWorkspace
      router={router}
      data={query.data}
      refreshing={query.isFetching}
      refresh={() => void query.refetch()}
    />
  );
}

function SetupWorkspace({
  router,
  data,
  refresh,
  refreshing,
}: {
  router: NasDevice;
  data: HotspotSetupResult;
  refresh: () => void;
  refreshing: boolean;
}) {
  const client = useQueryClient();
  const toast = useToast();
  const [draft, setDraft] = useState<Configuration>(
    () =>
      data.intent?.configuration ?? {
        ...initial,
        model: data.device_profile?.model ?? router.model ?? '',
        routeros_version: data.device_profile?.routeros_version ?? router.routeros_version ?? '',
      },
  );
  const [step, setStep] = useState(data.intent ? 1 : 0);
  const [portName, setPortName] = useState('');
  const [portKind, setPortKind] = useState<Port['kind']>('ethernet');
  const [message, setMessage] = useState('');
  const mutation = useMutation({
    mutationFn: (revoke: boolean) =>
      revoke
        ? http.post<HotspotSetupResult>(`/routers/${router.id}/hotspot-setup/revoke/`, {
            intent_id: data.intent?.id,
          })
        : http.post<HotspotSetupResult>(`/routers/${router.id}/hotspot-setup/`, {
            ...draft,
            expected_updated_at: router.updated_at,
          }),
    onSuccess: (result) => {
      client.setQueryData(['routers', 'hotspot-setup', router.id], result);
      void client.invalidateQueries({ queryKey: ['routers', 'audit', router.id] });
      setStep(1);
      setMessage('');
    },
  });
  const update = <K extends keyof Configuration>(key: K, value: Configuration[K]) => {
    setDraft((old) => ({
      ...old,
      [key]: value,
      inventory_confirmed: key === 'inventory_confirmed' ? Boolean(value) : false,
    }));
    setMessage('');
  };
  function addPort() {
    if (draft.interfaces.length >= 64) {
      setMessage('The review supports up to 64 interfaces.');
      return;
    }
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,62}$/.test(portName) ||
      draft.interfaces.some((port) => port.name === portName)
    ) {
      setMessage(
        'Use a unique interface name from the router inventory (letters, numbers, dots, dashes, colons or underscores).',
      );
      return;
    }
    update('interfaces', [
      ...draft.interfaces,
      { name: portName, kind: portKind, role: 'unused', bridge: '' },
    ]);
    setPortName('');
  }
  async function submit(revoke = false) {
    setMessage('');
    try {
      await mutation.mutateAsync(revoke);
    } catch (error) {
      setMessage(
        isApiError(error) && error.hasFieldErrors
          ? Object.entries(error.fields)
              .map(([field, messages]) => `${field.replaceAll('_', ' ')}: ${messages.join(' ')}`)
              .join(' / ')
          : errorMessage(error),
      );
    }
  }
  const preview = data.intent?.state === 'review' ? data.intent.script_preview : null;
  async function copy() {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview);
      toast.success('Review copied', 'This artifact cannot execute a router configuration.');
    } catch {
      setMessage('Copy failed. Select the review text or download the file.');
    }
  }
  function download() {
    if (!preview) return;
    const url = URL.createObjectURL(new Blob([preview], { type: 'text/plain' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `yarotech-hotspot-review-${router.id}.txt`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="hotspot-workspace space-y-6" aria-label="Hotspot setup workspace">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-ink-900">MikroTik Hotspot setup</h2>
          <p className="mt-1 text-sm text-ink-500">
            Review your interfaces and prepare a configuration for this device.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={refreshing || mutation.isPending}
          onClick={refresh}
          leadingIcon={<RefreshCw />}
        >
          Refresh setup
        </Button>
      </div>
      <div className="router-workflow" aria-label="Setup steps">
        {['Identity & services', 'Configuration review', 'Verification'].map((label, index) => (
          <button
            type="button"
            key={label}
            className="p-4 text-left"
            aria-current={step === index ? 'step' : undefined}
            disabled={mutation.isPending || (index > 0 && !data.intent)}
            onClick={() => setStep(index)}
          >
            <span>0{index + 1}</span>
            <strong>{label}</strong>
          </button>
        ))}
      </div>
      <Alert tone="info" title="Lab validation pending">
        Production deployment is not enabled. A separate fresh-install lab package is available
        after discovery and review; router readiness still requires independent connection and
        RADIUS evidence.
      </Alert>
      {message && (
        <Alert tone="danger" title="Configuration needs attention">
          {message}
        </Alert>
      )}
      {step === 0 && draft.routeros_version && !draft.routeros_version.startsWith('7.') && (
        <Alert tone="warning" title="Hotspot review is not supported for this RouterOS version">
          This router can remain registered, but the current review generator only accepts RouterOS
          7 targets. Entering a version does not enable executable scripts.
        </Alert>
      )}
      {step === 0 && (
        <RouterDiscovery
          router={router}
          data={data}
          disabled={mutation.isPending}
          onAdopt={(inventory) => {
            setDraft((old) => ({
              ...old,
              inventory_id: inventory.id,
              model: inventory.model,
              routeros_version: inventory.routeros_version,
              interfaces: inventory.interfaces.map((port) => ({
                name: port.name,
                kind: port.kind,
                bridge: port.bridge,
                role: port.protected_reasons.includes('wan')
                  ? 'wan'
                  : port.protected_reasons.includes('management')
                    ? 'management'
                    : 'unused',
              })),
              inventory_confirmed: false,
            }));
            setMessage('');
          }}
        />
      )}
      {step === 0 && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="space-y-6"
        >
          <fieldset disabled={mutation.isPending} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="setup-field">
                MikroTik identity
                <Input value={router.name} readOnly />
              </label>
              <label className="setup-field">
                Service
                <Input value="Public Hotspot" readOnly />
                <span>PPPoE support follows in a later phase.</span>
              </label>
              <label className="setup-field">
                Router model
                <Input
                  required
                  maxLength={80}
                  value={draft.model}
                  onChange={(e) => update('model', e.target.value)}
                  placeholder="Model shown in System Resources"
                />
              </label>
              <label className="setup-field">
                RouterOS version
                <Input
                  required
                  value={draft.routeros_version}
                  onChange={(e) => update('routeros_version', e.target.value)}
                  placeholder="7.x (exact installed version)"
                />
              </label>
              <label className="setup-field">
                Setup type
                <Select
                  value={draft.mode}
                  onChange={(e) => update('mode', e.target.value as Configuration['mode'])}
                  options={[
                    { value: 'fresh', label: 'New Hotspot on unused interfaces' },
                    { value: 'existing', label: 'Review an existing Hotspot migration' },
                  ]}
                />
              </label>
              <label className="setup-field">
                Hotspot bridge
                <Input
                  required
                  value={draft.bridge}
                  onChange={(e) => update('bridge', e.target.value)}
                />
              </label>
              <label className="setup-field">
                Hotspot server name
                <Input
                  required
                  value={draft.hotspot_name}
                  onChange={(e) => update('hotspot_name', e.target.value)}
                />
              </label>
              <label className="setup-field">
                Hotspot profile name
                <Input
                  required
                  value={draft.profile_name}
                  onChange={(e) => update('profile_name', e.target.value)}
                />
              </label>
              <label className="setup-field">
                Client gateway / prefix
                <Input
                  required
                  value={draft.gateway}
                  onChange={(e) => update('gateway', e.target.value)}
                  placeholder="10.40.0.1/24"
                />
              </label>
              <label className="setup-field">
                RADIUS server address
                <Input
                  required
                  value={draft.radius_server}
                  onChange={(e) => update('radius_server', e.target.value)}
                  placeholder="Reachable server IPv4 address"
                />
              </label>
            </div>
            <section className="space-y-4" aria-labelledby="inventory-heading">
              <h3 id="inventory-heading" className="font-semibold">
                Interface inventory
              </h3>
              <p className="text-sm text-ink-500">
                Read interface names, types and bridge membership in WinBox. Add the actual
                interfaces below, including separate WAN and management ports. Nothing is selected
                for client traffic automatically.
              </p>
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="setup-field">
                  Interface name
                  <Input
                    value={portName}
                    onChange={(e) => setPortName(e.target.value)}
                    placeholder="ether2, wifi1, vlan10..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addPort();
                      }
                    }}
                  />
                </label>
                <label className="setup-field">
                  Interface type
                  <Select
                    value={portKind}
                    onChange={(e) => setPortKind(e.target.value as Port['kind'])}
                    options={['ethernet', 'wireless', 'vlan', 'bond', 'other'].map((value) => ({
                      value,
                      label: value,
                    }))}
                  />
                </label>
                <Button
                  type="button"
                  variant="secondary"
                  className="self-end"
                  disabled={draft.interfaces.length >= 64}
                  onClick={addPort}
                  leadingIcon={<Plus />}
                >
                  Add interface
                </Button>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {draft.interfaces.map((port, index) => (
                  <div
                    className={`setup-port ${port.role === 'client' ? 'setup-port-selected' : ''}`}
                    key={port.name}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="break-all">{port.name}</strong>
                      <span className="text-xs text-ink-500">{port.kind}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        type="button"
                        aria-label={`Remove ${port.name}`}
                        onClick={() =>
                          update(
                            'interfaces',
                            draft.interfaces.filter((_, i) => i !== index),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <label className="setup-field">
                      Role for {port.name}
                      <Select
                        value={port.role}
                        onChange={(e) =>
                          update(
                            'interfaces',
                            draft.interfaces.map((p, i) =>
                              i === index ? { ...p, role: e.target.value as Port['role'] } : p,
                            ),
                          )
                        }
                        options={[
                          { value: 'unused', label: 'Not selected' },
                          { value: 'wan', label: 'WAN - protected' },
                          { value: 'management', label: 'Management - protected' },
                          { value: 'client', label: 'Hotspot clients' },
                        ]}
                      />
                    </label>
                    <label className="setup-field">
                      Current bridge for {port.name}
                      <Input
                        value={port.bridge}
                        onChange={(e) =>
                          update(
                            'interfaces',
                            draft.interfaces.map((p, i) =>
                              i === index ? { ...p, bridge: e.target.value } : p,
                            ),
                          )
                        }
                        placeholder="Leave blank if not bridged"
                      />
                    </label>
                    {['wan', 'management'].includes(port.role) && (
                      <span className="flex items-center gap-2 text-xs text-brand-700">
                        <Shield className="size-3" />
                        Excluded from client bridge changes
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={draft.inventory_confirmed}
                onChange={(e) => update('inventory_confirmed', e.target.checked)}
                required
                className="mt-1"
              />
              I checked this inventory and interface roles against this router. This is
              {draft.inventory_id
                ? 'based on the selected discovery snapshot.'
                : 'operator-confirmed information, not automatic discovery.'}
            </label>
            <Button type="submit" disabled={mutation.isPending || !draft.inventory_confirmed}>
              {mutation.isPending ? 'Saving review...' : 'Save configuration review'}
            </Button>
          </fieldset>
        </form>
      )}
      {step === 1 && data.intent && (
        <div className="space-y-5">
          <div>
            <h3 className="text-lg font-semibold">Configuration review</h3>
            <p className="mt-1 text-sm text-ink-500">
              {data.intent.version} / {data.intent.state}. Review access expires{' '}
              {new Date(data.intent.expires_at).toLocaleString()}.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="setup-port">
              <span className="router-eyebrow">Service</span>
              <strong>Public Hotspot</strong>
            </div>
            <div className="setup-port">
              <span className="router-eyebrow">Target bridge</span>
              <strong>{data.intent.configuration.bridge}</strong>
            </div>
            <div className="setup-port">
              <span className="router-eyebrow">Client interfaces</span>
              <strong>
                {data.intent.configuration.interfaces
                  .filter((p) => p.role === 'client')
                  .map((p) => p.name)
                  .join(', ')}
              </strong>
            </div>
          </div>
          {preview ? (
            <>
              <p className="text-sm text-ink-500">
                Candidate additions/settings are shown below. Existing bridge membership is
                preserved in migration review. This is not a complete configuration diff or an
                executable setup command.
              </p>
              <pre className="setup-preview" tabIndex={0} aria-label="Non-executable script review">
                {preview}
              </pre>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void copy()} leadingIcon={<Copy />}>
                  Copy review
                </Button>
                <Button variant="secondary" onClick={download} leadingIcon={<Download />}>
                  Download review
                </Button>
                <Button
                  variant="secondary"
                  disabled={mutation.isPending}
                  onClick={() => void submit(true)}
                >
                  Revoke review
                </Button>
              </div>
              <p className="text-xs text-ink-500">
                Revocation removes access to this saved review. Previously copied, non-executable
                files cannot be recalled.
              </p>
            </>
          ) : (
            <Alert tone="warning" title="Review unavailable">
              This review was revoked, expired or its router record changed. Return to identity and
              services to save a fresh review.
            </Alert>
          )}
          {preview && <HotspotLabPackage router={router} data={data} />}
          <Button onClick={() => setStep(2)}>Review verification checks</Button>
        </div>
      )}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Awaiting verified deployment</h3>
          <p className="text-sm text-ink-500">
            Saving a review does not configure the router. Executable deployment remains gated by
            hardware validation; checks alone cannot mark this draft ready.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {data.evidence.map((check) => (
              <div className="setup-port" key={check.check_type}>
                <span>{names[check.check_type] ?? check.check_type}</span>
                <strong className="flex items-center gap-2">
                  {check.passed ? (
                    <>
                      <Check className="size-4 text-success-600" />
                      Fresh check passed
                    </>
                  ) : check.checked_at ? (
                    check.fresh ? (
                      'Check failed'
                    ) : (
                      'Fresh check required'
                    )
                  ) : (
                    'Not verified'
                  )}
                </strong>
                <span className="text-xs text-ink-500">
                  {check.checked_at
                    ? new Date(check.checked_at).toLocaleString()
                    : 'No observation recorded'}
                </span>
              </div>
            ))}
          </div>
          <Button variant="secondary" disabled={refreshing} onClick={refresh}>
            Refresh verification
          </Button>
        </div>
      )}
    </section>
  );
}
