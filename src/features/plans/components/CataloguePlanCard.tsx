import type { ReactNode } from 'react';
import { Clock, Database, Gauge, MonitorSmartphone } from 'lucide-react';
import { Card } from '@/components/ui';
import { Badge } from '@/components/ui/Badge';
import { BooleanBadge } from '@/components/layout/StatusBadge';
import { formatKobo } from '@/lib/formatting/money';
import { describeRateLimit, formatDataLimit, formatHours } from '@/lib/formatting/units';
import { cn } from '@/lib/utilities/cn';
import type { InternetPlan } from '@/types/api';

/** Where a plan can be bought: storefront, agents, or neither (issued by staff only). */
export function SalesChannels({ plan }: { plan: InternetPlan }) {
  const storefront = plan.is_public !== false;
  const agents = plan.agent_enabled !== false;
  if (!storefront && !agents) {
    return (
      <Badge tone="outline" size="sm">
        Staff issue only
      </Badge>
    );
  }
  return (
    <span className="inline-flex flex-wrap gap-1">
      {storefront && (
        <Badge tone="info" size="sm">
          Storefront
        </Badge>
      )}
      {agents && (
        <Badge tone="neutral" size="sm">
          Agents
        </Badge>
      )}
    </span>
  );
}

function Spec({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm text-ink-700">
      <span aria-hidden className="text-ink-400 [&>svg]:size-4">
        {icon}
      </span>
      {children}
    </li>
  );
}

/** A plan as a catalogue card: price first, then what the customer gets. */
export function CataloguePlanCard({
  plan,
  actions,
  primaryAction,
}: {
  plan: InternetPlan;
  actions: ReactNode;
  primaryAction?: ReactNode;
}) {
  const devices = plan.max_devices ?? 1;
  return (
    <Card
      padded={false}
      className={cn('flex min-w-0 flex-col p-4', !plan.is_active && 'bg-surface-muted')}
    >
      <article aria-label={plan.name} className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-ink-900" title={plan.name}>
              {plan.name}
            </h3>
            <div className="mt-1">
              <BooleanBadge
                value={plan.is_active}
                trueLabel="Active"
                falseLabel={plan.archived_at ? 'Archived' : 'Inactive'}
                size="sm"
              />
            </div>
          </div>
          {actions}
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-ink-900">
          {formatKobo(plan.price, { compact: true })}
        </p>
        <ul className="mt-3 space-y-1.5">
          <Spec icon={<Clock />}>{formatHours(plan.duration_hours)}</Spec>
          <Spec icon={<Gauge />}>{describeRateLimit(plan.rate_limit)}</Spec>
          <Spec icon={<Database />}>{formatDataLimit(plan.data_limit)}</Spec>
          <Spec icon={<MonitorSmartphone />}>
            {devices === 1 ? '1 device' : `Up to ${devices} devices`}
          </Spec>
        </ul>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <SalesChannels plan={plan} />
          {plan.voucher_prefix && (
            <code
              className="rounded bg-fill px-1.5 py-0.5 text-xs text-ink-600"
              title="Voucher prefix"
            >
              {plan.voucher_prefix}
            </code>
          )}
        </div>
        {primaryAction && <div className="mt-3">{primaryAction}</div>}
      </article>
    </Card>
  );
}
