import { Link } from 'react-router';
import { ArrowUpRight } from 'lucide-react';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { useSubscription } from '@/features/settings/queries';
import { Card } from '@/components/ui';
import { MiniBar } from '@/components/layout';
import { formatNumber } from '@/lib/formatting/units';

/**
 * Router allowance as a compact fleet tile. A failed request reads "unavailable"
 * with a retry, never zero capacity; platform administrators never fetch billing.
 */
export function RouterAllowance() {
  const principal = usePrincipal();
  const permitted = principal.kind === 'member' && can(principal, 'subscription.view');
  const query = useSubscription(permitted);
  if (!permitted) return null;
  const entitlements = query.data?.entitlements;
  const limit = entitlements?.terms.max_routers;
  const known = !query.isError && entitlements !== undefined && limit !== undefined;
  const used = entitlements?.routers_used ?? 0;
  const atLimit = known && limit !== null && used >= limit;
  return (
    <Card padded={false} className="min-w-0 p-3 sm:p-4">
      <section aria-label="Router allowance" className="flex h-full flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-ink-500">Router allowance</p>
          <Link
            to="/settings/subscription"
            aria-label="View plan"
            title="View plan"
            className="shrink-0 text-ink-400 hover:text-brand-600"
          >
            <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </div>
        <p className="truncate text-lg font-semibold tracking-tight text-ink-900 sm:text-xl">
          {query.isPending
            ? 'Loading allowance...'
            : known
              ? `${used} / ${limit === null ? 'Unlimited' : limit}`
              : 'Allowance unavailable'}
        </p>
        {known && limit !== null && limit > 0 && (
          <MiniBar
            parts={[
              {
                value: Math.min(used, limit),
                color: atLimit ? 'var(--color-warning-600)' : 'var(--color-brand-500)',
              },
              { value: Math.max(0, limit - used), color: 'transparent' },
            ]}
          />
        )}
        <p className={atLimit ? 'text-xs text-warning-700' : 'text-xs text-ink-500'}>
          {atLimit
            ? 'Router limit reached. Review your plan before adding a device.'
            : known && limit !== null
              ? `${formatNumber(limit - used)} more routers allowed on your plan.`
              : 'Registered devices across your workspace.'}
        </p>
        {query.isError && (
          <button
            type="button"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
            className="self-start text-xs font-semibold text-brand-700 hover:underline"
          >
            Retry allowance
          </button>
        )}
      </section>
    </Card>
  );
}
