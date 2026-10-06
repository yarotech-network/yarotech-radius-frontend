import type { CollectionsByChannel, GroupBy, ReportRow, TenantReport } from './api';

const DAY_MS = 86_400_000;

/** Report dates are calendar dates (YYYY-MM-DD); keep them in UTC so no timezone shifts a day. */
function parseDay(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function rangeLength(from: string, to: string) {
  return Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / DAY_MS) + 1;
}

/** The equal-length range that ends the day before `from`, used for period-over-period deltas. */
export function previousRange(from: string, to: string) {
  const days = rangeLength(from, to);
  const end = new Date(parseDay(from).getTime() - DAY_MS);
  const start = new Date(end.getTime() - (days - 1) * DAY_MS);
  return { from: isoDay(start), to: isoDay(end), days };
}

/** Relative change; null when there is no baseline to compare against. */
export function percentChange(current: number, previous: number | null | undefined) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

const DAY_LABEL = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const MONTH_LABEL = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const LONG_LABEL = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

export function periodLabel(start: string, grain: GroupBy, long = false) {
  const date = parseDay(start);
  if (grain === 'month') return MONTH_LABEL.format(date);
  if (grain === 'week') return `${long ? 'Week of ' : 'Wk '}${DAY_LABEL.format(date)}`;
  return long ? LONG_LABEL.format(date) : DAY_LABEL.format(date);
}

export function periodState(row: ReportRow) {
  return row.in_progress ? 'In progress' : row.complete ? 'Complete' : 'Partial range';
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

/**
 * Average activated value per weekday, from complete days only, so a half-finished
 * today never drags its weekday down. Null when there are fewer than two of each weekday.
 */
export function weekdayPattern(rows: ReportRow[]) {
  const sums = WEEKDAYS.map(() => ({ total: 0, days: 0 }));
  for (const row of rows) {
    if (!row.complete) continue;
    const slot = sums[(parseDay(row.start).getUTCDay() + 6) % 7];
    if (!slot) continue;
    slot.total += row.activated_value;
    slot.days += 1;
  }
  if (sums.some((slot) => slot.days < 2)) return null;
  const averages = sums.map((slot) => Math.round(slot.total / slot.days));
  const best = averages.indexOf(Math.max(...averages));
  return {
    labels: [...WEEKDAYS],
    averages,
    bestDay: WEEKDAY_NAMES[best] ?? '',
    bestAverage: averages[best] ?? 0,
  };
}

/** The highest complete-or-current period for a measure (ties go to the earliest). */
export function peakPeriod(rows: ReportRow[], measure: 'activated_value' | 'collections') {
  let peak: ReportRow | undefined;
  for (const row of rows)
    if (row[measure] > 0 && (!peak || row[measure] > peak[measure])) peak = row;
  return peak;
}

export const CHANNELS: { key: keyof CollectionsByChannel; label: string }[] = [
  { key: 'online_payments', label: 'Online payments' },
  { key: 'agent_wallet', label: 'Agent wallet sales' },
  { key: 'credit_repayments', label: 'Credit repayments' },
];

function naira(kobo: number) {
  return (kobo / 100).toFixed(2);
}

export function reportCsv(report: TenantReport) {
  const header = [
    'Period start',
    'Period end (exclusive)',
    'Status',
    'Activated value (NGN)',
    'Collections (NGN)',
    ...CHANNELS.map((channel) => `${channel.label} (NGN)`),
    'Active vouchers',
  ];
  const lines = report.rows.map((row) => [
    row.start,
    row.end_exclusive,
    periodState(row),
    naira(row.activated_value),
    naira(row.collections),
    ...CHANNELS.map((channel) =>
      row.collections_by_channel ? naira(row.collections_by_channel[channel.key]) : '',
    ),
    row.active_vouchers === null ? '' : String(row.active_vouchers),
  ]);
  return [header, ...lines].map((line) => line.join(',')).join('\r\n');
}
