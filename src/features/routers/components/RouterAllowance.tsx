import { Link } from 'react-router';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { useSubscription } from '@/features/settings/queries';

export function RouterAllowance() {
  const principal = usePrincipal();
  const permitted = principal.kind === 'member' && can(principal, 'subscription.view');
  const query = useSubscription(permitted);
  if (!permitted) return null;
  const entitlements = query.data?.entitlements;
  const limit = entitlements?.terms.max_routers;
  const known = !query.isError && entitlements !== undefined && limit !== undefined;
  return (
    <section className="router-allowance" aria-label="Router allowance">
      <div>
        <span className="router-eyebrow">Router allowance</span>
        <p className="router-allowance-value">
          {query.isPending
            ? 'Loading allowance...'
            : known
              ? `${entitlements.routers_used} / ${limit === null ? 'Unlimited' : limit}`
              : 'Allowance unavailable'}
        </p>
        <p className="text-xs text-ink-500">
          {known && limit !== null && entitlements.routers_used >= limit
            ? 'Router limit reached. Review your plan before adding a device.'
            : 'Registered devices across your workspace.'}
        </p>
      </div>
      <Link
        to="/settings/subscription"
        className="text-sm font-semibold text-brand-700 hover:underline"
      >
        View plan
      </Link>
      {query.isError && (
        <button
          type="button"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
          className="text-sm font-semibold text-brand-700"
        >
          Retry allowance
        </button>
      )}
    </section>
  );
}
