import { BusinessPlanCard } from '../components/BusinessPlanCard';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { PublicFAQ } from '../components/PublicContent';
import { EmptyState, ErrorState } from '@/components/feedback';
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
          New workspaces start with a 15-day free trial of Starter. Other tiers are paid plans.
          Upgrade at any time in Settings. Internet service is supplied separately.
        </p>
      </header>
      {pricing.isPending ? (
        <ul className="public-business-grid">
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
        <ul className="public-business-grid">
          {pricing.data.map((plan) => (
            <li key={plan.id}>
              <BusinessPlanCard plan={plan} heading="h2" />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-center text-sm text-ink-600">
        Already have a workspace?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>{' '}
        and open Settings → Subscription to choose a plan.
      </p>
      <PublicFAQ />
    </div>
  );
}
