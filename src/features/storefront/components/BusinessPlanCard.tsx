import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { PlanLimits } from '@/features/settings/components/PlanLimits';
import { formatKobo } from '@/lib/formatting/money';
import type { SubscriptionPlan } from '@/types/api/subscriptions';

export function BusinessPlanCard({
  plan,
  heading: Heading = 'h3',
}: {
  plan: SubscriptionPlan;
  heading?: 'h2' | 'h3';
}) {
  return (
    <article className="public-plan h-full">
      <p className="public-eyebrow">Business subscription</p>
      <Heading className="mt-3 text-xl font-semibold text-brand-950">{plan.name}</Heading>
      <p className="public-plan-price">{formatKobo(plan.price)}</p>
      <p className="text-sm text-ink-600">for {plan.duration_days} days</p>
      <div className="public-plan-includes">
        <h4>Plan allowances</h4>
        <PlanLimits plan={plan} />
      </div>
      {plan.features.some((feature) => typeof feature === 'string') && (
        <ul className="mt-4 space-y-3 text-sm text-ink-700">
          {plan.features
            .filter((feature): feature is string => typeof feature === 'string')
            .map((feature, index) => (
              <li key={`${index}-${feature}`} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
                <span>{feature}</span>
              </li>
            ))}
        </ul>
      )}
      <ButtonLink to="/register" className="mt-6" block>
        Create workspace
      </ButtonLink>
    </article>
  );
}
