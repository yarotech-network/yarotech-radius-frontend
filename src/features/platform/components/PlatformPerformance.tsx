import { useState } from 'react';
import { KpiDelta, KpiTile, Section } from '@/components/layout';
import { Card, SegmentedControl } from '@/components/ui';
import { ShareBar } from '@/components/charts';
import { formatKobo } from '@/lib/formatting/money';
import { percentChange } from '@/features/reports/reportMath';
import type { PlatformMoney, PlatformPeriod, PlatformStats } from '@/types/api';

type PeriodChoice = PlatformPeriod | 'all';

const PERIOD_OPTIONS: { value: PeriodChoice; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

/** Each period is compared with the same elapsed span of the one before it. */
const COMPARISON: Record<PlatformPeriod, string> = {
  today: 'vs this time yesterday',
  week: 'vs same point last week',
  month: 'vs same point last month',
  quarter: 'vs same point last quarter',
  year: 'vs same point last year',
};

const REVENUE = [
  {
    key: 'voucher_sales',
    label: 'Voucher sales',
    total: 'successful_payment_amount',
    to: '/platform/payments?source=vouchers',
    link: 'View voucher sales',
  },
  {
    key: 'subscriptions',
    label: 'Subscriptions',
    total: 'successful_subscription_amount',
    to: '/platform/payments?source=subscriptions',
    link: 'View subscriptions',
  },
  {
    key: 'wallet_topups',
    label: 'Agent wallet top-ups',
    total: 'successful_wallet_funding_amount',
    to: '/platform/payments?source=wallet',
    link: 'View agent wallet top-ups',
  },
] as const;

/** Headline money rounds to whole naira; exact amounts are on the payments page. */
function wholeNaira(kobo: number) {
  return formatKobo(Math.round(kobo / 100) * 100, { compact: true });
}

function payments(money: PlatformMoney) {
  return `${money.count.toLocaleString()} ${money.count === 1 ? 'payment' : 'payments'}`;
}

/**
 * Money and growth for one selected period. Without period figures (an older backend)
 * it falls back to the all-time totals and hides the switcher.
 */
export function PlatformPerformance({
  stats,
  loading,
}: {
  stats: PlatformStats | undefined;
  loading: boolean;
}) {
  const [choice, setChoice] = useState<PeriodChoice>('month');
  const periods = stats?.periods;
  const period = periods && choice !== 'all' ? choice : null;
  const figures = period ? periods?.[period] : undefined;
  const label = PERIOD_OPTIONS.find((option) => option.value === (period ?? 'all'))?.label;

  return (
    <Section
      title="Revenue & growth"
      description={`${label}. Successful payments in NGN — the categories are separate and never added into one total.`}
      actions={
        periods && (
          <div className="max-w-full overflow-x-auto">
            <SegmentedControl
              ariaLabel="Period"
              size="sm"
              options={PERIOD_OPTIONS}
              value={choice}
              onChange={setChoice}
            />
          </div>
        )
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        {REVENUE.map((item) => {
          const money = figures?.[item.key];
          const previous = figures?.previous[item.key];
          return (
            <KpiTile
              key={item.key}
              label={item.label}
              value={money ? wholeNaira(money.amount) : stats ? wholeNaira(stats[item.total]) : '—'}
              detail={money ? payments(money) : 'All-time successful payments'}
              extra={
                period && money && previous ? (
                  <KpiDelta
                    change={percentChange(money.amount, previous.amount)}
                    comparison={COMPARISON[period]}
                  />
                ) : undefined
              }
              to={item.to}
              link={item.link}
              loading={loading}
            />
          );
        })}
        <KpiTile
          label="New tenants"
          value={(figures ? figures.new_tenants : stats?.tenants)?.toLocaleString() ?? '—'}
          detail={figures ? 'Operators that joined' : 'All registered operators'}
          extra={
            period && figures ? (
              <KpiDelta
                change={percentChange(figures.new_tenants, figures.previous.new_tenants)}
                comparison={COMPARISON[period]}
              />
            ) : undefined
          }
          to="/platform/tenants"
          link="View new tenants"
          loading={loading}
        />
        <KpiTile
          label="Vouchers generated"
          value={(figures ? figures.vouchers_issued : stats?.vouchers)?.toLocaleString() ?? '—'}
          detail={figures ? 'Access codes created' : 'All access codes'}
          extra={
            period && figures ? (
              <KpiDelta
                change={percentChange(figures.vouchers_issued, figures.previous.vouchers_issued)}
                comparison={COMPARISON[period]}
              />
            ) : undefined
          }
          loading={loading}
        />
      </div>
    </Section>
  );
}

const CYCLES = [
  { key: 'monthly', label: 'Monthly', color: 'var(--viz-1)' },
  { key: 'quarterly', label: 'Quarterly', color: 'var(--viz-2)' },
  { key: 'annual', label: 'Annual', color: 'var(--viz-3)' },
  { key: 'other', label: 'Other lengths', color: 'var(--viz-quiet)' },
] as const;

const REVENUE_STRIP = [
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'This year' },
] as const;

/** Operator subscriptions: status now, plan-length mix, and revenue month/quarter/year to date. */
export function PlatformSubscriptions({ stats }: { stats: PlatformStats }) {
  const status = stats.subscription_status;
  const periods = stats.periods;
  if (!status && !periods) return null;
  const subscribers = status
    ? CYCLES.reduce((sum, cycle) => sum + status.by_cycle[cycle.key], 0)
    : 0;

  return (
    <Section
      title="Subscriptions"
      className="viz"
      description="Operator platform plans: who is paying, on which plan length, and what they bring in."
    >
      {status && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiTile
            label="Active paid"
            value={status.active_paid.toLocaleString()}
            detail="Paying operators with time left"
            to="/platform/tenants"
            link="View subscribed tenants"
          />
          <KpiTile
            label="On trial"
            value={status.trial.toLocaleString()}
            detail="Free trials still running"
          />
          <KpiTile
            label="Expiring in 7 days"
            value={status.expiring_7d.toLocaleString()}
            detail={status.expiring_7d > 0 ? 'Remind them to renew' : 'No renewals due this week'}
            extra={
              status.expiring_7d > 0 ? (
                <span aria-hidden className="block h-1 rounded-full bg-warning-600" />
              ) : undefined
            }
          />
          <KpiTile
            label="Expired"
            value={status.expired.toLocaleString()}
            detail={`${status.cancelled.toLocaleString()} cancelled`}
          />
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {status && (
          <Card>
            <h3 className="text-sm font-semibold text-ink-900">Subscribers by plan length</h3>
            <p className="mt-0.5 mb-4 text-xs text-ink-500">
              {subscribers.toLocaleString()} active paid{' '}
              {subscribers === 1 ? 'subscription' : 'subscriptions'}
            </p>
            <ShareBar
              ariaLabel={CYCLES.map(
                (cycle) => `${cycle.label}: ${status.by_cycle[cycle.key].toLocaleString()}`,
              ).join(', ')}
              format={(value) => value.toLocaleString()}
              parts={CYCLES.map((cycle) => ({
                label: cycle.label,
                value: status.by_cycle[cycle.key],
                color: cycle.color,
              }))}
            />
          </Card>
        )}
        {periods && (
          <Card>
            <h3 className="text-sm font-semibold text-ink-900">Subscription revenue</h3>
            <p className="mt-0.5 mb-4 text-xs text-ink-500">Successful plan payments to date</p>
            <dl className="divide-y divide-border">
              {REVENUE_STRIP.map(({ key, label }) => {
                const money = periods[key].subscriptions;
                return (
                  <div key={key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                    <dt className="min-w-24 text-sm text-ink-600">{label}</dt>
                    <dd className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-base font-semibold text-ink-900 tabular-nums">
                        {wholeNaira(money.amount)}
                        <span className="ml-2 text-xs font-normal text-ink-500">
                          {payments(money)}
                        </span>
                      </span>
                      <KpiDelta
                        change={percentChange(
                          money.amount,
                          periods[key].previous.subscriptions.amount,
                        )}
                        comparison={COMPARISON[key]}
                      />
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        )}
      </div>
    </Section>
  );
}
