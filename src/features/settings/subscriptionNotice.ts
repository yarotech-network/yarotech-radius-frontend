import type { TenantSubscription } from '@/types/api';

export function subscriptionNotice(subscription: TenantSubscription | null, now: number) {
  if (!subscription) return { text: 'No active subscription', attention: true };
  if (subscription.status === 'cancelled')
    return { text: 'Your subscription is cancelled', attention: true };
  const expires = Date.parse(subscription.expires_at);
  if (
    subscription.is_expired ||
    subscription.status === 'expired' ||
    (Number.isFinite(expires) && expires <= now)
  ) {
    return { text: 'Your subscription has expired', attention: true };
  }
  if (!Number.isFinite(expires))
    return { text: 'Subscription expiry is unavailable', attention: true };
  const minutes = Math.max(1, Math.ceil((expires - now) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remaining = `${days ? `${days}d ` : ''}${hours ? `${hours}h ` : ''}${minutes % 60}m`;
  const trial = subscription.status === 'trial' || subscription.is_trial;
  const name = subscription.entitlements?.terms.name || subscription.plan_name;
  return {
    text: trial
      ? `Your free trial ends in ${remaining}`
      : `${name} subscription expires in ${remaining}`,
    attention: trial || expires - now <= 7 * 86400_000,
  };
}
