import { useState, type FormEvent, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { Download, Minus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { Alert } from '@/components/feedback';
import { Button, Card, CardHeader, SegmentedControl, Skeleton } from '@/components/ui';
import { formatKobo } from '@/lib/formatting/money';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatNumber } from '@/lib/formatting/units';
import { downloadBlob } from '@/lib/utilities/download';
import { cn } from '@/lib/utilities/cn';
import {
  fetchReport,
  type GroupBy,
  type Period,
  type ReportParams,
  type TenantReport,
} from './api';
import {
  BarChart,
  compactKobo,
  compactNumber,
  Legend,
  LineChart,
  ShareBar,
  Sparkline,
} from '@/components/charts';
import {
  CHANNELS,
  peakPeriod,
  percentChange,
  periodLabel,
  periodState,
  previousRange,
  reportCsv,
  weekdayPattern,
} from './reportMath';

const periods: { value: Period; label: string }[] = [
  { value: 'last_7_days', label: '7 days' },
  { value: 'last_30_days', label: '30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];
const grains: { value: GroupBy; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];
const GRAIN_NOUN: Record<GroupBy, string> = { day: 'day', week: 'week', month: 'month' };
const CHANNEL_COLORS = ['var(--viz-1)', 'var(--viz-2)', 'var(--viz-3)'];

function readParams(search: URLSearchParams): ReportParams {
  const rawPeriod = search.get('period');
  const rawGrain = search.get('group_by');
  const period = periods.find((item) => item.value === rawPeriod)?.value ?? 'last_30_days';
  const group_by = grains.find((item) => item.value === rawGrain)?.value ?? 'day';
  return period === 'custom'
    ? { period, group_by, from: search.get('from') ?? '', to: search.get('to') ?? '' }
    : { period, group_by };
}

function toSearch(params: ReportParams): Record<string, string> {
  return params.period === 'custom'
    ? {
        period: params.period,
        group_by: params.group_by,
        from: params.from ?? '',
        to: params.to ?? '',
      }
    : { period: params.period, group_by: params.group_by };
}

function ReportFilters({
  params,
  onApply,
  defaultRange,
}: {
  params: ReportParams;
  onApply: (params: ReportParams) => void;
  defaultRange?: { from: string; to: string } | undefined;
}) {
  const [customOpen, setCustomOpen] = useState(params.period === 'custom');
  const [from, setFrom] = useState(params.from || defaultRange?.from || '');
  const [to, setTo] = useState(params.to || defaultRange?.to || '');
  const [formError, setFormError] = useState('');
  const showingCustom = customOpen || params.period === 'custom';

  function choosePeriod(period: Period) {
    setFormError('');
    if (period === 'custom') {
      setCustomOpen(true);
      return;
    }
    setCustomOpen(false);
    onApply({ period, group_by: params.group_by });
  }

  function applyCustom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!from || !to || from > to) {
      setFormError('Choose a valid start and end date.');
      return;
    }
    setFormError('');
    onApply({ period: 'custom', group_by: params.group_by, from, to });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-500">Period</span>
          <SegmentedControl
            ariaLabel="Period"
            options={periods}
            value={showingCustom ? 'custom' : params.period}
            onChange={choosePeriod}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-500">Group by</span>
          <SegmentedControl
            ariaLabel="Group by"
            options={grains}
            value={params.group_by}
            onChange={(group_by) => onApply({ ...params, group_by })}
          />
        </div>
      </div>
      {showingCustom && (
        <form
          onSubmit={applyCustom}
          aria-label="Custom date range"
          className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface-muted p-3"
        >
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
            From
            <input
              required
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="h-9 rounded-control border border-border bg-surface px-3 text-sm text-ink-900"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-ink-600">
            To
            <input
              required
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="h-9 rounded-control border border-border bg-surface px-3 text-sm text-ink-900"
            />
          </label>
          <Button type="submit" size="sm" className="h-9">
            Apply
          </Button>
          <p className="basis-full text-xs text-ink-500">Custom ranges can span up to 12 months.</p>
          {formError && (
            <p role="alert" className="basis-full text-sm text-danger-700">
              {formError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

/** Headline figures round to whole naira; exact kobo values live in tooltips and the figures table. */
function wholeNaira(kobo: number) {
  return formatKobo(Math.round(kobo / 100) * 100, { compact: true });
}

function Delta({ change, comparison }: { change: number | null; comparison: string }) {
  if (change === null) {
    return <p className="text-xs text-ink-500">No earlier figures to compare</p>;
  }
  const flat = Math.abs(change) < 0.5;
  const Icon = flat ? Minus : change > 0 ? TrendingUp : TrendingDown;
  const size = Math.abs(change);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-1 font-semibold',
          flat ? 'text-ink-600' : change > 0 ? 'text-success-700' : 'text-danger-700',
        )}
      >
        <Icon aria-hidden className="size-3.5" />
        {flat ? 'No change' : `${change > 0 ? 'Up' : 'Down'} ${size.toFixed(size < 10 ? 1 : 0)}%`}
      </span>
      <span className="text-ink-500">{comparison}</span>
    </p>
  );
}

function KpiTile({
  label,
  value,
  footer,
  trend,
}: {
  label: string;
  value: ReactNode;
  footer: ReactNode;
  trend?: number[] | undefined;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-card border border-border bg-surface p-4">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <div className="flex items-end justify-between gap-3">
        <p className="min-w-0 text-2xl font-semibold tracking-tight whitespace-nowrap text-ink-900">
          {value}
        </p>
        {trend && <Sparkline values={trend} className="mb-1" />}
      </div>
      {footer}
    </div>
  );
}

function KpiRow({
  report,
  previous,
  grain,
}: {
  report: TenantReport;
  previous: TenantReport | undefined;
  grain: GroupBy;
}) {
  const days = previousRange(report.from_date, report.to_date).days;
  const comparison = `vs previous ${days} ${days === 1 ? 'day' : 'days'}`;
  const noun = GRAIN_NOUN[grain];
  const peak = peakPeriod(report.rows, 'activated_value');
  const usage = report.rows.map((row) => row.active_vouchers ?? 0);
  const activeAverage = report.averages.active_vouchers;
  return (
    <section aria-label="Report summaries" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiTile
        label="Activated voucher value"
        value={wholeNaira(report.totals.activated_value)}
        trend={report.rows.map((row) => row.activated_value)}
        footer={
          <Delta
            change={percentChange(report.totals.activated_value, previous?.totals.activated_value)}
            comparison={comparison}
          />
        }
      />
      <KpiTile
        label="Recorded collections"
        value={wholeNaira(report.totals.collections)}
        trend={report.rows.map((row) => row.collections)}
        footer={
          <Delta
            change={percentChange(report.totals.collections, previous?.totals.collections)}
            comparison={comparison}
          />
        }
      />
      <KpiTile
        label="Average active vouchers"
        value={
          !report.accounting_available
            ? 'Unavailable'
            : activeAverage === null
              ? 'Insufficient completed periods'
              : formatNumber(activeAverage)
        }
        trend={report.accounting_available ? usage : undefined}
        footer={
          report.accounting_available && activeAverage !== null ? (
            <Delta
              change={percentChange(activeAverage, previous?.averages.active_vouchers)}
              comparison={`per completed ${noun}, ${comparison}`}
            />
          ) : (
            <p className="text-xs text-ink-500">Distinct vouchers per completed {noun}</p>
          )
        }
      />
      <KpiTile
        label={`Best ${noun}`}
        value={peak ? wholeNaira(peak.activated_value) : 'No activity yet'}
        footer={
          <p className="text-xs text-ink-500">
            {peak
              ? `${periodLabel(peak.start, grain, true)} · activated value`
              : 'No activated value in this range'}
          </p>
        }
      />
    </section>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <p role="status" className="sr-only">
        Loading report…
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-card" />
    </div>
  );
}

function FiguresTable({ report, grain }: { report: TenantReport; grain: GroupBy }) {
  const hasChannels = report.rows.some((row) => row.collections_by_channel);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] text-sm">
        <caption className="sr-only">Report figures by period</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs text-ink-500">
            <th className="py-2 pr-4 font-medium">Period</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 text-right font-medium">Activated value</th>
            <th className="py-2 pr-4 text-right font-medium">Collections</th>
            {hasChannels &&
              CHANNELS.map((channel) => (
                <th key={channel.key} className="py-2 pr-4 text-right font-medium">
                  {channel.label}
                </th>
              ))}
            <th className="py-2 text-right font-medium">Active vouchers</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.start} className="border-b border-border last:border-0">
              <td className="py-2 pr-4 whitespace-nowrap text-ink-900">
                {periodLabel(row.start, grain, true)}
              </td>
              <td className="py-2 pr-4 text-ink-500">{periodState(row)}</td>
              <td className="py-2 pr-4 text-right tabular">{formatKobo(row.activated_value)}</td>
              <td className="py-2 pr-4 text-right tabular">{formatKobo(row.collections)}</td>
              {hasChannels &&
                CHANNELS.map((channel) => (
                  <td key={channel.key} className="py-2 pr-4 text-right text-ink-600 tabular">
                    {row.collections_by_channel
                      ? formatKobo(row.collections_by_channel[channel.key])
                      : '—'}
                  </td>
                ))}
              <td className="py-2 text-right tabular">
                {row.active_vouchers === null ? 'Unavailable' : formatNumber(row.active_vouchers)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReportBody({
  report,
  previous,
  grain,
}: {
  report: TenantReport;
  previous: TenantReport | undefined;
  grain: GroupBy;
}) {
  const [showFigures, setShowFigures] = useState(false);
  const rows = report.rows;
  const labels = rows.map((row) => periodLabel(row.start, grain));
  const titles = rows.map((row) => `${periodLabel(row.start, grain, true)} · ${periodState(row)}`);
  const provisional = rows.map((row) => !row.complete);
  const anyProvisional = provisional.some(Boolean);
  const channelTotals = report.totals.collections_by_channel;
  const channelRows = rows.every((row) => row.collections_by_channel);
  const weekdays = grain === 'day' ? weekdayPattern(rows) : null;
  const nothingRecorded =
    report.totals.activated_value === 0 &&
    report.totals.collections === 0 &&
    rows.every((row) => !row.active_vouchers);

  if (rows.length === 0) return <Card>No data for this range.</Card>;

  return (
    <div className="space-y-4">
      <KpiRow report={report} previous={previous} grain={grain} />

      {!report.accounting_available && (
        <Alert tone="warning" title="Usage accounting unavailable">
          Active-voucher figures cannot be confirmed. Revenue figures remain available.
        </Alert>
      )}
      {nothingRecorded && <Card>No recorded revenue or voucher sessions in this range.</Card>}

      <Card>
        <CardHeader
          title="Revenue over time"
          description="Activated voucher value and recorded collections, per period. Hover or focus the chart to read exact values."
        />
        <LineChart
          ariaLabel="Activated value and collections by period"
          labels={labels}
          titles={titles}
          provisional={provisional}
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
            note={anyProvisional ? 'Hollow end dot: period still in progress' : undefined}
          />
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardHeader
            title="Collections by channel"
            description="Where recorded money came from in this range."
          />
          {channelTotals ? (
            report.totals.collections > 0 ? (
              <ShareBar
                ariaLabel="Share of collections by channel"
                format={(value) => formatKobo(value)}
                parts={CHANNELS.map((channel, index) => ({
                  label: channel.label,
                  value: channelTotals[channel.key],
                  color: CHANNEL_COLORS[index] ?? 'var(--viz-quiet)',
                }))}
              />
            ) : (
              <p className="rounded-control bg-surface-muted px-4 py-8 text-center text-sm text-ink-500">
                No collections were recorded for this range.
              </p>
            )
          ) : (
            <p className="text-sm text-ink-500">
              The channel breakdown is not available from this server yet.
            </p>
          )}
        </Card>

        <Card className="min-w-0">
          <CardHeader
            title="Active vouchers"
            description="Distinct vouchers with a recorded RADIUS session in each period."
          />
          {report.accounting_available ? (
            <>
              <BarChart
                ariaLabel="Active vouchers by period"
                labels={labels}
                titles={titles}
                provisional={provisional}
                height={200}
                series={[
                  {
                    key: 'active',
                    label: 'Active vouchers',
                    color: 'var(--viz-1)',
                    values: rows.map((row) => row.active_vouchers),
                  },
                ]}
                format={formatNumber}
                axisFormat={compactNumber}
              />
              <p className="mt-3 text-xs text-ink-500">
                Latest session evidence: {formatDateTime(report.latest_accounting_at)}.
                {anyProvisional && ' Lighter bars are periods still in progress.'}
              </p>
            </>
          ) : (
            <p className="rounded-control bg-surface-muted px-4 py-8 text-center text-sm text-ink-500">
              Usage accounting is unavailable, so active vouchers cannot be charted.
            </p>
          )}
        </Card>
      </div>

      <div className={cn('grid gap-4', weekdays && 'lg:grid-cols-2')}>
        {channelRows && report.totals.collections > 0 && (
          <Card className="min-w-0">
            <CardHeader
              title="Channel mix over time"
              description="Collections per period, stacked by channel."
            />
            <BarChart
              ariaLabel="Collections by channel and period"
              labels={labels}
              titles={titles}
              provisional={provisional}
              height={220}
              series={CHANNELS.map((channel, index) => ({
                key: channel.key,
                label: channel.label,
                color: CHANNEL_COLORS[index] ?? 'var(--viz-quiet)',
                values: rows.map((row) => row.collections_by_channel?.[channel.key] ?? null),
              }))}
              format={(value) => formatKobo(value)}
              axisFormat={compactKobo}
            />
            <div className="mt-3">
              <Legend
                shape="box"
                items={CHANNELS.map((channel, index) => ({
                  label: channel.label,
                  color: CHANNEL_COLORS[index] ?? 'var(--viz-quiet)',
                }))}
              />
            </div>
          </Card>
        )}
        {weekdays && (
          <Card className="min-w-0">
            <CardHeader
              title="Weekly pattern"
              description={`Average activated value per weekday, from complete days. Busiest: ${weekdays.bestDay} (${formatKobo(weekdays.bestAverage, { compact: true })}).`}
            />
            <BarChart
              ariaLabel="Average activated value by weekday"
              labels={weekdays.labels}
              titles={weekdays.labels.map((day) => `${day} · average of complete days`)}
              height={220}
              series={[
                {
                  key: 'weekday',
                  label: 'Average activated value',
                  color: 'var(--viz-1)',
                  values: weekdays.averages,
                },
              ]}
              format={(value) => formatKobo(value)}
              axisFormat={compactKobo}
            />
          </Card>
        )}
      </div>

      {report.totals.activated_value === 0 && (
        <p className="text-sm text-ink-500">
          No activated voucher value was recorded for this range.
        </p>
      )}

      <Card>
        <CardHeader
          title="Figures"
          description="Exact values for every period, the same data the charts show."
          actions={
            <Button
              variant="secondary"
              size="sm"
              aria-expanded={showFigures}
              onClick={() => setShowFigures((value) => !value)}
            >
              {showFigures ? 'Hide figures' : 'Show figures'}
            </Button>
          }
          className={showFigures ? '' : 'mb-0'}
        />
        {showFigures && <FiguresTable report={report} grain={grain} />}
      </Card>

      <p className="text-xs leading-relaxed text-ink-500">
        Activated value includes generated, storefront and WhatsApp vouchers at first use.
        Collections use successful customer payments, agent wallet sales and credit repayments. They
        are separate measures. Active vouchers come from recorded RADIUS sessions; missing
        historical accounting can limit these figures. Times use {report.reporting_timezone}.
      </p>
    </div>
  );
}

export default function ReportsPage() {
  const principal = usePrincipal();
  const [search, setSearch] = useSearchParams();
  const params = readParams(search);
  const tenant = principal.kind === 'member' ? principal.tenantId : null;
  const allowed = principal.kind === 'member' && ['owner', 'manager'].includes(principal.role);
  const valid = params.period !== 'custom' || Boolean(params.from && params.to);
  const query = useQuery({
    queryKey: ['tenant-reports', principal.user.id, tenant, params],
    queryFn: () => fetchReport(params),
    enabled: valid && allowed,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const report = query.data;
  const range = report ? previousRange(report.from_date, report.to_date) : null;
  const previousParams: ReportParams | null = range
    ? { period: 'custom', group_by: params.group_by, from: range.from, to: range.to }
    : null;
  const previous = useQuery({
    queryKey: ['tenant-reports', principal.user.id, tenant, previousParams],
    queryFn: () => fetchReport(previousParams as ReportParams),
    enabled: Boolean(previousParams) && allowed && !query.isPlaceholderData,
    staleTime: 5 * 60_000,
    retry: false,
  });

  function exportCsv() {
    if (!report) return;
    const blob = new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `report-${report.from_date}-to-${report.to_date}-${report.group_by}.csv`);
  }

  return (
    <div className="viz space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-500">Business intelligence</p>
          <h1 className="text-2xl font-bold text-brand-950">Reports</h1>
          <p className="mt-1 text-sm text-ink-500">
            Voucher activity, recorded collections and access trends for this workspace.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!report}>
            <Download aria-hidden className="size-4" />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void query.refetch()}
            disabled={query.isFetching || !valid}
          >
            <RefreshCw aria-hidden className={cn('size-4', query.isFetching && 'animate-spin')} />
            Refresh report
          </Button>
        </div>
      </header>

      <Card>
        <ReportFilters
          key={search.toString()}
          params={params}
          defaultRange={report ? { from: report.from_date, to: report.to_date } : undefined}
          onApply={(next) => setSearch(toSearch(next))}
        />
        {report && (
          <p className="mt-3 border-t border-border pt-3 text-xs text-ink-500">
            {periodLabel(report.from_date, 'day', true)} to{' '}
            {periodLabel(report.to_date, 'day', true)} · Updated{' '}
            {formatDateTime(report.observed_at)}
            {query.isFetching && ' · Refreshing…'}
            {query.isStale && !query.isFetching ? ' · May be out of date' : ''}
          </p>
        )}
      </Card>

      {!valid && (
        <Alert tone="warning" title="Choose dates">
          Enter both custom dates and apply the filters.
        </Alert>
      )}
      {query.isError && (
        <Alert tone="warning" title="Report unavailable">
          {report ? 'Showing the last successful figures.' : 'The figures could not be loaded.'}{' '}
          Please check the dates or try again.
          <Button variant="secondary" className="ml-3" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </Alert>
      )}
      {valid && query.isPending && <ReportSkeleton />}
      {report && (
        <div
          aria-busy={query.isPlaceholderData}
          className={cn('transition-opacity', query.isPlaceholderData && 'opacity-60')}
        >
          <ReportBody report={report} previous={previous.data} grain={report.group_by} />
        </div>
      )}
    </div>
  );
}
