import { useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import { Button, ButtonLink } from '@/components/ui';
import { Alert, EmptyState, ErrorState } from '@/components/feedback';
import { cn } from '@/lib/utilities/cn';
import { errorMessage, isApiError } from '@/services/api/errors';
import { paymentFulfilled, usePaymentResult, useVerifyPaymentResult } from '../queries';
import { pendingCheckout } from '../pendingCheckout';
import { AccessCodePanel } from '../components/AccessCodePanel';
import { ConnectNow } from '../components/ConnectNow';
import { isPollableDisplayStatus, resolveDisplayStatus } from '@/features/payments/paymentStatus';

/**
 * `/pay/result?reference=` is the voucher return destination supplied by the backend to Paystack.
 * Falls back to the locally remembered checkout when the reference is missing.
 *
 * On success the backend returns the voucher's access code only while the voucher is unused; once
 * the customer has logged in, the page shows fulfillment status without repeating credentials.
 */
export default function PaymentResultPage() {
  const [params] = useSearchParams();
  const remembered = useMemo(() => pendingCheckout.load(), []);
  const reference =
    params.get('reference') ??
    params.get('trxref') ??
    (remembered?.kind === 'voucher' || remembered?.kind === 'iot' ? remembered.reference : null);
  const slug = remembered?.reference === reference ? remembered.slug : undefined;
  const result = usePaymentResult(reference);
  const verification = useVerifyPaymentResult();
  const { mutate: verify } = verification;
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    if (reference && result.data && attempted.current !== reference) {
      const code = resolveDisplayStatus(result.data);
      // Legacy backends without display_status_code: verify once while the
      // voucher has not been issued yet (pre-existing recovery behavior).
      const legacyUnfulfilled =
        !result.data.display_status_code &&
        result.data.status === 'success' &&
        !paymentFulfilled(result.data);
      if (isPollableDisplayStatus(code) || legacyUnfulfilled) {
        attempted.current = reference;
        verify(reference);
      }
    }
  }, [reference, result.data, verify]);

  useEffect(() => {
    document.title = 'Payment result · Yarotech RADIUS';
  }, []);
  useEffect(() => {
    if (!result.data) return;
    const code = resolveDisplayStatus(result.data);
    if (code === 'paid' || code === 'failed' || code === 'reversed') pendingCheckout.clear();
  }, [result.data]);

  if (!reference) {
    return (
      <div className="mx-auto w-full max-w-lg py-10">
        <h1 className="public-section-title mb-6">Payment result</h1>
        <EmptyState
          icon={<Clock className="size-6" aria-hidden />}
          title="No payment to check"
          description="Open the link from your payment receipt, or start a new purchase from the storefront link you were given."
        />
      </div>
    );
  }

  return (
    <div className="public-payment-result py-6">
      <p className="public-eyebrow">Your purchase</p>
      <h1 className="text-2xl font-semibold text-brand-950">Payment result</h1>
      <p className="mt-1 text-sm text-ink-500">
        Reference <code className="font-mono break-all text-ink-700">{reference}</code>
      </p>
      <div className="mt-6">
        {result.isPending ? (
          <div
            className="h-48 animate-pulse rounded-card border border-border bg-surface"
            aria-busy
          />
        ) : result.isError ? (
          isApiError(result.error) && result.error.status === 404 ? (
            <Alert tone="danger" title="We could not find this payment">
              Check the reference on your payment receipt. If you were charged, contact the
              business with that reference.
            </Alert>
          ) : (
            <ErrorState
              error={result.error}
              onRetry={() => void result.refetch()}
              title="Could not check the payment"
            />
          )
        ) : (() => {
          const code = resolveDisplayStatus(result.data);
          if (code === 'paid') {
            return (
              <section aria-live="polite" className="rounded-card border border-success-100 bg-success-50 p-5">
                <div className="flex items-center gap-2 text-success-700">
                  <CheckCircle2 className="size-6" aria-hidden />
                  <h2 className="text-lg font-semibold">Payment successful</h2>
                </div>
                {result.data.kind === 'iot' && paymentFulfilled(result.data) ? (
                  <div className="mt-3 space-y-3">
                    <p>Device access has been granted. Registration status: {result.data.device_status}.</p>
                    <p>Expires: {result.data.expires_at ? new Date(result.data.expires_at).toLocaleString() : 'No deadline'}.</p>
                    <p>Keep your renewal token private. You will need it to renew this device.</p>
                    <label className="block">Renewal token<textarea readOnly className="mt-2 w-full rounded border p-2 break-all" value={result.data.renewal_token ?? ''} /></label>
                    <p>Connection depends on the assigned router. Contact the business if the device cannot connect.</p>
                  </div>
                ) : result.data.code_revealed === true && result.data.access_code ? (
                  <>
                    <AccessCodePanel code={result.data.access_code} tenantName={result.data.tenant_name} plan={result.data.plan ?? null} emailMasked={result.data.customer_email_masked} />
                    <ConnectNow url={paymentFulfilled(result.data) ? result.data.captive_portal_url : null} />
                  </>
                ) : paymentFulfilled(result.data) ? (
                  <>
                    <p className="mt-3 text-sm text-ink-700">Your voucher has been issued. Its credentials are not shown on this page.</p>
                    <ConnectNow url={result.data.captive_portal_url} />
                    <p className="mt-3 text-sm text-ink-600">Check your purchase email, or contact {result.data.tenant_name ?? 'the business'} with this reference for help.</p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-ink-700">Your payment went through. Your access code is being prepared — this page will keep checking{result.data.customer_email_masked ? `, and a copy will be emailed to ${result.data.customer_email_masked}` : ''}.</p>
                )}
              </section>
            );
          }
          if (code === 'paid_unfulfilled') {
            return (
              <section aria-live="polite" className="rounded-card border border-warning-100 bg-warning-50 p-5">
                <div className="flex items-center gap-2 text-warning-700">
                  <Clock className="size-6" aria-hidden />
                  <h2 className="text-lg font-semibold">Payment confirmed</h2>
                </div>
                <Alert tone="warning" className="mt-3" title="Your payment has been confirmed. Do not make another payment for this purchase." />
                <p className="mt-3 text-sm text-ink-700">Your access/service is still being prepared. We are recovering it automatically. This may take a moment.</p>
                <p className="mt-2 text-sm text-ink-600">If this persists, contact {result.data.tenant_name ?? 'support'} with reference <code className="font-mono">{reference}</code>.</p>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => verify(reference)} loading={verification.isPending}>Check again</Button>
                  <ButtonLink to={`/s/${slug ?? ''}`} variant="secondary" size="sm">Contact support</ButtonLink>
                </div>
              </section>
            );
          }
          if (code === 'pending') {
            return (
              <section aria-live="polite" className="rounded-card border border-border bg-surface p-5">
                <div className="flex items-center gap-2 text-brand-700">
                  <RefreshCw className={cn('size-5', result.isFetching && 'animate-spin')} aria-hidden />
                  <h2 className="text-lg font-semibold">{result.data.payment_verified ? 'Payment confirmed; access code pending' : 'Waiting for confirmation'}</h2>
                </div>
                <p className="mt-2 text-sm text-ink-600">{result.data.payment_verified ? 'Your payment is confirmed, but the access code could not yet be issued. Check again or contact the business with this reference. Do not pay again.' : 'This payment has not yet been verified by the business. If your payment provider confirmed success, select Check again. Do not start another payment if you were charged.'}</p>
                <Button className="mt-4" variant="secondary" size="sm" onClick={() => verify(reference)} loading={verification.isPending}>Check again</Button>
              </section>
            );
          }
          if (code === 'needs_review') {
            return (
              <section aria-live="polite" className="rounded-card border border-warning-100 bg-warning-50 p-5">
                <div className="flex items-center gap-2 text-warning-700">
                  <Clock className="size-6" aria-hidden />
                  <h2 className="text-lg font-semibold">Confirmation is taking longer than expected</h2>
                </div>
                <p className="mt-2 text-sm text-ink-600">We are still checking the payment automatically. This can happen when the provider is slow to confirm.</p>
                <p className="mt-2 text-sm font-medium text-ink-700">Do not make another payment for this purchase.</p>
                <Button className="mt-4" variant="secondary" size="sm" onClick={() => verify(reference)} loading={verification.isPending}>Check payment</Button>
              </section>
            );
          }
          if (code === 'reversed') {
            return (
              <section aria-live="polite" className="rounded-card border border-danger-100 bg-danger-50 p-5">
                <div className="flex items-center gap-2 text-danger-700">
                  <XCircle className="size-6" aria-hidden />
                  <h2 className="text-lg font-semibold">Payment reversed</h2>
                </div>
                <p className="mt-2 text-sm text-ink-700">The provider reports that this payment was reversed. If value was already delivered, contact support with reference <code className="font-mono">{reference}</code>.</p>
              </section>
            );
          }
          // failed
          return (
            <section aria-live="polite" className="rounded-card border border-danger-100 bg-danger-50 p-5">
              <div className="flex items-center gap-2 text-danger-700">
                <XCircle className="size-6" aria-hidden />
                <h2 className="text-lg font-semibold">{result.data.status === 'abandoned' ? 'Payment not completed' : 'Payment failed'}</h2>
              </div>
              <p className="mt-2 text-sm text-ink-700">This order is not confirmed as paid. If you were charged, contact the business with this reference before paying again.</p>
              {slug && <ButtonLink to={`/s/${slug}`} variant="secondary" size="sm" className="mt-3">Try another payment</ButtonLink>}
            </section>
          );
        })()}
      </div>
      {verification.isError && result.data && !paymentFulfilled(result.data) && (
        <Alert tone="warning" className="mt-4">
          {errorMessage(verification.error)}
        </Alert>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        {slug && (
          <ButtonLink to={`/s/${slug}`} variant="secondary">
            Back to plans
          </ButtonLink>
        )}
        <Link to="/" className="inline-flex items-center text-sm text-ink-500 hover:text-ink-900">
          Home
        </Link>
      </div>
    </div>
  );
}
