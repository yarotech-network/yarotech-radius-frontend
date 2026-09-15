import { Link } from 'react-router';
import { Section } from '@/components/layout';
import { Button, Card, Stat } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { formatBytes, formatNumber } from '@/lib/formatting/units';
import { formatRelative } from '@/lib/formatting/dates';
import { useNetworkSummary } from '../queries';

export function NetworkCards({ live = true }: { live?: boolean }) {
  const principal = usePrincipal();
  const query = useNetworkSummary(live);
  if (!can(principal, 'sessions.view')) return null;
  const s = query.data;
  return (
    <Section
      title="Live HotSpot users"
      description="Workspace-wide voucher sessions from recent RADIUS accounting; independent of list filters."
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-500">
          {s
            ? `Observed ${formatRelative(s.observed_at)} · ${s.freshness_seconds / 60}-minute freshness window`
            : 'Waiting for accounting observations'}
        </p>
        <Button
          size="sm"
          variant="secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh network figures
        </Button>
      </div>
      {query.isError && (
        <Alert tone="warning" title="Network figures unavailable">
          {s
            ? 'Showing the last successful observation.'
            : 'Unavailable data does not mean zero users or traffic.'}
        </Alert>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            ['Online HotSpot users', s?.online_users],
            ['Online vouchers', s?.online_vouchers],
            ['Sessions today', s?.sessions_today],
            ['Stale open sessions', s?.stale_sessions],
          ] as const
        ).map(([label, value]) => (
          <Stat
            key={label}
            label={label}
            value={value == null ? '—' : formatNumber(value)}
            loading={query.isPending}
          />
        ))}
        {(
          [
            ['Current download speed', s?.download_bytes_per_second],
            ['Current upload speed', s?.upload_bytes_per_second],
          ] as const
        ).map(([label, value]) => (
          <Stat
            key={label}
            label={label}
            value={value == null ? 'Unavailable' : `${formatBytes(value)}/s`}
            hint={
              s
                ? `Measured for ${s.rate_sampled_sessions} of ${s.online_users} fresh sessions`
                : 'Waiting for paired accounting updates'
            }
            loading={query.isPending}
          />
        ))}
        {(
          [
            ['Current live traffic', s?.live_traffic_bytes],
            ["Today's session traffic", s?.today_traffic_bytes],
            ["Today's session upload", s?.today_upload_bytes],
            ["Today's session download", s?.today_download_bytes],
            ['All-time traffic', s?.all_time_traffic_bytes],
          ] as const
        ).map(([label, value]) => (
          <Stat
            key={label}
            label={label}
            value={value == null ? '—' : formatBytes(value)}
            loading={query.isPending}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-ink-500">
        Today's traffic uses cumulative counters for sessions started or updated today, including
        data from before midnight on long sessions. Speeds need two accounting updates; newly
        connected sessions need a baseline.
      </p>
      <p className="mt-1 text-xs text-ink-500">
        Last accounting update:{' '}
        {s?.latest_accounting_at ? formatRelative(s.latest_accounting_at) : 'Not observed'}.
      </p>
      <Card className="mt-4">
        <h3 className="mb-3 font-semibold">Router health and online users per router</h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {(
            [
              ['Online routers', 'online'],
              ['Confirmed offline routers', 'offline'],
              ['Status unavailable', 'unknown'],
              ['Awaiting router import', 'awaiting_import'],
              ['Inactive routers', 'inactive'],
            ] as const
          ).map(([label, key]) => (
            <Stat
              key={key}
              label={label}
              value={s ? formatNumber(s.router_counts[key]) : '—'}
              loading={query.isPending}
            />
          ))}
        </div>
        <p className="my-3 text-xs text-ink-500">
          Missing or old observations are not proof a router is offline. Configuration status is
          separate from connectivity.
        </p>
        {s?.routers.length === 0 && (
          <p className="text-sm text-ink-500">No routers registered yet.</p>
        )}
        <ul className="divide-y divide-border">
          {s?.routers.map((router) => (
            <li key={router.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              {can(principal, 'routers.view') ? (
                <Link className="font-semibold text-brand-700" to={`/routers/${router.id}`}>
                  {router.name}
                </Link>
              ) : (
                <span>{router.name}</span>
              )}
              <span>
                {router.online_users} online · {router.status.replaceAll('_', ' ')}
              </span>
            </li>
          ))}
        </ul>
        {s && s.routers_total > s.routers.length && (
          <p className="mt-2 text-xs">
            Showing {s.routers.length} of {s.routers_total} routers.
          </p>
        )}
        {can(principal, 'routers.view') && (
          <Link className="mt-3 inline-block text-sm font-semibold text-brand-700" to="/routers">
            View all routers
          </Link>
        )}
      </Card>
    </Section>
  );
}
