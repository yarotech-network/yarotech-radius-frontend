import { useState } from 'react';
import { Card } from '@/components/ui';
import { formatKobo } from '@/lib/formatting/money';
import { formatNumber } from '@/lib/formatting/units';
import type { ReportRow } from './api';

type Metric = 'activated_value' | 'collections' | 'active_vouchers';
const METRICS: { key: Metric; label: string }[] = [
  { key: 'activated_value', label: 'Activated value' },
  { key: 'collections', label: 'Collections' },
  { key: 'active_vouchers', label: 'Active vouchers' },
];
const PAGE_SIZE = 12;

function displayValue(value: number | null, metric: Metric) {
  return value === null ? 'Unavailable' : metric === 'active_vouchers'
    ? formatNumber(value) : formatKobo(value);
}

function periodState(row: ReportRow) {
  return row.in_progress ? 'In progress' : row.complete ? 'Complete' : 'Partial range';
}

export function ReportTrend({ rows, accountingAvailable }: {
  rows: ReportRow[];
  accountingAvailable: boolean;
}) {
  const [metric, setMetric] = useState<Metric>('activated_value');
  const [page, setPage] = useState(Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
  const [selected, setSelected] = useState<number | null>(null);
  const pages = Math.ceil(rows.length / PAGE_SIZE);
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const chosen = selected !== null && selected >= page * PAGE_SIZE &&
    selected < (page + 1) * PAGE_SIZE ? rows[selected] : visible.at(-1);
  const max = Math.max(1, ...visible.map((row) => Math.abs(row[metric] ?? 0)));
  const hasValue = visible.some((row) => row[metric] !== null && row[metric] !== 0);

  return <Card className="min-w-0">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-brand-950">Activity over time</h2>
        <p className="mt-1 text-sm text-ink-500">Choose a measure, then select a bar to see its exact value.</p>
      </div>
      <div role="group" aria-label="Chart measure" className="flex flex-wrap gap-1 rounded-xl bg-surface-muted p-1">
        {METRICS.filter((item) => item.key !== 'active_vouchers' || accountingAvailable).map((item) =>
          <button key={item.key} type="button" aria-pressed={metric === item.key}
            onClick={() => setMetric(item.key)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${metric === item.key ? 'bg-brand-600 text-white' : 'text-ink-700 hover:bg-brand-50'}`}>
            {item.label}
          </button>)}
      </div>
    </div>
    <div className="mt-5 rounded-xl border border-border bg-surface-muted/50 px-3 pt-5 pb-3 sm:px-5">
      {hasValue ? <div className="flex h-48 items-end gap-1.5 sm:gap-2" aria-label={`${METRICS.find((item) => item.key === metric)?.label} by period`}>
        {visible.map((row, index) => {
          const value = row[metric];
          const active = chosen?.start === row.start;
          return <button key={row.start} type="button" onClick={() => setSelected(page * PAGE_SIZE + index)}
            aria-label={`${row.start}: ${displayValue(value, metric)}; ${periodState(row)}`}
            aria-pressed={active}
            className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            <span aria-hidden="true" className={`block w-full rounded-t-md transition-colors ${value === null ? 'border-2 border-dashed border-ink-300' : value < 0 ? 'bg-warning-600' : active ? 'bg-brand-600' : 'bg-brand-300 group-hover:bg-brand-600'}`}
              style={{ height: `${value === null ? 10 : Math.max(value === 0 ? 3 : 8, Math.abs(value) / max * 100)}%` }} />
            </button>;
        })}
      </div> : <p className="flex h-48 items-center justify-center text-center text-sm text-ink-500">No {metric === 'active_vouchers' ? 'recorded voucher sessions' : 'recorded value'} in these periods.</p>}
      <div className="mt-2 flex justify-between text-xs text-ink-500"><span>{visible[0]?.start}</span><span>{visible.at(-1)?.start}</span></div>
    </div>
    {chosen && <div aria-live="polite" className="mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-brand-50 px-4 py-3">
      <span className="text-sm font-medium text-brand-950">{chosen.start} <span className="font-normal text-ink-500">· {periodState(chosen)}</span></span>
      <strong className="text-lg tabular-nums text-brand-950">{displayValue(chosen[metric], metric)}</strong>
    </div>}
    {pages > 1 && <div className="mt-4 flex items-center justify-between gap-3 text-sm">
      <button type="button" disabled={page === 0} onClick={() => { setPage(page - 1); setSelected(null); }}
        className="rounded-lg border border-border px-3 py-2 font-medium disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brand-600">Previous periods</button>
      <span className="text-center text-ink-500">{page + 1} of {pages}</span>
      <button type="button" disabled={page === pages - 1} onClick={() => { setPage(page + 1); setSelected(null); }}
        className="rounded-lg border border-border px-3 py-2 font-medium disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-brand-600">Next periods</button>
    </div>}
  </Card>;
}

const SLICE_COLORS = [
  'var(--color-brand-600)', 'var(--color-success-600)',
  'var(--color-warning-600)', 'var(--color-brand-300)', 'var(--color-ink-300)',
];

export function ActivationShare({ rows }: { rows: ReportRow[] }) {
  const ranked = rows.filter((row) => row.activated_value > 0)
    .sort((a, b) => b.activated_value - a.activated_value);
  const top = ranked.slice(0, 4).map((row) => ({ label: row.start, amount: row.activated_value }));
  const remaining = ranked.slice(4).reduce((sum, row) => sum + row.activated_value, 0);
  const slices = remaining ? [...top, { label: 'Other periods', amount: remaining }] : top;
  const total = slices.reduce((sum, slice) => sum + slice.amount, 0);
  const stops = slices.map((slice, index) => {
    const start = slices.slice(0, index).reduce((sum, previous) => sum + previous.amount, 0) / total * 100;
    const end = start + slice.amount / total * 100;
    return `${SLICE_COLORS[index]} ${start}% ${end}%`;
  });

  return <Card className="min-w-0">
    <h2 className="text-lg font-semibold text-brand-950">Activated value by period</h2>
    <p className="mt-1 text-sm text-ink-500">The four highest periods are shown separately; the rest are grouped.</p>
    {total > 0 ? <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row">
      <div role="img" aria-label="Activated value share by reporting period"
        className="relative size-44 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops.join(', ')})` }}>
        <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-surface text-center">
          <span className="text-xs text-ink-500">Total</span>
          <strong className="text-base text-brand-950">{formatKobo(total, { compact: true })}</strong>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-3 text-sm">
        {slices.map((slice, index) => <li key={slice.label} className="flex items-center gap-2">
          <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: SLICE_COLORS[index] }} />
          <span className="min-w-0 flex-1 text-ink-700">{slice.label}</span>
          <span className="shrink-0 tabular-nums font-semibold text-brand-950">{formatKobo(slice.amount)} <span className="font-normal text-ink-500">({Math.round(slice.amount / total * 100)}%)</span></span>
        </li>)}
      </ul>
    </div> : <p className="mt-6 rounded-xl bg-surface-muted px-4 py-8 text-center text-sm text-ink-500">No activated voucher value was recorded for this range.</p>}
  </Card>;
}
