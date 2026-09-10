import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Radar, RefreshCw, ShieldCheck } from 'lucide-react';
import { Button, ConfirmDialog } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import type { NasDevice } from '@/types/api';
import type { HotspotSetupResult } from './HotspotSetupPanel';

export type DiscoveredInterface = {
  name: string;
  kind: 'ethernet' | 'wireless' | 'vlan' | 'bond' | 'other';
  type: string;
  disabled: boolean;
  bridge: string;
  protected_reasons: string[];
};
export type RouterInventory = {
  id: string;
  state: 'current' | 'stale' | 'changed';
  observed_at: string;
  source: 'routeros_https';
  version: string;
  model: string;
  routeros_version: string;
  reported_version: string;
  architecture: string;
  interfaces: DiscoveredInterface[];
  bridges: { name: string; 'vlan-filtering'?: string }[];
  packages: { name: string; version?: string; disabled?: string }[];
  hotspots: { name: string; interface: string; profile?: string; disabled?: string }[];
  hotspot_allowed: boolean | null;
  unavailable_sections: string[];
};

export function RouterDiscovery({
  router,
  data,
  onAdopt,
  disabled = false,
}: {
  router: NasDevice;
  data: HotspotSetupResult;
  onAdopt: (inventory: RouterInventory) => void;
  disabled?: boolean;
}) {
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const discover = useMutation({
    mutationFn: () =>
      http.post<HotspotSetupResult>(`/routers/${router.id}/hotspot-setup/discover/`, {
        expected_updated_at: router.updated_at,
      }),
    onSuccess: (result) => {
      client.setQueryData(['routers', 'hotspot-setup', router.id], result);
      void client.invalidateQueries({ queryKey: ['routers', 'audit', router.id] });
    },
  });
  const inventory = data.discovery;
  const unavailable = router.deployment_status !== 'deployed' || !router.wireguard_ip;
  const canAdopt = inventory?.state === 'current' && inventory.interfaces.length <= 64;
  return (
    <section
      className="space-y-4 rounded-xl border border-brand-100 bg-brand-50/40 p-4"
      aria-labelledby="discovery-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="discovery-title" className="flex items-center gap-2 font-semibold">
            <Radar className="size-5 text-brand-600" aria-hidden />
            Discover this router
          </h3>
          <p className="mt-1 text-sm text-ink-600">
            Read its model, OS, interfaces and Hotspot configuration through the management VPN.
            Discovery makes no router changes.
          </p>
        </div>
        <Button
          variant="secondary"
          disabled={disabled || discover.isPending || unavailable}
          onClick={() => discover.mutate()}
          leadingIcon={<RefreshCw className={discover.isPending ? 'animate-spin' : ''} />}
        >
          {discover.isPending ? 'Discovering...' : 'Discover router'}
        </Button>
      </div>
      {unavailable && (
        <p className="text-sm text-ink-600">
          First provision the management VPN in VPN &amp; provisioning. Discovery also needs saved
          RouterOS credentials, HTTPS access and a trusted router certificate.
        </p>
      )}
      {discover.isError && (
        <Alert tone="warning" title="Discovery could not finish">
          {errorMessage(discover.error)} Any previous inventory remains available below.
        </Alert>
      )}
      {inventory ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="setup-port">
              <span className="router-eyebrow">Reported model</span>
              <strong>{inventory.model}</strong>
              <span className="text-xs text-ink-500">{inventory.architecture}</span>
            </div>
            <div className="setup-port">
              <span className="router-eyebrow">Reported RouterOS</span>
              <strong>{inventory.reported_version}</strong>
            </div>
            <div className="setup-port">
              <span className="router-eyebrow">Inventory</span>
              <strong>{inventory.interfaces.length} interfaces</strong>
              <span className="text-xs text-ink-500">
                {inventory.state} / {new Date(inventory.observed_at).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="text-sm text-ink-600">
            <p>
              {inventory.hotspots.length} existing Hotspot servers; {inventory.bridges.length}{' '}
              bridges.
            </p>
            <p>
              Packages: {inventory.packages.map((item) => item.name).join(', ') || 'None reported'}
            </p>
          </div>
          <div className="space-y-2" aria-label="Discovered interface protection">
            {inventory.interfaces
              .filter((port) => port.protected_reasons.length)
              .map((port) => (
                <p key={port.name} className="flex items-start gap-2 text-sm text-brand-800">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="break-all">
                    {port.name}: {port.protected_reasons.join(', ')} protected
                  </span>
                </p>
              ))}
          </div>
          <Button
            variant="secondary"
            disabled={!canAdopt || disabled || discover.isPending}
            onClick={() => setConfirm(true)}
          >
            Use discovered interfaces
          </Button>
          {!canAdopt && (
            <p className="text-sm text-ink-600">
              Discover again if the inventory is stale or changed. Reviews support up to 64
              interfaces.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-ink-500">
          No observed inventory yet. Manually entered values remain operator-confirmed.
        </p>
      )}
      {data.compatibility && (
        <div className="text-sm text-ink-600">
          <p className="text-ink-800 font-semibold">
            Compatibility: {data.compatibility.status.replaceAll('_', ' ')}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {(data.compatibility.reasons ?? [data.compatibility.reason]).map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Use discovered inventory?"
        description="This replaces the model, OS version and interface list in your current draft. Other settings are kept. No client interface is selected automatically; review the protected ports before continuing."
        confirmLabel="Use inventory"
        onConfirm={async () => {
          if (inventory && canAdopt) {
            onAdopt(inventory);
            setConfirm(false);
          }
        }}
      />
    </section>
  );
}
