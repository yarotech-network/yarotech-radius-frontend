import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  CheckCircle2,
  CircleDashed,
  Download,
  LifeBuoy,
  Loader2,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { Button, CopyButton } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { http } from '@/services/api/http';
import { errorMessage, isApiError } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { formatRelative } from '@/lib/formatting/dates';
import { cn } from '@/lib/utilities/cn';
import type { NasDevice } from '@/types/api';
import { useRouterChecks } from '../../queries';
import { PREPARATION_ERRORS, SETUP_PROBLEMS } from './setupHelp';
import { DeploymentGuide } from '../guide/DeploymentGuide';

type StepState = 'done' | 'current' | 'waiting';

function Step({
  number,
  title,
  state,
  children,
}: {
  number: number;
  title: string;
  state: StepState;
  children: ReactNode;
}) {
  return (
    <li className="relative pb-8 pl-12 last:pb-0">
      <span
        aria-hidden
        className="absolute top-9 bottom-0 left-[1.0625rem] w-px bg-border [li:last-child>&]:hidden"
      />
      <span
        aria-hidden
        className={cn(
          'absolute top-0 left-0 flex size-9 items-center justify-center rounded-full border text-sm font-semibold',
          state === 'done' && 'border-success-600 bg-success-600 text-white',
          state === 'current' && 'border-brand-600 bg-brand-600 text-white',
          state === 'waiting' && 'border-border bg-surface text-ink-500',
        )}
      >
        {state === 'done' ? <CheckCircle2 className="size-5" /> : number}
      </span>
      <h3 className="pt-1.5 text-base font-semibold text-ink-900">
        {title}
        <span className="sr-only">
          {state === 'done' ? ' (done)' : state === 'current' ? ' (current step)' : ' (not yet)'}
        </span>
      </h3>
      <div className="mt-2 space-y-3 text-sm text-ink-700">{children}</div>
    </li>
  );
}

/** The current time, refreshed on an interval, so time-based labels stay correct without impure renders. */
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

const usable = (router: NasDevice) => router.is_active && router.onboarding_state !== 'suspended';

/** Guided Prepare → Install → Verify for routers registered through the Add router form. */
export function RouterSetup({ router, refresh }: { router: NasDevice; refresh: () => void }) {
  const status = router.registration?.status;
  const ready = status === 'ready' && usable(router);
  const checks = useRouterChecks(router.id, { poll: ready ? 15_000 : false });
  const now = useNow(15_000);
  const passed = (type: string) =>
    Boolean(checks.data?.some((check) => check.check_type === type && check.passed));
  const handshake = router.health?.vpn?.last_handshake_at;
  const vpnUp =
    passed('wireguard_peer') ||
    (handshake ? now - new Date(handshake).getTime() < 5 * 60_000 : false);
  const live = router.onboarding_state === 'active' || (vpnUp && passed('radius_auth'));

  useEffect(() => {
    if (status !== 'preparing') return;
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [status, refresh]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">Set up {router.name}</h2>
        <p className="mt-1 text-sm text-ink-600">
          Customer port{' '}
          <strong className="text-ink-900">{router.registration?.hotspot_interface}</strong>. Three
          steps: prepare the router, paste one command, then confirm it works.
        </p>
      </div>
      <ol>
        <Step number={1} title="Prepare the router" state={ready ? 'done' : 'current'}>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Open the router in <strong>WinBox</strong> from a computer connected to a port that is
              not the customer port.
            </li>
            <li>
              Check <strong>System → Resources</strong> shows RouterOS{' '}
              <strong>7.17 or newer</strong> and that the router has internet.
            </li>
            <li>
              Save a backup: <strong>Files → Backup</strong>.
            </li>
          </ul>
          <details className="rounded-control border border-border">
            <summary className="cursor-pointer px-3 py-2.5 font-medium text-ink-700 hover:text-ink-900">
              Step-by-step WinBox guide (default configuration or WAVLINK on ether2)
            </summary>
            <div className="border-t border-border p-3">
              <DeploymentGuide />
            </div>
          </details>
        </Step>
        <Step
          number={2}
          title="Install with one command"
          state={live ? 'done' : ready ? 'current' : 'waiting'}
        >
          <InstallStep router={router} refresh={refresh} />
        </Step>
        <Step
          number={3}
          title="Check it works"
          state={live ? 'done' : ready ? 'current' : 'waiting'}
        >
          <VerifyStep
            router={router}
            items={[
              { label: 'Router connected to Yarotech (VPN)', ok: vpnUp },
              { label: 'Voucher login accepted (RADIUS)', ok: passed('radius_auth') },
              { label: 'Data usage reported (accounting)', ok: passed('radius_acct') },
            ]}
            live={live}
            loading={checks.isPending && ready}
          />
        </Step>
      </ol>
      <Troubleshooting />
    </div>
  );
}

interface InstallCommand {
  command: string;
  expires_at: string;
}

function InstallStep({ router, refresh }: { router: NasDevice; refresh: () => void }) {
  const registration = router.registration;
  const [install, setInstall] = useState<InstallCommand | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState<'command' | 'retry' | 'download' | null>(null);
  const [error, setError] = useState('');
  const now = useNow(30_000);
  const expired = install ? new Date(install.expires_at).getTime() <= now : false;

  async function getCommand() {
    setBusy('command');
    setError('');
    try {
      setInstall(await http.post<InstallCommand>(`/routers/${router.id}/install-command/`, {}));
    } catch (failure) {
      if (isApiError(failure) && failure.code === 'install_url_not_configured')
        setUnavailable(true);
      else setError(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  async function retry() {
    setBusy('retry');
    setError('');
    try {
      await http.post(
        `/routers/${router.id}/setup-script/retry/`,
        {},
        {
          idempotencyKey: newIdempotencyKey('router-setup'),
        },
      );
      setInstall(null);
      refresh();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  /** Saves the .rsc file; the script itself (it holds router credentials) is never shown. */
  async function download() {
    setBusy('download');
    setError('');
    try {
      const file = await http.get<{ filename: string; script: string }>(
        `/routers/${router.id}/setup-script/`,
      );
      const url = URL.createObjectURL(
        new Blob([file.script], { type: 'text/plain;charset=utf-8' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(null);
    }
  }

  if (!registration) return null;
  if (registration.status === 'preparing')
    return (
      <p role="status" className="flex items-center gap-2 text-ink-600">
        <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
        Yarotech is preparing the VPN for this router. This usually takes under a minute.
      </p>
    );
  if (registration.status === 'needs_attention')
    return (
      <>
        <Alert tone="warning" title="Router saved — preparation needs attention">
          {PREPARATION_ERRORS[registration.error_code] ??
            'Server preparation stopped. Retry, or contact support if it keeps failing.'}
        </Alert>
        {error && <Alert tone="danger">{error}</Alert>}
        <Button loading={busy === 'retry'} leadingIcon={<RefreshCw />} onClick={() => void retry()}>
          Retry preparation
        </Button>
      </>
    );
  if (!usable(router)) return <Alert tone="warning">Reactivate this router to install it.</Alert>;

  const importCommand = `/import file-name="yarotech-${router.id}.rsc"`;
  return (
    <>
      {error && <Alert tone="danger">{error}</Alert>}
      {unavailable ? (
        <Alert tone="info" title="One-command install isn’t enabled on this server">
          Use the download option below instead.
        </Alert>
      ) : install && !expired ? (
        <div className="space-y-2">
          <p>
            In WinBox open <strong>New Terminal</strong>, paste this command and press{' '}
            <strong>Enter</strong>. It takes about a minute; wait for{' '}
            <em>“Yarotech setup finished”</em>.
          </p>
          <div className="rounded-control border border-[#1e293b] bg-[#0b1220] p-3">
            <code
              aria-label="Install command"
              className="block font-mono text-xs leading-relaxed break-all text-[#e2e8f0]"
            >
              {install.command}
            </code>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyButton value={install.command} label="Copy command" variant="primary" size="md" />
            <span className="text-xs text-ink-500">
              Works once · expires {formatRelative(install.expires_at)}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {expired && (
            <p className="text-ink-600">
              That command has expired. Get a new one when you’re ready.
            </p>
          )}
          <Button
            loading={busy === 'command'}
            leadingIcon={<Terminal />}
            onClick={() => void getCommand()}
          >
            {expired ? 'Get a new install command' : 'Get install command'}
          </Button>
          <p className="text-xs text-ink-500">
            The command works once and expires after an hour. It contains no passwords.
          </p>
        </div>
      )}

      <details className="rounded-control border border-border" open={unavailable || undefined}>
        <summary className="cursor-pointer px-3 py-2.5 font-medium text-ink-700 hover:text-ink-900">
          Install from a file instead
        </summary>
        <div className="space-y-3 border-t border-border p-3">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Download the setup file. Keep it private — it holds this router’s keys.</li>
            <li>
              In WinBox open <strong>Files</strong> and drag the file in.
            </li>
            <li>
              In <strong>New Terminal</strong> run:{' '}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-xs break-all">
                {importCommand}
              </code>{' '}
              <CopyButton value={importCommand} label="Copy import command" size="icon" />
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              loading={busy === 'download'}
              leadingIcon={<Download />}
              onClick={() => void download()}
            >
              Download setup file
            </Button>
            <Button variant="ghost" loading={busy === 'retry'} onClick={() => void retry()}>
              Regenerate setup file
            </Button>
          </div>
        </div>
      </details>
    </>
  );
}

function VerifyStep({
  router,
  items,
  live,
  loading,
}: {
  router: NasDevice;
  items: { label: string; ok: boolean }[];
  live: boolean;
  loading: boolean;
}) {
  return (
    <>
      {live ? (
        <Alert tone="success" title="Router is live">
          Customers on {router.registration?.hotspot_interface} can now log in with your vouchers.
        </Alert>
      ) : (
        <p>
          Connect a phone to the customer Wi-Fi, open any website and log in with a test voucher.
          This page checks every 15 seconds.
        </p>
      )}
      <ul aria-label="Setup checks" className="space-y-2" aria-busy={loading}>
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2">
            {item.ok ? (
              <CheckCircle2 aria-hidden className="size-4.5 shrink-0 text-success-600" />
            ) : (
              <CircleDashed aria-hidden className="size-4.5 shrink-0 text-ink-300" />
            )}
            <span className={item.ok ? 'text-ink-900' : 'text-ink-600'}>{item.label}</span>
            <span className="sr-only">{item.ok ? 'passed' : 'not yet'}</span>
          </li>
        ))}
      </ul>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Link className="dashboard-data-link font-medium" to="?tab=test">
          Run a RADIUS test
        </Link>
        <Link className="dashboard-data-link font-medium" to="?tab=onboarding">
          See all checks
        </Link>
      </p>
    </>
  );
}

function Troubleshooting() {
  return (
    <section aria-labelledby="setup-help" className="rounded-card border border-border">
      <h3
        id="setup-help"
        className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-ink-900"
      >
        <LifeBuoy aria-hidden className="size-4 text-ink-500" />
        If the terminal shows an error
      </h3>
      <p className="px-4 pt-3 text-xs text-ink-500">
        The command stops before changing anything it isn’t sure about. Find the code at the start
        of the error (for example <code className="font-mono">YT-LAN-02</code>), fix it, then run a
        new command.
      </p>
      <ul className="divide-y divide-border">
        {SETUP_PROBLEMS.map((problem) => (
          <li key={problem.code}>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 text-sm hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                <code className="w-[5.5rem] shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-center font-mono text-xs text-ink-700 group-open:bg-brand-50 group-open:text-brand-800">
                  {problem.code}
                </code>
                <span className="text-ink-900">{problem.title}</span>
              </summary>
              <p className="px-4 pb-3 pl-[7.25rem] text-sm text-ink-600">{problem.fix}</p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
