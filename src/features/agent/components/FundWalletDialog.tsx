import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ExternalLink } from 'lucide-react';
import { Button, Dialog, FormField, Input } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { formatKobo, koboToNairaInput, parseNairaToKobo } from '@/lib/formatting/money';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { cn } from '@/lib/utilities/cn';
import { isApiError } from '@/services/api/errors';
import { pendingCheckout } from '@/features/storefront/pendingCheckout';
import { useFundWallet, useFundingPolicy } from '../queries';
import { fundSchema, QUICK_AMOUNTS_KOBO, type FundInput, type FundOutput } from '../fundSchema';

const FIELDS = ['amount'] as const;

/**
 * Top up via Paystack. The backend returns the agent to `/agent/wallet/return`.
 * The reference is also remembered locally as a fallback; Paystack opens in the same tab.
 */
export function FundWalletDialog({
  open,
  onClose,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  onStarted: (reference: string) => void;
}) {
  const fund = useFundWallet();
  const policy = useFundingPolicy(open);
  const [unresolvedAmount, setUnresolvedAmount] = useState<number | null>(null);
  const [unresolvedTotal, setUnresolvedTotal] = useState<number | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey('fund'));
  const [unavailable, setUnavailable] = useState<string | null>(null);
  const form = useForm<FundInput, unknown, FundOutput>({
    resolver: zodResolver(fundSchema),
    defaultValues: { amount: '' },
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, FIELDS);
  const raw = useWatch({ control: form.control, name: 'amount' });
  const preview = parseNairaToKobo(raw ?? '');
  const basisPoints = Math.round(Number(policy.data?.fee_percent ?? 0) * 100);
  const fee = preview === null ? 0 : Math.floor((preview * basisPoints + 5000) / 10000) + (policy.data?.flat_fee ?? 0);
  const total = (preview ?? 0) + fee;

  function close() {
    form.reset();
    setUnavailable(null);
    resetErrors();
    onClose();
  }

  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    setUnavailable(null);
    if (!policy.data) return;
    if (unresolvedAmount !== null && unresolvedAmount !== values.amount) {
      form.setError('amount', { message: 'Check the previous top-up before changing the amount.' });
      return;
    }
    setUnresolvedAmount(values.amount);
    setUnresolvedTotal(unresolvedTotal ?? total);
    try {
      const result = await fund.mutateAsync({ amount: values.amount, expected_total: unresolvedTotal ?? total, idempotencyKey });
      pendingCheckout.save({ kind: 'wallet', reference: result.reference, amount: result.amount ?? values.amount });
      onStarted(result.reference);
      setIdempotencyKey(newIdempotencyKey('fund'));
      setUnresolvedAmount(null);
      setUnresolvedTotal(null);
      window.location.assign(result.authorization_url);
    } catch (error) {
      if (isApiError(error) && error.status === 400) {
        setIdempotencyKey(newIdempotencyKey('fund'));
        setUnresolvedAmount(null);
        setUnresolvedTotal(null);
        void policy.refetch();
      }
      if (isApiError(error) && error.status === 503) {
        const reference = (error.body as { reference?: string } | null)?.reference ?? null;
        setUnavailable(reference ?? '');
        if (reference) {
          pendingCheckout.save({ kind: 'wallet', reference, amount: values.amount });
          onStarted(reference);
        }
        return;
      }
      captureError(error);
    }
  });

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Fund wallet"
      description="Pay with Paystack. Your balance updates as soon as the payment is confirmed."
      size="sm"
    >
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="flex flex-col gap-4"
        aria-label="Fund wallet"
      >
        {message && <Alert tone="danger">{message}</Alert>}
        {policy.isError && <Alert tone="warning">Could not load funding fees. <Button type="button" onClick={() => void policy.refetch()}>Retry</Button></Alert>}
        {policy.data && preview !== null && <p className="text-sm text-ink-700">Wallet credit: {formatKobo(preview)}. Funding fee: {formatKobo(fee)}. Total: {formatKobo(total)}.</p>}
        {unavailable !== null && (
          <Alert tone="warning" title="Payments are temporarily unavailable">
            Paystack did not confirm the outcome. Check this top-up before starting another payment.
            {unavailable && (
              <span className="mt-1 block text-xs">
                Reference <code className="font-mono">{unavailable}</code>
              </span>
            )}
          </Alert>
        )}
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Quick amounts">
          {QUICK_AMOUNTS_KOBO.map((kobo) => (
            <button
              key={kobo}
              type="button"
              onClick={() =>
                form.setValue('amount', koboToNairaInput(kobo), {
                  shouldValidate: true,
                  shouldDirty: true,
                })
              }
              className={cn(
                'h-9 rounded-control border text-sm font-medium tabular-nums',
                preview === kobo
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-border bg-surface text-ink-700 hover:bg-surface-muted',
              )}
            >
              {formatKobo(kobo, { compact: true })}
            </button>
          ))}
        </div>
        <FormField
          label="Amount (₦)"
          required
          error={form.formState.errors.amount?.message}
          hint="Minimum ₦500. Your operator sets the maximum per top-up."
        >
          <Input
            inputMode="decimal"
            prefix="₦"
            placeholder="2000"
            autoFocus
            {...form.register('amount')}
          />
        </FormField>
        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!policy.data || policy.isFetching}
            loading={form.formState.isSubmitting}
            trailingIcon={<ExternalLink className="size-4" aria-hidden />}
          >
            {preview ? `Pay ${formatKobo(total)}` : 'Continue to Paystack'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
