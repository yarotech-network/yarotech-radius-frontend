import { useEffect, useState } from 'react';
import { Button, Card } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type { NasDevice } from '@/types/api';

type Script = { filename: string; script: string; sha256: string; import_command: string };
const ERRORS: Record<string, string> = {
  server_configuration_required:
    'The administrator needs to configure the WireGuard endpoint, hub key and RADIUS service address.',
  server_provisioning_disabled:
    'Automatic server preparation is not enabled yet. The router details have been saved.',
  provisioning_failed:
    'Server preparation failed. The administrator can check the provisioning service, then retry with the same router.',
};

export function RouterSetupScript({ router, refresh }: { router: NasDevice; refresh: () => void }) {
  const [script, setScript] = useState<Script | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const status = router.registration?.status;
  const available = router.is_active && router.onboarding_state !== 'suspended';
  useEffect(() => {
    if (status !== 'preparing') return;
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [status, refresh]);
  async function run(action: 'retry' | 'show') {
    setBusy(true);
    setError('');
    try {
      if (action === 'retry') {
        await http.post(
          `/routers/${router.id}/setup-script/retry/`,
          {},
          { idempotencyKey: newIdempotencyKey('router-setup') },
        );
        refresh();
      } else setScript(await http.get<Script>(`/routers/${router.id}/setup-script/`));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  function download() {
    if (!script) return;
    const url = URL.createObjectURL(
      new Blob([script.script], { type: 'text/plain;charset=utf-8' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = script.filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold">Router setup script</h2>
      <p>
        NAS identifier: <strong>{router.registration?.nas_identifier}</strong>. HotSpot interface:{' '}
        <strong>{router.registration?.hotspot_interface}</strong>.
      </p>
      {status === 'preparing' && (
        <p role="status">
          Preparing the server connection. This page checks for completion automatically.
        </p>
      )}
      {status === 'needs_attention' && (
        <Alert tone="warning" title="Router saved; setup needs attention">
          {ERRORS[router.registration?.error_code ?? ''] ??
            'Review server preparation before retrying.'}
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {status === 'needs_attention' && (
        <Button loading={busy} onClick={() => void run('retry')}>
          Retry preparation
        </Button>
      )}
      {status === 'ready' && !available && (
        <Alert tone="warning">Reactivate the router before accessing its setup script.</Alert>
      )}
      {status === 'ready' && available && (
        <>
          <p>
            The server configuration is prepared. Back up the intended MikroTik router, review this
            script, then upload the .rsc file in WinBox Files and run its import command. Keep
            management access available during import.
          </p>
          {!script && (
            <Button loading={busy} onClick={() => void run('show')}>
              View setup script
            </Button>
          )}
          {script && (
            <>
              <p className="text-sm">
                This script contains router credentials. Store it privately.
              </p>
              <textarea
                aria-label="Router setup script"
                readOnly
                value={script.script}
                className="h-72 w-full rounded border p-3 font-mono text-xs"
              />
              <div className="flex gap-3">
                <Button onClick={download}>Download .rsc</Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(script.script)
                      .then(() => setCopied(true))
                      .catch(() =>
                        setError('Clipboard unavailable. Select the script or download the file.'),
                      );
                  }}
                >
                  {copied ? 'Copied' : 'Copy script'}
                </Button>
              </div>
              <pre className="bg-surface-100 overflow-auto rounded p-3">
                {script.import_command}
              </pre>
            </>
          )}
          <p className="text-sm">
            After import, verify the VPN, voucher authentication and accounting. Script download
            does not mark the router online.
          </p>
        </>
      )}
    </Card>
  );
}
