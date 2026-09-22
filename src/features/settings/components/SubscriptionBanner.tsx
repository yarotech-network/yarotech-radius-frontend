import { useEffect, useState } from 'react';
import { ArrowRight, Clock3, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import { usePrincipal } from '@/app/auth/useAuth';
import { can } from '@/services/auth/principal';
import { subscriptionNotice, SUBSCRIPTION_NOTICE_WINDOW } from '../subscriptionNotice';
import { useSubscription } from '../queries';

export function SubscriptionBanner() {
  const principal = usePrincipal();
  const permitted = principal.kind === 'member' && can(principal, 'subscription.view');
  const subscription = useSubscription(permitted);
  const [now, setNow] = useState(Date.now);
  const expiresAt = subscription.data?.expires_at;
  useEffect(() => {
    if (!permitted || !expiresAt) return;
    const update = () => setNow(Date.now());
    const interval = window.setInterval(update, 60_000);
    // Wake at the exact visibility/expiry boundary rather than waiting a full minute.
    const expiry = Date.parse(expiresAt);
    const boundary = [expiry - SUBSCRIPTION_NOTICE_WINDOW, expiry].find((time) => time > now);
    const boundaryTimer = boundary !== undefined && boundary - now <= 60_000
      ? window.setTimeout(update, Math.max(0, boundary - Date.now()))
      : undefined;
    window.addEventListener('focus', update);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(boundaryTimer);
      window.removeEventListener('focus', update);
    };
  }, [permitted, expiresAt, now]);
  if (!permitted) return null;
  const notice = subscription.isPending
    ? { text: 'Checking your subscription...', attention: false }
    : subscription.isError
      ? { text: 'Subscription status is unavailable', attention: true }
      : subscriptionNotice(subscription.data ?? null, now);
  const canRenew = can(principal, 'subscription.checkout');
  if (!notice) return null;
  return (
    <section
      aria-label="Workspace subscription"
      className={`subscription-banner ${notice.attention ? 'subscription-banner-attention' : ''}`}
    >
      <div className="subscription-banner-message">
        <Clock3 className="size-4 shrink-0" aria-hidden />
        <p>{notice.text}</p>
      </div>
      <div className="subscription-banner-actions">
        {subscription.isError && (
          <button
            type="button"
            onClick={() => void subscription.refetch()}
            disabled={subscription.isFetching}
            aria-label="Retry subscription status"
          >
            <RefreshCw className="size-4" aria-hidden />
          </button>
        )}
        <Link to="/settings/subscription">
          {!subscription.isPending && !subscription.isError && canRenew && notice.attention
            ? subscription.data
              ? 'Renew plan'
              : 'Choose a plan'
            : 'View billing'}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
