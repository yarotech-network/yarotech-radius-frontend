import { useQuery } from '@tanstack/react-query';
import { Mail, MonitorSmartphone, Phone, UserRound } from 'lucide-react';
import { Avatar, Badge, CopyButton, DescriptionList } from '@/components/ui';
import type { BadgeTone } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/layout/StatusBadge';
import { ErrorState } from '@/components/feedback';
import { formatBytes, formatNumber } from '@/lib/formatting/units';
import { formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { deviceUsageApi } from './deviceUsageApi';
import {
  CONNECTION,
  SOURCE_LABELS,
  expiryText,
  initials,
  label,
  type Access,
} from './customerAccess';

export function ConnectionBadge({ value }: { value: string }) {
  const known = CONNECTION[value] ?? { tone: 'neutral' as const, text: label(value) };
  return (
    <Badge tone={known.tone} size="sm" dot={value === 'online'}>
      {known.text}
    </Badge>
  );
}

/** Avatar with the buyer's initials, or a neutral person icon when there is nothing to show. */
export function CustomerAvatar({ access, size }: { access: Access; size?: 'sm' | 'md' | 'lg' }) {
  const text = initials(access);
  if (text) return <Avatar initials={text} {...(size ? { size } : {})} />;
  return (
    <span
      aria-hidden
      className={
        size === 'lg'
          ? 'inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-400'
          : 'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-400'
      }
    >
      <UserRound className={size === 'lg' ? 'size-5' : 'size-4'} />
    </span>
  );
}

export function AccessDetails({ access }: { access: Access }) {
  const stats = [
    { label: 'Data used', value: formatBytes(access.bytes_total) },
    { label: 'Devices', value: formatNumber(access.devices) },
    { label: 'Sessions', value: formatNumber(access.sessions) },
  ];
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <CustomerAvatar access={access} size="lg" />
        <div className="min-w-0 flex-1">
          <p
            className={
              access.buyer_name
                ? 'text-base font-semibold text-ink-900'
                : 'text-base text-ink-500 italic'
            }
          >
            {access.buyer_name || 'Name not provided'}
          </p>
          <div className="mt-1 flex flex-col gap-0.5 text-sm">
            {access.buyer_email && (
              <a
                href={`mailto:${access.buyer_email}`}
                className="inline-flex min-w-0 items-center gap-1.5 text-ink-600 hover:text-brand-700"
              >
                <Mail aria-hidden className="size-3.5 shrink-0" />
                <span className="break-all">{access.buyer_email}</span>
              </a>
            )}
            {access.buyer_phone && (
              <a
                href={`tel:${access.buyer_phone}`}
                className="inline-flex items-center gap-1.5 text-ink-600 hover:text-brand-700"
              >
                <Phone aria-hidden className="size-3.5 shrink-0" />
                {access.buyer_phone}
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface-muted p-4">
        <p className="text-xs font-medium text-ink-500">Access code</p>
        {access.access_code ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <code className="font-mono text-2xl font-bold tracking-widest break-all text-ink-900">
              {access.access_code}
            </code>
            <CopyButton value={access.access_code} label="Copy code" variant="secondary" />
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-500">Hidden</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusBadge status={access.status} size="sm" />
          <ConnectionBadge value={access.connection} />
          <span className="text-xs text-ink-500">{expiryText(access)}</span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-control border border-border px-3 py-2">
            <dt className="text-xs text-ink-500">{stat.label}</dt>
            <dd className="mt-0.5 truncate text-sm font-semibold text-ink-900 tabular-nums">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <DescriptionList
        items={[
          { label: 'Plan', value: access.plan },
          { label: 'Source', value: SOURCE_LABELS[access.source] ?? label(access.source) },
          { label: 'Purchased', value: formatDateTime(access.date) },
          {
            label: 'Reference',
            value: (
              <span className="inline-flex items-center gap-1">
                <code className="font-mono text-[13px] break-all">{access.reference}</code>
                <CopyButton value={access.reference} label="Copy reference" size="icon" />
              </span>
            ),
          },
          {
            label: 'Expires',
            value: access.expires_at
              ? formatDateTime(access.expires_at)
              : 'Not activated / no deadline recorded',
          },
          {
            label: 'Last seen',
            value: access.last_seen ? formatDateTime(access.last_seen) : 'No recorded session',
          },
        ]}
      />
      <CodeDevices voucherId={access.id} />
    </div>
  );
}

const DEVICE_STATUS: Record<string, { tone: BadgeTone; text: string }> = {
  online: { tone: 'success', text: 'Online' },
  offline: { tone: 'neutral', text: 'Offline' },
  unknown: { tone: 'neutral', text: 'Unknown' },
};

/** Devices (by MAC address) that have used this access code, from RADIUS accounting. */
function CodeDevices({ voucherId }: { voucherId: number }) {
  const devices = useQuery({
    queryKey: ['customer-access-devices', voucherId],
    queryFn: () => deviceUsageApi.list({ voucher: voucherId, page_size: 20 }),
    gcTime: 0,
  });
  return (
    <section aria-label="Devices on this code" className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
        <MonitorSmartphone aria-hidden className="size-4 text-ink-500" />
        Devices on this code
      </h3>
      {devices.isPending ? (
        <p role="status" className="text-sm text-ink-500">
          Loading devices...
        </p>
      ) : devices.isError ? (
        <ErrorState
          error={devices.error}
          title="Devices could not be loaded"
          onRetry={() => void devices.refetch()}
        />
      ) : devices.data.results.length === 0 ? (
        <p className="rounded-control bg-surface-muted px-3 py-2.5 text-sm text-ink-500">
          No device has a recorded session with this code yet.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-card border border-border">
          {devices.data.results.map((device) => {
            const status = DEVICE_STATUS[device.status] ?? DEVICE_STATUS.unknown!;
            return (
              <li
                key={device.mac_address}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <code className="font-mono text-sm text-ink-900">{device.mac_address}</code>
                  <p className="text-xs text-ink-500">
                    Last seen {formatRelative(device.last_seen)} · {formatNumber(device.sessions)}{' '}
                    {device.sessions === 1 ? 'session' : 'sessions'} ·{' '}
                    {formatBytes(device.bytes_total)}
                  </p>
                </div>
                <Badge tone={status.tone} size="sm" dot={device.status === 'online'}>
                  {status.text}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
      {devices.data && devices.data.count > devices.data.results.length && (
        <p className="text-xs text-ink-500">
          Showing {devices.data.results.length} of {formatNumber(devices.data.count)} devices.
        </p>
      )}
    </section>
  );
}
