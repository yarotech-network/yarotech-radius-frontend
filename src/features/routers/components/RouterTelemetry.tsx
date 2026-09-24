import { StatusBadge } from '@/components/layout';
import { Card } from '@/components/ui';
import type { RouterMonitoring } from '@/types/api/routers';

function fresh(health?: RouterMonitoring) {
  const age = health?.monitor_checked_at
    ? Date.now() - Date.parse(health.monitor_checked_at)
    : Infinity;
  return Boolean(health?.monitoring_fresh && age >= 0 && age <= 150_000);
}

export function RouterConnectionBadge({ health }: { health?: RouterMonitoring | undefined }) {
  const status =
    fresh(health) && health?.online !== null ? (health?.online ? 'online' : 'offline') : 'unknown';
  return <StatusBadge status={status} size="sm" dot />;
}

const mib = (value: number) => `${(value / 1048576).toFixed(1)} MiB`;
export function RouterTelemetry({ health }: { health?: RouterMonitoring | undefined }) {
  const metrics = fresh(health) && health?.telemetry_available ? health.telemetry : null;
  return (
    <Card>
      <h2 className="text-lg font-semibold text-ink-900">Router telemetry</h2>
      <p className="mt-1 text-sm text-ink-500">
        VPN connectivity, RADIUS authentication and accounting are separate checks.
      </p>
      {!metrics ? (
        <p role="status" className="mt-4 text-sm text-ink-600">
          Telemetry unavailable.{' '}
          {health?.telemetry_error === 'credentials_required'
            ? 'Configure RouterOS management credentials.'
            : health?.telemetry_error === 'tls_failed'
              ? 'Configure a trusted RouterOS HTTPS certificate.'
              : health?.telemetry_error === 'authentication_failed'
                ? 'Check RouterOS credentials and read permissions.'
                : 'Check the monitor and management HTTPS connection.'}
        </p>
      ) : (
        <>
          <dl className="my-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-ink-500">CPU load</dt>
              <dd>{metrics.cpu_percent}%</dd>
            </div>
            <div>
              <dt className="text-sm text-ink-500">Memory used / total</dt>
              <dd>
                {mib(metrics.total_memory_bytes - metrics.free_memory_bytes)} /{' '}
                {mib(metrics.total_memory_bytes)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-ink-500">Uptime</dt>
              <dd>{metrics.uptime}</dd>
            </div>
          </dl>
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Router interfaces</caption>
              <thead>
                <tr>
                  {['Interface', 'State', 'Received', 'Sent'].map((label) => (
                    <th key={label} className="p-2 text-ink-500">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.interfaces.map((item) => (
                  <tr key={item.name} className="border-t border-border">
                    <td className="p-2">{item.name}</td>
                    <td className="p-2">
                      {item.disabled ? 'Disabled' : item.running ? 'Running' : 'Down'}
                    </td>
                    <td className="p-2">{mib(item.rx_bytes)}</td>
                    <td className="p-2">{mib(item.tx_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Interface counters are cumulative and can reset when the router restarts.
          </p>
        </>
      )}
    </Card>
  );
}
