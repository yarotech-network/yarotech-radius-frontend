import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Button, Input } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import type { NasDevice } from '@/types/api';
import type { HotspotSetupResult } from './HotspotSetupPanel';

type LabPackage = {
  id: string;
  generator: string;
  lab_only: boolean;
  hardware_validated: boolean;
  files: Record<string, string>;
  sha256: Record<string, string>;
};
const filenames = ['README.txt', 'stage.rsc', 'activate.rsc', 'cleanup.rsc'] as const;

export function HotspotLabPackage({
  router,
  data,
}: {
  router: NasDevice;
  data: HotspotSetupResult;
}) {
  return (
    <PackageForm
      key={`${data.intent?.id}:${data.intent?.state}:${data.discovery?.id}:${data.discovery?.state}:${router.updated_at}`}
      router={router}
      data={data}
    />
  );
}

function PackageForm({ router, data }: { router: NasDevice; data: HotspotSetupResult }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [dns, setDns] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      http.post<LabPackage>(`/routers/${router.id}/hotspot-setup/lab-package/`, {
        expected_updated_at: router.updated_at,
        intent_id: data.intent?.id,
        lab_acknowledged: acknowledged,
        dns_server: dns,
      }),
  });
  const eligible =
    data.intent?.state === 'review' &&
    data.intent.configuration.mode === 'fresh' &&
    data.discovery?.state === 'current' &&
    data.intent.configuration.inventory_id === data.discovery.id;
  function download(name: (typeof filenames)[number]) {
    const content = mutation.data?.files[name];
    if (!content) return;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      className="border-warning-200 space-y-4 rounded-xl border p-4 sm:p-5"
      aria-label="Laboratory Hotspot package"
    >
      <div>
        <h3 className="text-lg font-semibold">Prepare a lab installation</h3>
        <p className="mt-1 text-sm text-ink-500">
          Download executable scripts for a new Hotspot on unused Ethernet or wireless interfaces.
          Real-router validation is pending.
        </p>
      </div>
      <Alert tone="warning" title="These scripts can change your router">
        Stage creates disabled resources. Activate enables them separately. Cleanup removes this
        package's resources. Read the included guide and test with independent management access.
        Existing RADIUS credentials must already be configured; this package contains no secrets.
      </Alert>
      {!eligible && (
        <p className="text-sm text-ink-500">
          Discover this router, use its interfaces and save a fresh-install review before exporting.
          Existing-network migration remains review-only.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
      >
        <label className="setup-field">
          Client DNS server
          <Input
            required
            value={dns}
            placeholder="Reachable DNS server IPv4 address"
            disabled={mutation.isPending || !eligible}
            onChange={(event) => {
              setDns(event.target.value);
              mutation.reset();
            }}
          />
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            required
            checked={acknowledged}
            disabled={!eligible || mutation.isPending}
            onChange={(event) => {
              setAcknowledged(event.target.checked);
              mutation.reset();
            }}
            className="mt-1"
          />
          I understand this package is for lab testing and has not been validated on real hardware.
        </label>
        <Button
          type="submit"
          disabled={!eligible || !acknowledged || !dns.trim() || mutation.isPending}
        >
          {mutation.isPending ? 'Preparing package...' : 'Generate lab package'}
        </Button>
      </form>
      {mutation.isError && (
        <Alert tone="danger" title="Package could not be generated">
          {errorMessage(mutation.error)}
        </Alert>
      )}
      {mutation.data && (
        <div className="space-y-3" role="status">
          <p className="text-sm font-semibold">
            Lab package prepared. No commands have been sent to the router.
          </p>
          <div className="flex flex-wrap gap-2">
            {filenames.map((name) => (
              <Button
                key={name}
                variant="secondary"
                leadingIcon={<Download />}
                onClick={() => download(name)}
              >
                Download {name}
              </Button>
            ))}
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">
              Read installation and recovery instructions
            </summary>
            <pre className="mt-3 text-xs break-words whitespace-pre-wrap text-ink-600">
              {mutation.data.files['README.txt']}
            </pre>
          </details>
          <p className="text-xs text-ink-500">
            Downloaded scripts cannot be recalled or expired remotely. Delete old copies after
            changes. Importing a script does not verify deployment or update dashboard readiness.
          </p>
        </div>
      )}
    </section>
  );
}
