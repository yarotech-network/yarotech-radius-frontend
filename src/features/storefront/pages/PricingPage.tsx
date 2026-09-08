import { PlanLimits } from '@/features/settings/components/PlanLimits';
import { useEffect } from 'react';
import { Check } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { formatKobo } from '@/lib/formatting/money';
import { usePlatformPricing } from '../queries';
import { PlanCardSkeleton } from '../components/PlanCard';

/** `/pricing` — platform subscription plans for prospective operators (read-only; sign-up CTA). */
export default function PricingPage() {
  const pricing = usePlatformPricing();
  useEffect(() => {
    document.title = 'Pricing · Yarotech RADIUS';
  }, []);
  return (
    <div className="public-pricing">
      <header className="public-page-heading">
        <p className="public-eyebrow">Business plans</p>
        <h1 className="public-section-title">Simple pricing for hotspot operators</h1>
        <p className="mt-2 text-sm text-ink-500">
          Run vouchers, routers, agents and payments from one workspace. Choose the duration that
          fits your business and pay with Paystack.
        </p>
      </header>
      {pricing.isPending ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <li key={i}>
              <PlanCardSkeleton />
            </li>
          ))}
        </ul>
      ) : pricing.isError ? (
        <ErrorState
          error={pricing.error}
          onRetry={() => void pricing.refetch()}
          title="Could not load pricing"
        />
      ) : pricing.data.length === 0 ? (
        <EmptyState title="Pricing coming soon" description="Plans have not been published yet." />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {pricing.data.map((plan) => (
            <li key={plan.id} className="public-plan">
              <h2 className="text-lg font-semibold text-brand-950">{plan.name}</h2>
              <p className="mt-1 text-3xl font-semibold text-ink-900 tabular-nums">
                {formatKobo(plan.price)}{' '}
                <span className="text-sm font-normal text-ink-500">
                  / {plan.duration_days} days
                </span>
              </p>
              <PlanLimits plan={plan} />
              {plan.features.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-ink-700">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
                      <span>{typeof f === 'string' ? f : JSON.stringify(f)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <ButtonLink to="/register" className="mt-6" block>
                Get started
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-center text-sm text-ink-600">
        Already have a workspace?{' '}
        <a href="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </a>{' '}
        and open Settings → Subscription to choose a plan.
      </p>
    </div>
  );
}
