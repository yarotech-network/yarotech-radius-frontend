import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui';
import { errorMessage } from '@/services/api/errors';
import { http } from '@/services/api/http';
import type { HotspotSetupResult } from './HotspotSetupPanel';

export type LocalLabResult = {
  client_interfaces?: {
    name: string;
    kind: string;
    role: 'client';
    bridge: string;
    source: 'package' | 'reviewed_extension';
  }[];
  progress?: {
    configuration: { passed: boolean; checked_at: string | null; fresh: boolean };
    customer_login: { passed: boolean; checked_at: string | null; fresh: boolean };
  };
  eligible: boolean;
  status: 'not_verified' | 'verified' | 'incomplete' | 'stale' | 'unreachable';
  checked_at: string | null;
  code: string | null;
  checks: { check_type: string; passed: boolean }[];
};
const labels: Record<string, string> = {
  device: 'Router model and OS',
  management_separation: 'Management and WAN separation',
  client_binding: 'Customer port and bridge',
  gateway: 'Customer gateway',
  hotspot: 'Active local Hotspot',
  dhcp: 'Active DHCP server',
  client_lease: 'Customer DHCP lease',
  local_login: 'Active test-user login',
};
const statuses: Record<LocalLabResult['status'], string> = {
  verified: 'Local lab verified',
  incomplete: 'Local lab checks incomplete',
  stale: 'Local lab evidence expired',
  unreachable: 'Local lab could not be checked',
  not_verified: 'Local lab not yet verified',
};

export function LocalLabVerification({
  routerId,
  intentId,
  result,
}: {
  routerId: string;
  intentId: string;
  result: LocalLabResult;
}) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      http.post<HotspotSetupResult>(`/routers/${routerId}/hotspot-setup/verify-local-lab/`, {
        intent_id: intentId,
      }),
    onSuccess: (data) => {
      client.setQueryData(['routers', 'hotspot-setup', routerId], data);
      void client.invalidateQueries({ queryKey: ['routers', 'audit', routerId] });
    },
  });
  return (
    <div className="space-y-3">
      {!!result.client_interfaces?.length && (
        <section aria-label="Expected Hotspot client interfaces" className="space-y-3">
          <h3 className="text-lg font-semibold">Expected Hotspot client interfaces</h3>
          <p>
            Wired and Wi-Fi interfaces both use the Hotspot clients role. Their interface type
            distinguishes them.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th>Interface</th>
                  <th>Type</th>
                  <th>Role</th>
                  <th>Bridge</th>
                </tr>
              </thead>
              <tbody>
                {result.client_interfaces.map((port) => (
                  <tr key={port.name}>
                    <td>
                      {port.name}
                      {port.source === 'reviewed_extension' && (
                        <span className="block text-xs">Reviewed Wi-Fi addition</span>
                      )}
                    </td>
                    <td>{port.kind === 'wireless' ? 'Wireless (Wi-Fi)' : port.kind}</td>
                    <td>Hotspot clients</td>
                    <td>{port.bridge}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.client_interfaces.some((port) => port.source === 'reviewed_extension') && (
            <p className="text-sm text-ink-500">
              The Wi-Fi addition is included in verification. Previously downloaded installation and
              cleanup scripts still describe the original package; review the addition separately
              before cleanup.
            </p>
          )}
        </section>
      )}
      {result.progress && (
        <section aria-label="Saved lab testing progress" className="space-y-3">
          <h3 className="text-lg font-semibold">Saved lab testing progress</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="setup-port">
              <strong>
                {result.progress.configuration.passed
                  ? result.progress.configuration.fresh
                    ? 'Router configuration verified'
                    : 'Router configuration previously verified'
                  : 'Router configuration awaiting verification'}
              </strong>
              <span>
                {result.progress.configuration.passed
                  ? 'Seven configuration checks passed.'
                  : 'All seven configuration checks must pass together.'}
              </span>
              {result.progress.configuration.checked_at && (
                <span>
                  Observed: {new Date(result.progress.configuration.checked_at).toLocaleString()}
                </span>
              )}
              {!result.progress.configuration.fresh && result.progress.configuration.checked_at && (
                <span>Saved observation; current state requires a new check.</span>
              )}
            </div>
            <div className="setup-port">
              <strong>
                {result.progress.customer_login.passed
                  ? result.progress.customer_login.fresh
                    ? 'Customer login confirmed'
                    : 'Customer login previously confirmed'
                  : 'Customer login awaiting live confirmation'}
              </strong>
              <span>
                With one cable, keep management connected. Complete this check later with a customer
                device connected separately.
              </span>
              {result.progress.customer_login.passed &&
                result.progress.customer_login.checked_at && (
                  <span>
                    Observed: {new Date(result.progress.customer_login.checked_at).toLocaleString()}
                  </span>
                )}
            </div>
            <div className="setup-port">
              <strong>RADIUS and production testing pending</strong>
              <span>
                Local testing does not verify RADIUS, vouchers, payments or production readiness.
              </span>
            </div>
          </div>
          <p className="text-sm text-ink-500">
            Progress is saved for this package. Older discovery and download-review expiry do not
            erase completed observations. A replaced or revoked package requires its own
            verification.
          </p>
        </section>
      )}
      <h3 className="text-lg font-semibold">{statuses[result.status]}</h3>
      <p>
        Checks the router without changing its configuration. Keep management access available and
        the lab user logged in on the customer port.
      </p>
      <p className="text-sm text-ink-500">
        With one computer and cable, return to ether2 and restore 192.168.88.2 for management before
        checking. The customer session may expire after disconnecting; an incomplete check does not
        mean the login failed.
      </p>
      <p className="text-sm text-ink-500">
        This verifies observed configuration and a local login only. Internet access, isolation,
        speed and quota enforcement, system vouchers, payments and RADIUS remain unverified. Live
        evidence expires after 10 minutes; saved observations retain their timestamps.
      </p>
      {!result.eligible && (
        <p>
          Verification requires an exported local-user package with current operator approval. A
          revoked or changed router review cannot be verified.
        </p>
      )}
      {result.checked_at && <p>Last checked: {new Date(result.checked_at).toLocaleString()}</p>}
      {result.code && (
        <p role="alert">
          Management check failed ({result.code}). Check the management cable, HTTPS access and
          saved credentials, then retry.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {result.checks.map((check) => (
          <div className="setup-port" key={check.check_type}>
            <span>{labels[check.check_type] ?? check.check_type}</span>
            <strong>
              {result.status === 'stale'
                ? 'Fresh check required'
                : check.passed
                  ? 'Observed'
                  : 'Not confirmed'}
            </strong>
          </div>
        ))}
      </div>
      {mutation.isError && <p role="alert">{errorMessage(mutation.error)}</p>}
      <Button disabled={!result.eligible || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? 'Checking local lab...' : 'Verify local lab'}
      </Button>
    </div>
  );
}
