import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { useSubscription } from '@/features/settings/queries';
import { ButtonLink, Card } from '@/components/ui';
import { formatDateTime } from '@/lib/formatting/dates';

export function SubscriptionSummary() {
  const principal = usePrincipal();
  const allowed = can(principal, 'subscription.view');
  const query = useSubscription(allowed);
  if (!allowed) return null;
  const s = query.data;
  const days = s
    ? Math.max(0, Math.ceil((Date.parse(s.expires_at) - query.dataUpdatedAt) / 86400000))
    : null;
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="font-semibold">Subscription status</h2>
        {s ? (
          <>
            <p className="mt-1 text-sm">
              {s.entitlements?.terms.name ?? s.plan_name} ·{' '}
              {s.is_expired ? 'Expired' : s.is_trial ? 'Trial' : s.status}
            </p>
            <p className="mt-1 text-xs text-ink-500">
              Expires {formatDateTime(s.expires_at)} · {days} days remaining
            </p>
            {s.entitlements && (
              <p className="mt-1 text-xs text-ink-500">
                Routers {s.entitlements.routers_used} /{' '}
                {s.entitlements.terms.max_routers ?? 'Unlimited'}
              </p>
            )}
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-500">
            {query.isPending
              ? 'Loading subscription…'
              : 'Subscription details unavailable. Open billing to review.'}
          </p>
        )}
        {query.isError && s && (
          <p className="mt-1 text-xs text-amber-700">
            Subscription refresh failed; showing the previous observation.
          </p>
        )}
        {s && days !== null && days <= 7 && (
          <p className="mt-2 text-sm font-semibold text-amber-700">
            {s.is_expired ? 'Renew to restore your services.' : 'Your subscription expires soon.'}
          </p>
        )}
      </div>
      <ButtonLink to="/settings/subscription" variant="secondary">
        Renew / upgrade
      </ButtonLink>
    </Card>
  );
}
