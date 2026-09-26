import { CheckCircle2, RefreshCw, X, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui';
import { formatKobo } from '@/lib/formatting/money';
import { cn } from '@/lib/utilities/cn';
import { useFundingByReference, useVerifyFunding } from '../queries';
import { Alert } from '@/components/feedback';
import { resolveDisplayStatus } from '@/features/payments/paymentStatus';

/** Live status of one top-up (polls the agent's funding list by reference until it settles). */
export function FundingTracker({
  reference,
  onDismiss,
}: {
  reference: string;
  onDismiss: () => void;
}) {
  const funding = useFundingByReference(reference);
  const verify = useVerifyFunding();
  const rawStatus = funding.data?.status ?? (funding.data === null ? 'missing' : 'loading');
  const displayCode = funding.data ? resolveDisplayStatus(funding.data) : (rawStatus as unknown as string);
  const code = displayCode as string;
  const settled = code === 'paid' || code === 'failed' || code === 'reversed';
  const isPaidUnfulfilled = code === 'paid_unfulfilled';
  const isNeedsReview = code === 'needs_review';
  return (
    <section
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-card border p-4',
        code === 'paid' && 'border-success-100 bg-success-50',
        (code === 'failed' || code === 'reversed') && 'border-danger-100 bg-danger-50',
        code === 'paid_unfulfilled' && 'border-warning-100 bg-warning-50',
        !settled && !isPaidUnfulfilled && 'border-border bg-surface',
      )}
    >
      {code === 'paid' ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-700" aria-hidden />
      ) : code === 'failed' || code === 'reversed' ? (
        <XCircle className="mt-0.5 size-5 shrink-0 text-danger-700" aria-hidden />
      ) : isPaidUnfulfilled ? (
        <Clock className="mt-0.5 size-5 shrink-0 text-warning-700" aria-hidden />
      ) : (
        <RefreshCw className={cn('mt-0.5 size-5 shrink-0 text-brand-700', funding.isFetching && 'animate-spin')} aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-ink-900">
          {code === 'paid' ? `Top-up of ${formatKobo(funding.data?.amount)} received` : code === 'paid_unfulfilled' ? 'Payment confirmed, wallet credit is being recovered. Do not fund again for this transaction.' : code === 'failed' ? 'Top-up failed — nothing was added' : code === 'reversed' ? 'Top-up reversed — contact support' : isNeedsReview ? 'Confirmation is taking longer than expected. We are still checking.' : rawStatus === 'missing' ? 'We could not find this top-up' : 'Waiting for Paystack to confirm your top-up'}
        </h2>
        <p className="mt-0.5 text-xs text-ink-500">
          Reference <code className="font-mono">{reference}</code>
          {!settled && !isPaidUnfulfilled && rawStatus !== 'missing' && ' · checking every few seconds'}
          {isPaidUnfulfilled && ' · payment confirmed, recovering wallet credit automatically'}
        </p>
        {verify.error && <Alert tone="warning">{verify.error.message}</Alert>}
        {!settled && rawStatus !== 'missing' && (
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => verify.mutate(reference)} loading={verify.isPending}>Check now</Button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded p-1 text-ink-400 hover:text-ink-700"
      >
        <X className="size-4" aria-hidden />
      </button>
    </section>
  );
}
