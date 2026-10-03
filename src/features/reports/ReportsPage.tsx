import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { usePrincipal } from '@/app/auth/useAuth';
import { Alert } from '@/components/feedback';
import { Button, Card, Stat } from '@/components/ui';
import { formatKobo } from '@/lib/formatting/money';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatNumber } from '@/lib/formatting/units';
import { fetchReport, type GroupBy, type Period, type ReportParams } from './api';
import { ActivationShare, ReportTrend } from './ReportCharts';

const periods: { value: Period; label: string }[] = [
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'this_month', label: 'This month' },
  { value: 'custom', label: 'Custom dates' },
];
const grains: { value: GroupBy; label: string }[] = [
  { value: 'day', label: 'Daily' }, { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
];

function readParams(search: URLSearchParams): ReportParams {
  const rawPeriod = search.get('period');
  const rawGrain = search.get('group_by');
  const period = periods.find((item) => item.value === rawPeriod)?.value ?? 'last_30_days';
  const group_by = grains.find((item) => item.value === rawGrain)?.value ?? 'day';
  return period === 'custom'
    ? { period, group_by, from: search.get('from') ?? '', to: search.get('to') ?? '' }
    : { period, group_by };
}

function ReportFilters({ initial, onApply }: {
  initial: ReportParams;
  onApply: (params: ReportParams) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [formError, setFormError] = useState('');
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.period === 'custom' && (!draft.from || !draft.to || draft.from > draft.to)) {
      setFormError('Choose a valid start and end date.');
      return;
    }
    setFormError('');
    onApply(draft);
  }
  return <Card>
    <form onSubmit={apply} className="flex flex-wrap items-end gap-3" aria-label="Report filters">
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-medium">Period
        <select className="min-h-10 rounded border border-border bg-surface px-3" value={draft.period}
          onChange={(event) => setDraft({ ...draft, period: event.target.value as Period })}>
          {periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-medium">Group by
        <select className="min-h-10 rounded border border-border bg-surface px-3" value={draft.group_by}
          onChange={(event) => setDraft({ ...draft, group_by: event.target.value as GroupBy })}>
          {grains.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {draft.period === 'custom' && <>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-medium">From
          <input required type="date" value={draft.from ?? ''} className="min-h-10 rounded border border-border bg-surface px-3"
            onChange={(event) => setDraft({ ...draft, from: event.target.value })} />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm font-medium">To
          <input required type="date" value={draft.to ?? ''} className="min-h-10 rounded border border-border bg-surface px-3"
            onChange={(event) => setDraft({ ...draft, to: event.target.value })} />
        </label>
      </>}
      <Button type="submit">Apply</Button>
    </form>
    {formError && <p role="alert" className="mt-2 text-sm text-danger-700">{formError}</p>}
    <p className="mt-2 text-xs text-ink-500">Custom date ranges can span up to 12 months.</p>
  </Card>;
}

export default function ReportsPage() {
  const principal = usePrincipal();
  const [search, setSearch] = useSearchParams();
  const params = readParams(search);
  const tenant = principal.kind === 'member' ? principal.tenantId : null;
  const valid = params.period !== 'custom' || Boolean(params.from && params.to);
  const query = useQuery({
    queryKey: ['tenant-reports', principal.user.id, tenant, params],
    queryFn: () => fetchReport(params),
    enabled: valid && principal.kind === 'member' && ['owner', 'manager'].includes(principal.role),
    staleTime: 60_000,
  });
  const report = query.data;
  const grainName = params.group_by === 'day' ? 'day' : params.group_by === 'week' ? 'week' : 'month';

  return <div className="space-y-6">
    <header>
      <p className="text-sm text-ink-500">Business intelligence</p>
      <h1 className="text-2xl font-bold text-brand-950">Reports</h1>
      <p className="mt-1 text-sm text-ink-500">Voucher activity, recorded collections and access trends for this workspace.</p>
    </header>
    <ReportFilters key={search.toString()} initial={params} onApply={(next) =>
      setSearch(next.period === 'custom'
        ? { period: next.period, group_by: next.group_by, from: next.from ?? '', to: next.to ?? '' }
        : { period: next.period, group_by: next.group_by })} />
    {!valid && <Alert tone="warning" title="Choose dates">Enter both custom dates and apply the filters.</Alert>}
    {valid && query.isPending && <p role="status">Loading report…</p>}
    {query.isError && <Alert tone="warning" title="Report unavailable">
      {report ? 'Showing the last successful figures.' : 'The figures could not be loaded.'} Please check the dates or try again.
      <Button variant="secondary" className="ml-3" onClick={() => void query.refetch()}>Retry</Button>
    </Alert>}
    {report && <>
      {query.isFetching && <p role="status" className="text-xs text-ink-500">Refreshing report…</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-500">{report.from_date} to {report.to_date} · Updated {formatDateTime(report.observed_at)}{query.isStale && !query.isFetching ? ' · May be out of date' : ''}</p>
        <Button variant="secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>Refresh report</Button>
      </div>
      <section aria-label="Report summaries" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Activated voucher value" value={formatKobo(report.totals.activated_value)} hint="Service value at first activation" />
        <Stat label="Average activated value" value={report.averages.activated_value === null ? 'Insufficient completed periods' : formatKobo(report.averages.activated_value)} hint={`Per completed ${grainName}`} />
        <Stat label="Recorded collections" value={formatKobo(report.totals.collections)} hint="Money recorded from supported channels" />
        <Stat label="Average collections" value={report.averages.collections === null ? 'Insufficient completed periods' : formatKobo(report.averages.collections)} hint={`Per completed ${grainName}`} />
        <Stat label="Average active vouchers" value={!report.accounting_available ? 'Unavailable' : report.averages.active_vouchers === null ? 'Insufficient completed periods' : formatNumber(report.averages.active_vouchers)} hint={`Distinct vouchers per completed ${grainName}`} />
      </section>
      <p className="text-sm text-ink-500">Activated value includes generated, storefront and WhatsApp vouchers at first use. Collections use successful customer payments, agent wallet sales and credit repayments. They are separate measures.</p>
      {!report.accounting_available && <Alert tone="warning" title="Usage accounting unavailable">Active-voucher figures cannot be confirmed. Revenue figures remain available.</Alert>}
      {report.accounting_available && <p className="text-sm text-ink-500">Active vouchers come from recorded RADIUS sessions; missing historical accounting can limit these figures. Latest session evidence in this range: {formatDateTime(report.latest_accounting_at)}.</p>}
      {report.rows.length === 0 ? <Card>No data for this range.</Card> : <>
        {report.totals.activated_value === 0 && report.totals.collections === 0 &&
          report.rows.every((row) => !row.active_vouchers) &&
          <Card>No recorded revenue or voucher sessions in this range.</Card>}
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <ReportTrend key={`${report.from_date}-${report.to_date}-${params.group_by}`}
            rows={report.rows} accountingAvailable={report.accounting_available} />
          <ActivationShare rows={report.rows} />
        </div>
      </>}
    </>}
  </div>;
}
