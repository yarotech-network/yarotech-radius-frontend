import type { ReactNode } from 'react';
import { Clock, Database, Gauge, Users } from 'lucide-react';
import { formatKobo } from '@/lib/formatting/money';
import { describeRateLimit, formatDataLimit, formatHours } from '@/lib/formatting/units';
import { cn } from '@/lib/utilities/cn';
import type { PublicPlan } from '@/types/api';

function specs(plan: PublicPlan) {
  return [
    { key: 'duration', term: 'Valid for', icon: Clock, value: formatHours(plan.duration_hours) },
    {
      key: 'data',
      term: 'Data',
      icon: Database,
      value: plan.data_limit === 0 ? 'Unlimited data' : `${formatDataLimit(plan.data_limit)} data`,
    },
    { key: 'speed', term: 'Speed', icon: Gauge, value: describeRateLimit(plan.rate_limit) },
    ...((plan.max_devices ?? 1) > 1
      ? [
          {
            key: 'devices',
            term: 'Devices',
            icon: Users,
            value: `Up to ${plan.max_devices} devices`,
          },
        ]
      : []),
  ];
}

/**
 * Customer-facing plan card shared by the storefront and the agent "Sell" screen.
 * `shop` is the compact public variant: name and price on one line, specs as chips,
 * so customers on a phone can compare several plans without long scrolling.
 */
export function PlanCard({
  plan,
  action,
  selected,
  className,
  variant = 'default',
}: {
  plan: PublicPlan;
  action?: ReactNode;
  selected?: boolean;
  className?: string;
  variant?: 'default' | 'shop';
}) {
  const border = selected ? 'border-brand-600 ring-1 ring-brand-600' : 'border-border';
  if (variant === 'shop') {
    return (
      <article
        aria-label={plan.name}
        className={cn(
          'plan-card-shop flex h-full flex-col rounded-card border bg-surface p-4 transition-shadow hover:shadow-subtle',
          border,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {plan.plan_type === 'iot_mac' && (
              <p className="text-xs font-medium text-brand-700">IoT / MAC device access</p>
            )}
            <h3 className="text-base font-semibold break-words text-ink-900">{plan.name}</h3>
          </div>
          <p className="shrink-0 text-xl font-bold tracking-tight text-ink-900">
            {formatKobo(plan.price)}
          </p>
        </div>
        <dl className="mt-3 flex flex-wrap gap-1.5">
          {specs(plan).map(({ key, term, icon: Icon, value }) => (
            <div
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full bg-fill px-2.5 py-1 text-xs text-ink-700"
            >
              <Icon className="size-3.5 shrink-0 text-ink-500" aria-hidden />
              <dt className="sr-only">{term}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        {action && <div className="mt-auto pt-4">{action}</div>}
      </article>
    );
  }
  return (
    <article
      aria-label={plan.name}
      className={cn('flex h-full flex-col rounded-card border bg-surface p-4', border, className)}
    >
      {plan.plan_type === 'iot_mac' && (
        <p className="text-sm text-brand-700">IoT / MAC device access</p>
      )}
      <h3 className="text-base font-semibold text-brand-950">{plan.name}</h3>
      <p className="mt-1 text-2xl font-semibold text-ink-900 tabular-nums">
        {formatKobo(plan.price)}
      </p>
      <dl className="mt-3 space-y-1.5 text-sm text-ink-700">
        {specs(plan).map(({ key, term, icon: Icon, value }) => (
          <div key={key} className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-ink-400" aria-hidden />
            <dt className="sr-only">{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {action && <div className="mt-4 pt-1">{action}</div>}
    </article>
  );
}

export function PlanCardSkeleton() {
  return (
    <div className="h-40 animate-pulse rounded-card border border-border bg-surface p-4">
      <div className="flex justify-between">
        <div className="h-4 w-1/2 rounded bg-fill-strong" />
        <div className="h-5 w-1/5 rounded bg-fill-strong" />
      </div>
      <div className="mt-4 flex gap-1.5">
        <div className="h-6 w-16 rounded-full bg-fill" />
        <div className="h-6 w-24 rounded-full bg-fill" />
        <div className="h-6 w-28 rounded-full bg-fill" />
      </div>
      <div className="mt-6 h-10 rounded-control bg-fill" />
    </div>
  );
}
