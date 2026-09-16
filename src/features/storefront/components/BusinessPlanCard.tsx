import { Check, Wifi, Clock, Server, MessageSquare, ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { formatKobo } from '@/lib/formatting/money';
import type { SubscriptionPlan } from '@/types/api/subscriptions';

function LimitPill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="bpc-pill">
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export function BusinessPlanCard({
  plan,
  heading: Heading = 'h3',
}: {
  plan: SubscriptionPlan;
  heading?: 'h2' | 'h3';
}) {
  const features = plan.features.filter(
    (f): f is string => typeof f === 'string',
  );

  const routerLabel =
    plan.max_routers == null ? 'Unlimited routers' : `${plan.max_routers} router${plan.max_routers !== 1 ? 's' : ''}`;

  const voucherLabel =
    plan.daily_voucher_print_limit == null
      ? 'Unlimited vouchers/day'
      : `${plan.daily_voucher_print_limit} vouchers/day`;

  return (
    <article className="bpc-card">
      {/* Top accent bar */}
      <div className="bpc-accent" aria-hidden />

      <div className="bpc-body">
        {/* Eyebrow */}
        <p className="bpc-eyebrow">Business subscription</p>

        {/* Plan name */}
        <Heading className="bpc-name">{plan.name}</Heading>

        {/* Price block */}
        <div className="bpc-price-block">
          <span className="bpc-price">{formatKobo(plan.price)}</span>
          <span className="bpc-price-meta">
            <Clock className="size-3.5" aria-hidden />
            {plan.duration_days} days
          </span>
        </div>

        <hr className="bpc-divider" />

        {/* Allowance pills */}
        <div className="bpc-allowances">
          <p className="bpc-allowances-label">Included</p>
          <div className="bpc-pills">
            <LimitPill icon={Server} label={routerLabel} />
            <LimitPill icon={Wifi} label={voucherLabel} />
            {plan.whatsapp_enabled && (
              <LimitPill icon={MessageSquare} label="WhatsApp enabled" />
            )}
          </div>
        </div>

        {/* Feature list */}
        {features.length > 0 && (
          <ul className="bpc-features">
            {features.map((feature, i) => (
              <li key={`${i}-${feature}`} className="bpc-feature">
                <span className="bpc-check" aria-hidden>
                  <Check className="size-3.5" />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        {/* CTA */}
        <ButtonLink to="/register" className="bpc-cta" block>
          Get started <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
      </div>
    </article>
  );
}
