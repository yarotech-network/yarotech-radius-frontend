import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpRight } from 'lucide-react';
import { Card, CardHeader, SegmentedControl } from '@/components/ui';
import { StatusBadge } from '@/components/layout/StatusBadge';
import { compactKobo, Legend, LineChart, ShareBar, Sparkline } from '@/components/charts';
import { formatKobo } from '@/lib/formatting/money';
import { formatBytes, formatNumber } from '@/lib/formatting/units';
import { formatRelative } from '@/lib/formatting/dates';
import { cn } from '@/lib/utilities/cn';
import type { DashboardStats, NetworkSummary } from '@/types/api';
import type { TenantReport } from '@/features/reports/api';
import { periodLabel, periodState } from '@/features/reports/reportMath';
import { routerStatusParts, wholeNaira } from './hubData';

function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="dashboard-data-link inline-flex items-center gap-1 text-sm font-semibold whitespace-nowrap"
    >
      {children}
      <ArrowRight aria-hidden className="size-3.5" />
    </Link>
  );
}

/**
 * Compact KPI tile. The corner arrow is the real link (it carries the accessible name);
 * its ::after overlay stretches over the card so the whole tile is clickable.
 */
export function HubTile({
  label,
  value,
  detail,
  trend,
  live,
  extra,
  to,
  link,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  trend?: number[] | undefined;
  live?: boolean | undefined;
  extra?: ReactNode;
  to: string;
  link: string;
  loading?: boolean | undefined;
}) {
  return (
    <Card
      padded={false}
      className="group relative flex min-w-0 flex-col gap-1.5 p-3 transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-subtle has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-brand-600 sm:p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-500">
          {live && (
            <span aria-hidden className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success-600 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-success-600" />
            </span>
          )}
          <span className="line-clamp-2 sm:truncate">{label}</span>
        </p>
        <Link
          to={to}
          aria-label={link}
          title={link}
          className="shrink-0 text-ink-400 transition-colors group-hover:text-brand-600 after:absolute after:inset-0 after:rounded-card focus-visible:outline-none"
        >
          <ArrowUpRight aria-hidden className="size-4" />
        </Link>
      </div>
      <div className="flex items-center justify-between gap-3">
        {loading ? (
          <span className="h-7 w-24 animate-pulse rounded-md bg-fill-strong" />
        ) : (
          <p className="min-w-0 truncate text-lg font-semibold tracking-tight text-ink-900 sm:text-xl">
            {value}
          </p>
        )}
        {trend && <Sparkline values={trend} className="hidden sm:block" />}
      </div>
      {extra}
      <p className="line-clamp-2 text-xs text-ink-500 sm:truncate" title={detail}>
        {detail}
      </p>
    </Card>
  );
}

/** A labelled group of tiles; renders nothing when the viewer may see none of them. */
export function TileGroup({ label, children }: { label: string; children: ReactNode[] }) {
  if (children.length === 0) return null;
  return (
    <section aria-label={label} className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</h2>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{children}</div>
    </section>
  );
}

/** A thin stacked status bar for small tiles (no legend; the detail line names the parts). */
export function MiniBar({ parts }: { parts: { value: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <div aria-hidden className="flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-fill">
      {total > 0 &&
        parts
          .filter((part) => part.value > 0)
          .map((part, index) => (
            <span
              key={index}
              className="block h-full"
              style={{ width: `${(part.value / total) * 100}%`, background: part.color }}
            />
          ))}
    </div>
  );
}

/** Holds a section's final size while its data loads, so the grid never reflows. */
function Placeholder({
  failed,
  message,
  height,
}: {
  failed: boolean;
  message: string;
  height: number;
}) {
  return failed ? (
    <p
      className="flex items-center justify-center rounded-control bg-surface-muted px-4 text-center text-sm text-ink-500"
      style={{ height }}
    >
      {message}
    </p>
  ) : (
    <div aria-hidden className="animate-pulse rounded-control bg-fill" style={{ height }} />
  );
}

export function RevenueTrend({
  report,
  failed,
}: {
  report: TenantReport | undefined;
  failed: boolean;
}) {
  const rows = report?.rows ?? [];
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Revenue, last 30 days"
        description="Activated voucher value and recorded collections per day."
        actions={<SectionLink to="/reports">Open reports</SectionLink>}
      />
      {!report ? (
        <Placeholder failed={failed} height={252} message="The 30-day trend could not be loaded." />
      ) : (
        <>
          <LineChart
            ariaLabel="Activated value and collections, last 30 days"
            labels={rows.map((row) => periodLabel(row.start, 'day'))}
            titles={rows.map(
              (row) => `${periodLabel(row.start, 'day', true)} · ${periodState(row)}`,
            )}
            provisional={rows.map((row) => !row.complete)}
            height={220}
            series={[
              {
                key: 'activated',
                label: 'Activated value',
                color: 'var(--viz-1)',
                values: rows.map((row) => row.activated_value),
              },
              {
                key: 'collections',
                label: 'Collections',
                color: 'var(--viz-2)',
                values: rows.map((row) => row.collections),
              },
            ]}
            format={(value) => formatKobo(value)}
            axisFormat={compactKobo}
          />
          <div className="mt-3">
            <Legend
              shape="line"
              items={[
                { label: 'Activated value', color: 'var(--viz-1)' },
                { label: 'Collections', color: 'var(--viz-2)' },
              ]}
              note="Hollow end dot: today is still in progress"
            />
          </div>
        </>
      )}
    </Card>
  );
}

type Window = 'today' | 'month' | 'total';
const WINDOWS: { value: Window; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'month', label: 'Month' },
  { value: 'total', label: 'All time' },
];
const CHANNEL_LABELS = [
  { key: 'storefront', label: 'Storefront' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'generated', label: 'Generated & agents' },
] as const;

export function RevenueByChannel({
  revenue,
  failed,
}: {
  revenue: DashboardStats['activated_voucher_revenue'];
  failed: boolean;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Revenue by channel"
        description="Activated voucher value by where the voucher came from."
      />
      {revenue ? (
        <ChannelBreakdown revenue={revenue} />
      ) : (
        <Placeholder failed={failed} height={220} message="Channel figures could not be loaded." />
      )}
    </Card>
  );
}

function ChannelBreakdown({
  revenue,
}: {
  revenue: NonNullable<DashboardStats['activated_voucher_revenue']>;
}) {
  const [window, setWindow] = useState<Window>('today');
  const total = revenue.totals[window];
  return (
    <>
      <SegmentedControl
        ariaLabel="Revenue window"
        size="sm"
        options={WINDOWS}
        value={window}
        onChange={setWindow}
      />
      <p className="mt-4 text-2xl font-semibold tracking-tight text-ink-900">
        {wholeNaira(total.amount)}
      </p>
      <p className="mb-4 text-xs text-ink-500">
        {formatNumber(total.vouchers)} {total.vouchers === 1 ? 'voucher' : 'vouchers'} activated
      </p>
      {total.amount > 0 ? (
        <ShareBar
          ariaLabel="Share of activated value by channel"
          format={(value) => formatKobo(value)}
          parts={CHANNEL_LABELS.map((channel, index) => ({
            label: channel.label,
            value: revenue.channels[channel.key][window].amount,
            color: `var(--viz-${index + 1})`,
          }))}
        />
      ) : (
        <p className="rounded-control bg-surface-muted px-4 py-6 text-center text-sm text-ink-500">
          No vouchers were activated in this window yet.
        </p>
      )}
      {revenue.incomplete_vouchers > 0 && (
        <p className="mt-3 text-xs text-warning-700">
          {formatNumber(revenue.incomplete_vouchers)} activated vouchers have no recorded price and
          are not counted.
        </p>
      )}
    </>
  );
}

export function RouterHealth({ network }: { network: NetworkSummary }) {
  const busiest = [...network.routers].sort((a, b) => b.online_users - a.online_users).slice(0, 5);
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Router health"
        description="Unknown means no recent evidence, not that the router is down."
        actions={<SectionLink to="/routers">View routers</SectionLink>}
      />
      <ShareBar
        ariaLabel="Routers by status"
        format={formatNumber}
        parts={routerStatusParts(network).filter((part) => part.value > 0)}
      />
      {busiest.length > 0 && (
        <>
          <h3 className="mt-5 mb-2 text-xs font-medium text-ink-500">Busiest routers</h3>
          <ul className="divide-y divide-border">
            {busiest.map((router) => (
              <li key={router.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-ink-900">
                  {router.name}
                </span>
                <span className="text-xs text-ink-500 tabular">
                  {formatNumber(router.online_users)} online
                </span>
                <StatusBadge status={router.status} size="sm" />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function rate(bytesPerSecond: number | null) {
  return bytesPerSecond === null ? 'Not sampled' : `${formatBytes(bytesPerSecond)}/s`;
}

function Figure({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="rounded-control bg-surface-muted px-3 py-2.5">
      <dt className="flex items-center gap-1 text-xs text-ink-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 text-base font-semibold text-ink-900 tabular">{value}</dd>
    </div>
  );
}

export function LiveNetwork({ network }: { network: NetworkSummary }) {
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Live network"
        description={`From RADIUS accounting, observed ${formatRelative(network.observed_at)}.`}
        actions={<SectionLink to="/sessions">View live sessions</SectionLink>}
      />
      <dl className="grid grid-cols-2 gap-2">
        <Figure
          label="Download now"
          value={rate(network.download_bytes_per_second)}
          icon={<ArrowDown aria-hidden className="size-3" />}
        />
        <Figure
          label="Upload now"
          value={rate(network.upload_bytes_per_second)}
          icon={<ArrowUp aria-hidden className="size-3" />}
        />
        <Figure label="Downloaded today" value={formatBytes(network.today_download_bytes)} />
        <Figure label="Uploaded today" value={formatBytes(network.today_upload_bytes)} />
        <Figure label="Sessions today" value={formatNumber(network.sessions_today)} />
        <Figure label="Vouchers online" value={formatNumber(network.online_vouchers)} />
      </dl>
      {network.stale_sessions > 0 && (
        <p className="mt-3 text-xs text-warning-700">
          {formatNumber(network.stale_sessions)} sessions have not reported recently and are not
          counted as online.
        </p>
      )}
    </Card>
  );
}

export function VoucherInventory({
  usage,
  issuedToday,
}: {
  usage: Record<string, number>;
  issuedToday: number | undefined;
}) {
  const parts = [
    { label: 'In use', value: usage.active ?? 0, color: 'var(--viz-1)' },
    { label: 'Not yet used', value: usage.not_started ?? 0, color: 'var(--viz-3)' },
    { label: 'Expired', value: usage.expired ?? 0, color: 'var(--viz-2)' },
    { label: 'Disabled', value: usage.disabled ?? 0, color: 'var(--viz-quiet)' },
  ];
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Voucher inventory"
        description={`${formatNumber(usage.total ?? 0)} vouchers in this workspace${issuedToday ? `, ${formatNumber(issuedToday)} issued today` : ''}.`}
        actions={<SectionLink to="/vouchers">View vouchers</SectionLink>}
      />
      <ShareBar ariaLabel="Vouchers by state" format={formatNumber} parts={parts} />
    </Card>
  );
}

export function PaymentsHealth({ stats }: { stats: DashboardStats }) {
  const success = stats.successful_payments ?? 0;
  const failed = stats.failed_payments ?? 0;
  const pending = stats.pending_payments;
  const settled = success + failed;
  const sources = stats.revenue_sources;
  return (
    <Card className="min-w-0">
      <CardHeader
        title="Payments"
        description="All-time customer payment outcomes and where collections came from."
        actions={<SectionLink to="/payments">View payments</SectionLink>}
      />
      <ShareBar
        ariaLabel="Customer payments by outcome"
        format={formatNumber}
        parts={[
          { label: 'Successful', value: success, color: 'var(--color-success-600)' },
          { label: 'Pending', value: pending, color: 'var(--color-warning-600)' },
          { label: 'Failed', value: failed, color: 'var(--color-danger-600)' },
        ]}
      />
      {settled > 0 && (
        <p className="mt-3 text-xs text-ink-500">
          {Math.round((success / settled) * 100)}% of settled payments succeeded.
        </p>
      )}
      {sources && (
        <>
          <h3 className="mt-5 mb-2 text-xs font-medium text-ink-500">Collected, all time</h3>
          <dl className="space-y-1.5 text-sm">
            {[
              ['Online payments', sources.online],
              ['Agent wallet sales', sources.agent_wallet],
              ['Credit repayments', sources.agent_credit_repayments],
            ].map(([label, amount]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-ink-600">{label}</dt>
                <dd className={cn('font-semibold text-ink-900 tabular')}>
                  {formatKobo(amount as number)}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </Card>
  );
}
