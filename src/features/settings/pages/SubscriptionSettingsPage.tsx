import { PlanLimits } from '@/features/settings/components/PlanLimits';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Check, CreditCard, ExternalLink, Layers, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge, Button, Skeleton } from '@/components/ui';
import { Alert, EmptyState, ErrorState, useToast } from '@/components/feedback';
import { StatusBadge } from '@/components/layout';
import { usePrincipal } from '@/app/auth/useAuth';
import { formatDate, formatDateTime, formatRelative } from '@/lib/formatting/dates';
import { formatKobo } from '@/lib/formatting/money';
import { cn } from '@/lib/utilities/cn';
import { errorMessage, isApiError } from '@/services/api/errors';
import { can } from '@/services/auth/principal';
import { isPollableDisplayStatus, resolveDisplayStatus } from '@/features/payments/paymentStatus';
import type { SubscriptionPlan, TenantSubscription } from '@/types/api';
import {
  useCheckout,
  usePricing,
  useSubscription,
  useSubscriptionPayment,
  useVerifySubscriptionPayment,
} from '../queries';
import { SettingsCard } from '../components/SettingsCard';

export default function SubscriptionSettingsPage() {
  const principal = usePrincipal();
  const canCheckout = can(principal, 'subscription.checkout');
  const [params, setParams] = useSearchParams();
  const reference = params.get('reference') ?? params.get('trxref');
  const subscription = useSubscription();
  const pricing = usePricing();
  const checkout = useCheckout();
  const toast = useToast();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  function trackReference(ref: string | null) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (ref) next.set('reference', ref);
        else {
          next.delete('reference');
          next.delete('trxref');
        }
        return next;
      },
      { replace: true },
    );
  }

  async function startCheckout(plan: SubscriptionPlan) {
    setCheckoutError(null);
    try {
      const result = await checkout.mutateAsync({ plan_id: plan.id });
      trackReference(result.reference);
      window.open(result.authorization_url, '_blank', 'noopener');
      toast.info(
        'Paystack opened in a new tab',
        'This page updates automatically once the payment completes.',
      );
    } catch (error) {
      if (isApiError(error) && error.status === 503) {
        const ref = (error.body as { reference?: string } | null)?.reference;
        if (ref) trackReference(ref);
        setCheckoutError(
          'The payment provider is unavailable right now. Check the payment status before starting another checkout.',
        );
      } else setCheckoutError(errorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <SettingsCard
        id="current-plan"
        title="Current plan"
        icon={<Layers />}
        description="Your Yarotech plan for this workspace. It is separate from the account your customers pay into."
      >
        {subscription.isPending ? (
          <Skeleton className="h-40 w-full" />
        ) : subscription.isError ? (
          <ErrorState
            error={subscription.error}
            onRetry={() => void subscription.refetch()}
            compact
            title="Subscription could not be loaded"
          />
        ) : subscription.data ? (
          <CurrentPlan subscription={subscription.data} />
        ) : (
          <EmptyState
            compact
            icon={<CreditCard className="h-6 w-6" aria-hidden />}
            title="No active subscription"
            description={
              canCheckout
                ? 'Choose a plan below to activate this workspace.'
                : 'Ask a workspace owner to choose a plan.'
            }
          />
        )}
      </SettingsCard>

      {reference && canCheckout && (
        <PaymentTracker
          key={reference}
          reference={reference}
          onDismiss={() => trackReference(null)}
        />
      )}

      <SettingsCard
        id="plans"
        title="Plans"
        icon={<CreditCard />}
        description={
          canCheckout
            ? 'Pay securely with Paystack. Upgrades start as soon as payment is confirmed; renewals start when your current paid period ends, so you never lose paid time.'
            : 'Only workspace owners can change the plan.'
        }
      >
        {checkoutError && (
          <Alert tone="warning" className="mb-4" onDismiss={() => setCheckoutError(null)}>
            {checkoutError}
          </Alert>
        )}
        {pricing.isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-56 w-full" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : pricing.isError ? (
          <ErrorState
            error={pricing.error}
            onRetry={() => void pricing.refetch()}
            compact
            title="Plans could not be loaded"
          />
        ) : pricing.data.length === 0 ? (
          <EmptyState
            compact
            title="No plans available"
            description="The platform has not published any subscription plans yet."
          />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {pricing.data.map((plan) => {
              const current =
                (subscription.data?.entitlements?.plan_id ?? subscription.data?.plan) === plan.id &&
                !subscription.data?.is_expired;
              return (
                <li
                  key={plan.id}
                  className={cn(
                    'relative flex flex-col rounded-card border p-5',
                    current
                      ? 'border-brand-500 bg-brand-50/40 ring-1 ring-brand-500'
                      : 'border-border',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-base font-semibold text-ink-900">{plan.name}</h3>
                    {current && (
                      <Badge tone="brand" size="sm">
                        Current
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-3xl font-bold tracking-tight text-ink-900 tabular-nums">
                    {formatKobo(plan.price, { compact: true })}
                  </p>
                  <p className="text-sm text-ink-500">for {plan.duration_days} days</p>
                  <PlanLimits plan={plan} />
                  {plan.features.length > 0 && (
                    <ul className="mt-1.5 space-y-1.5 text-sm text-ink-700">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-success-600" aria-hidden />
                          <span>{typeof f === 'string' ? f : JSON.stringify(f)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {canCheckout && (
                    <Button
                      className="mt-5 w-full"
                      variant={current ? 'secondary' : 'primary'}
                      onClick={() => void startCheckout(plan)}
                      loading={checkout.isPending && checkout.variables?.plan_id === plan.id}
                      disabled={checkout.isPending}
                      trailingIcon={<ExternalLink className="h-4 w-4" aria-hidden />}
                    >
                      {current ? 'Renew' : subscription.data ? 'Switch to this plan' : 'Subscribe'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canCheckout && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-500">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            Checkout opens Paystack in a new tab. This page updates once the payment is confirmed.
          </p>
        )}
      </SettingsCard>
    </div>
  );
}

const DAY_MS = 86_400_000;

function Meter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  /** null = unlimited. */
  limit: number | null | undefined;
}) {
  const bounded = typeof limit === 'number' && limit > 0;
  const ratio = bounded ? Math.min(1, used / limit) : 0;
  return (
    <div className="rounded-control border border-border p-3">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-ink-600">{label}</span>
        <span className="font-semibold text-ink-900 tabular-nums">
          {bounded ? `${used} of ${limit}` : `${used} · unlimited`}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={bounded ? limit : used}
        aria-valuenow={used}
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-fill"
      >
        {bounded && (
          <span
            className={cn(
              'block h-full rounded-full',
              ratio >= 1 ? 'bg-danger-600' : ratio >= 0.8 ? 'bg-warning-600' : 'bg-brand-600',
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

function CurrentPlan({ subscription }: { subscription: TenantSubscription }) {
  const tone = subscription.is_expired ? 'expired' : subscription.status;
  const now = useNow();
  const start = new Date(subscription.started_at).getTime();
  const end = new Date(subscription.expires_at).getTime();
  const daysLeft = Math.max(0, Math.ceil((end - now) / DAY_MS));
  const elapsed = end > start ? Math.min(1, Math.max(0, (now - start) / (end - start))) : 1;
  const entitlements = subscription.entitlements;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl font-semibold text-ink-900">
              {entitlements?.terms.name ?? subscription.plan_name}
            </span>
            <StatusBadge status={tone} size="sm" />
            {subscription.is_trial && (
              <Badge tone="info" size="sm">
                Trial
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-ink-500">Started {formatDate(subscription.started_at)}</p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'text-3xl font-bold tracking-tight tabular-nums',
              subscription.is_expired
                ? 'text-danger-700'
                : daysLeft <= 5
                  ? 'text-warning-700'
                  : 'text-ink-900',
            )}
          >
            {subscription.is_expired ? 'Expired' : `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`}
          </p>
          <p className="text-xs text-ink-500" title={formatDateTime(subscription.expires_at)}>
            {subscription.is_expired ? 'Ended' : 'left · ends'}{' '}
            {formatDate(subscription.expires_at)}
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="Plan period used"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(elapsed * 100)}
        className="h-2 overflow-hidden rounded-full bg-fill"
      >
        <span
          className={cn(
            'block h-full rounded-full',
            subscription.is_expired
              ? 'bg-danger-600'
              : daysLeft <= 5
                ? 'bg-warning-600'
                : 'bg-brand-600',
          )}
          style={{ width: `${elapsed * 100}%` }}
        />
      </div>

      {subscription.is_expired && (
        <Alert tone="warning" title="Subscription expired">
          Choose a plan below to reactivate this workspace.
        </Alert>
      )}

      {entitlements && (
        <section aria-labelledby="allowances-title" className="space-y-3">
          <h3 id="allowances-title" className="text-sm font-semibold text-ink-900">
            {subscription.is_trial ? 'Your trial allowances' : 'Your purchased allowances'}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Meter
              label="Active routers"
              used={entitlements.routers_used}
              limit={entitlements.terms.max_routers}
            />
            <Meter
              label="Vouchers prepared today"
              used={entitlements.vouchers_prepared_today}
              limit={entitlements.terms.daily_voucher_print_limit}
            />
          </div>
          <PlanLimits plan={entitlements.terms} />
          <p className="text-xs text-ink-500">
            Daily voucher counts reset at midnight ({entitlements.timezone}). Same-day reprints are
            free.
          </p>
          {entitlements.upcoming.map((period) => (
            <div
              className="rounded-control border border-dashed border-border p-3"
              key={period.starts_at}
            >
              <p className="text-sm font-semibold text-ink-900">
                Next: {period.terms.name} starts {formatDateTime(period.starts_at)}
              </p>
              <PlanLimits plan={period.terms} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

/** The current time, refreshed every minute so "days left" stays correct without impure renders. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function PaymentTracker({ reference, onDismiss }: { reference: string; onDismiss: () => void }) {
  const payment = useSubscriptionPayment(reference);
  const verification = useVerifySubscriptionPayment(reference);
  const attempted = useRef(false);
  const { mutate: verify } = verification;
  useEffect(() => {
    if (!payment.data) return;
    // Backend remains authoritative: never derive needs_review from timestamps.
    if (isPollableDisplayStatus(resolveDisplayStatus(payment.data)) && !attempted.current) {
      attempted.current = true;
      verify();
    }
  }, [payment.data, verify]);
  if (payment.isPending) return <Alert tone="info" className="mb-6" title="Checking payment…" />;
  if (payment.isError)
    return (
      <Alert
        tone="danger"
        className="mb-6"
        title="Could not check the payment"
        onDismiss={onDismiss}
      >
        {errorMessage(payment.error)} Reference {reference}.
        <Button size="sm" variant="secondary" onClick={() => void payment.refetch()}>
          Retry status check
        </Button>
      </Alert>
    );
  const p = payment.data;
  const code = resolveDisplayStatus(p);
  if (code === 'paid') {
    return (
      <Alert tone="success" className="mb-6" title="Payment confirmed" onDismiss={onDismiss}>
        {formatKobo(p.amount)} received {p.completed_at ? formatRelative(p.completed_at) : ''}. Your
        subscription has been updated.
      </Alert>
    );
  }
  if (code === 'paid_unfulfilled') {
    return (
      <Alert
        tone="warning"
        className="mb-6"
        title="Payment confirmed. Subscription activation is being recovered. Do not pay again."
        onDismiss={onDismiss}
      >
        Your payment has been confirmed. We are recovering your subscription automatically.{' '}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => verify()}
          loading={verification.isPending}
          className="mt-2"
        >
          Check again
        </Button>
      </Alert>
    );
  }
  if (code === 'failed') {
    const abandoned = p.provider_status?.toLowerCase() === 'abandoned';
    return (
      <Alert
        tone="danger"
        className="mb-6"
        title={abandoned ? 'Payment not completed' : 'Payment failed'}
        onDismiss={onDismiss}
      >
        Paystack reported reference {reference} as {abandoned ? 'abandoned' : 'failed'}. Before
        starting another payment, check this reference again in case its status changed.
        <Button
          size="sm"
          variant="secondary"
          onClick={() => verify()}
          loading={verification.isPending}
          className="mt-2"
        >
          Recheck with Paystack
        </Button>
        {verification.isError && <p className="mt-2">{errorMessage(verification.error)}</p>}
      </Alert>
    );
  }
  if (code === 'reversed') {
    return (
      <Alert
        tone="warning"
        className="mb-6"
        title="Payment reversed — contact support"
        onDismiss={onDismiss}
      >
        The provider reports reversed. If subscription was already extended, contact support.
      </Alert>
    );
  }
  if (code === 'needs_review') {
    return (
      <Alert
        tone="warning"
        className="mb-6"
        title="Confirmation is taking longer than expected. We are still checking the payment automatically."
        onDismiss={onDismiss}
        actions={
          <Button
            size="sm"
            variant="secondary"
            onClick={() => verify()}
            disabled={verification.isPending}
            leadingIcon={
              <RefreshCw
                className={cn('h-4 w-4', verification.isPending && 'animate-spin')}
                aria-hidden
              />
            }
          >
            Check now
          </Button>
        }
      >
        Do not make another payment for this reference.{' '}
        {verification.isError && <p className="mt-2">{errorMessage(verification.error)}</p>}
      </Alert>
    );
  }
  return (
    <Alert
      tone="info"
      className="mb-6"
      title="Waiting for Paystack"
      onDismiss={onDismiss}
      actions={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => verify()}
          disabled={verification.isPending}
          leadingIcon={
            <RefreshCw
              className={cn('h-4 w-4', verification.isPending && 'animate-spin')}
              aria-hidden
            />
          }
        >
          Check now
        </Button>
      }
    >
      Payment of {formatKobo(p.amount)} (reference {reference}) is pending. Complete it in the
      Paystack tab, then select Check now if it is still pending. Do not pay again if Paystack has
      already confirmed success.
      {verification.isError && <p className="mt-2">{errorMessage(verification.error)}</p>}
    </Alert>
  );
}
