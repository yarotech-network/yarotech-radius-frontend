import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Store, Wallet } from 'lucide-react';
import { Button, FormField, Input } from '@/components/ui';
import { Alert, EmptyState, ErrorState } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { formatKobo } from '@/lib/formatting/money';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { cn } from '@/lib/utilities/cn';
import { isApiError } from '@/services/api/errors';
import { PlanCard, PlanCardSkeleton } from '@/features/storefront/components/PlanCard';
import type { AgentVoucherAllocation, PublicPlan } from '@/types/api';
import { useAgentWallet, useAgentPlans, useGenerateVouchers } from '../queries';
import { sellCost, sellSchema, type SellInput, type SellOutput } from '../sellSchema';
import { SaleResult } from '../components/SaleResult';
import { usePrincipal } from '@/app/auth/useAuth';
import { loadPendingSale, savePendingSale, clearPendingSale } from '../pendingSale';

const FIELDS = ['plan_id', 'quantity'] as const;

export default function AgentSellPage() {
  const principal = usePrincipal();
  const scope = `${principal?.user.id}:${principal?.user.tenant_id}`;
  useEffect(() => { document.title = 'Sell vouchers - Agent portal'; }, []);
  return <SellForm key={scope} scope={scope} />;
}

function SellForm({ scope }: { scope: string }) {
  const plans = useAgentPlans();
  const wallet = useAgentWallet();
  const generate = useGenerateVouchers();
  const [remembered] = useState(() => loadPendingSale(scope));
  const [idempotencyKey, setIdempotencyKey] = useState(() => remembered?.key ?? newIdempotencyKey('agent-gen'));
  const [unresolvedPayload, setUnresolvedPayload] = useState<string | null>(() => remembered ? JSON.stringify(remembered.payload) : null);
  const [sold, setSold] = useState<{ vouchers: AgentVoucherAllocation[]; planName: string } | null>(
    null,
  );

  const form = useForm<SellInput, unknown, SellOutput>({
    resolver: zodResolver(sellSchema),
    defaultValues: remembered?.payload ?? { plan_id: 0, quantity: 1 },
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, FIELDS);
  const errors = form.formState.errors;
  const planId = useWatch({ control: form.control, name: 'plan_id' });
  const quantityRaw = useWatch({ control: form.control, name: 'quantity' });
  const quantity = Number(quantityRaw);
  const plan = useMemo(
    () => plans.data?.results.find((p) => p.id === planId) ?? null,
    [plans.data, planId],
  );
  const pricingAvailable = plan != null && Number.isSafeInteger(plan.agent_cost);
  const cost = plan && pricingAvailable ? sellCost(plan.agent_cost, quantity) : 0;
  const margin = plan && pricingAvailable ? sellCost(plan.commission_amount, quantity) : 0;
  const balance = wallet.data?.balance ?? null;
  const short = balance !== null && cost > balance;

  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    const payload = { plan_id: values.plan_id, quantity: values.quantity };
    const fingerprint = JSON.stringify(payload);
    if (unresolvedPayload && unresolvedPayload !== fingerprint) {
      form.setError('root', { message: 'Retry the original sale before changing the plan or quantity. Its outcome has not been confirmed.' });
      return;
    }
    setUnresolvedPayload(fingerprint);
    try {
      savePendingSale(scope, { key: idempotencyKey, payload });
      const res = await generate.mutateAsync({
        payload,
        idempotencyKey,
      });
      setSold({ vouchers: res.vouchers, planName: plan?.name ?? 'Voucher' });
      clearPendingSale(scope);
      setIdempotencyKey(newIdempotencyKey('agent-gen'));
      setUnresolvedPayload(null);
      form.reset({ plan_id: 0, quantity: 1 });
    } catch (error) {
      if (isApiError(error) && error.status === 400) {
        clearPendingSale(scope);
        setIdempotencyKey(newIdempotencyKey('agent-gen'));
        setUnresolvedPayload(null);
      }
      if (isApiError(error) && /insufficient/i.test(error.message)) {
        form.setError('root', { message: 'insufficient' });
        return;
      }
      captureError(error);
    }
  });

  if (sold) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-brand-950">Sell vouchers</h1>
        <SaleResult
          vouchers={sold.vouchers}
          planName={sold.planName}
          onDone={() => setSold(null)}
        />
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="space-y-5"
      aria-label="Sell vouchers"
    >
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-brand-950">Sell vouchers</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-500">
            <Store className="size-4" aria-hidden />
            Your operator's enabled plans
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-ink-700">
          <Wallet className="size-4 text-ink-400" aria-hidden />
          Balance{' '}
          <strong className="tabular-nums">
            {wallet.isPending ? '…' : balance !== null ? formatKobo(balance) : '—'}
          </strong>
        </p>
      </header>

      {message && <Alert tone="danger">{message}</Alert>}
      {unresolvedPayload && <Alert tone="warning">This sale has not been confirmed. Retry the same plan and quantity to check its result before starting another sale.</Alert>}
      {errors.root?.message && errors.root.message !== 'insufficient' && <Alert tone="warning">{errors.root.message}</Alert>}
      {plan && !pricingAvailable && <Alert tone="warning">Agent pricing is unavailable. Refresh the catalogue before selling.</Alert>}
      {errors.root?.message === 'insufficient' && (
        <Alert
          tone="warning"
          title="Not enough in your wallet"
          actions={
            <Link
              to="/agent/wallet?fund=1"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Fund wallet
            </Link>
          }
        >
          This sale needs {formatKobo(cost)}; your balance is{' '}
          {balance !== null ? formatKobo(balance) : 'lower than that'}.
        </Alert>
      )}

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-900">
          1. Choose a plan{' '}
          {errors.plan_id && (
            <span className="font-normal text-danger-600"> — {errors.plan_id.message}</span>
          )}
        </legend>
        {plans.isPending ? (
          <div className="grid gap-3 sm:grid-cols-2" aria-busy>
            {[0, 1].map((i) => (
              <PlanCardSkeleton key={i} />
            ))}
          </div>
        ) : plans.isError ? (
          <ErrorState
            error={plans.error}
            onRetry={() => void plans.refetch()}
            title="Could not load plans"
          />
        ) : plans.data.results.length === 0 ? (
          <EmptyState
            title="No plans to sell"
            description="Your operator has not published any active plans."
          />
        ) : (
          <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-2">
            {plans.data.results.map((p) => (
              <PlanOption
                key={p.id}
                plan={p}
                checked={p.id === planId}
                onSelect={() =>
                  form.setValue('plan_id', p.id, { shouldValidate: true, shouldDirty: true })
                }
              />
            ))}
          </div>
        )}
      </fieldset>

      <FormField
        label="2. How many?"
        required
        error={errors.quantity?.message}
        hint="Up to 100 per sale."
        className="max-w-xs"
      >
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={100}
          step={1}
          {...form.register('quantity')}
        />
      </FormField>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs text-ink-500">Wallet will be charged</div>
          {pricingAvailable && <p className="text-sm text-ink-500">Your margin: {formatKobo(margin)} ({plan?.commission_rate}%). Retained from the retail price.</p>}
          <div
            className={cn(
              'text-xl font-semibold tabular-nums',
              short ? 'text-danger-700' : 'text-ink-900',
            )}
          >
            {formatKobo(cost)}
          </div>
          {short && (
            <div className="text-xs text-danger-700">
              Exceeds your balance by {formatKobo(cost - (balance ?? 0))}.
            </div>
          )}
        </div>
        <Button
          type="submit"
          size="lg"
          loading={form.formState.isSubmitting}
          disabled={!unresolvedPayload && (!plan || !pricingAvailable || short)}
        >
          {plan && quantity > 1 ? `Sell ${quantity} vouchers` : 'Sell voucher'}
        </Button>
      </div>
    </form>
  );
}

function PlanOption({
  plan,
  checked,
  onSelect,
}: {
  plan: PublicPlan;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="radio"
      aria-checked={checked}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="cursor-pointer rounded-card outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
    >
      <PlanCard plan={plan} selected={checked} />
    </div>
  );
}
