import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Printer, RotateCcw, Ticket } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Button, Card, FormField, Input, SegmentedControl } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { formatKobo } from '@/lib/formatting/money';
import { can } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import { PlanSummary } from '@/features/plans/components/PlanSummary';
import { usePlanOptions } from '@/features/plans/queries';
import type { Voucher } from '@/types/api';
import { PlanPicker } from '../components/PlanPicker';
import { usePrintVouchers } from '../hooks/usePrintVouchers';
import { useGenerateVouchers } from '../queries';
import {
  generateSchema,
  QUANTITY_PRESETS,
  type GenerateInput,
  type GenerateOutput,
} from '../voucherSchemas';

const FIELDS = ['plan_id', 'quantity', 'prefix'] as const;

interface BatchResult {
  vouchers: Voucher[];
  replayed: boolean;
}

export default function GenerateVouchersPage() {
  const principal = usePrincipal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const plans = usePlanOptions(true);
  const generate = useGenerateVouchers();
  const printer = usePrintVouchers();
  const canPrint = can(principal, 'vouchers.print');
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey('gen'));
  const [result, setResult] = useState<BatchResult | null>(null);

  const initialPlan = Number(searchParams.get('plan'));
  const form = useForm<GenerateInput, unknown, GenerateOutput>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      plan_id: Number.isFinite(initialPlan) && initialPlan > 0 ? initialPlan : 0,
      quantity: 20,
      prefix: '',
    },
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, FIELDS);
  const [planIdRaw, quantityRaw] = useWatch({
    control: form.control,
    name: ['plan_id', 'quantity'],
  });
  const planId = Number(planIdRaw);
  const quantity = Number(quantityRaw);
  const selectedPlan = useMemo(
    () => plans.data?.find((p) => p.id === planId),
    [plans.data, planId],
  );
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 100;
  const prefixPlaceholder = selectedPlan?.voucher_prefix
    ? `Defaults to ${selectedPlan.voucher_prefix}`
    : 'Optional';

  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    try {
      const payload = {
        plan_id: values.plan_id,
        quantity: values.quantity,
        ...(values.prefix ? { prefix: values.prefix } : {}),
      };
      const res = await generate.mutateAsync({ payload, idempotencyKey });
      setResult(res);
    } catch (error) {
      captureError(error);
    }
  });

  function startAnother() {
    setResult(null);
    setIdempotencyKey(newIdempotencyKey('gen'));
    form.reset({ plan_id: planId, quantity, prefix: '' });
  }

  if (result) {
    const ids = result.vouchers.map((v) => v.id);
    const first = result.vouchers[0];
    return (
      <>
        <PageHeader
          title="Vouchers generated"
          backTo="/vouchers"
          crumbs={[{ label: 'Vouchers', to: '/vouchers' }, { label: 'Generate' }]}
        />
        <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
          <div className="flex items-start gap-3">
            <CheckCircle2
              className="size-10 shrink-0 rounded-xl bg-success-100 p-2 text-success-600"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-semibold text-brand-950">
                {result.vouchers.length} {result.vouchers.length === 1 ? 'voucher' : 'vouchers'}{' '}
                ready
              </h2>
              <p className="mt-1 text-sm break-words text-ink-600">
                {first ? `${first.plan_name} · ${first.price_display}` : ''}
                {result.replayed &&
                  ' · This batch had already been created (your earlier request was replayed, nothing was duplicated).'}
              </p>
            </div>
          </div>
          <Alert tone="info" className="mt-4">
            Passwords are not shown on screen.{' '}
            {canPrint
              ? 'Print the batch now, or later from the voucher list — each print pulls the credentials fresh from the server.'
              : 'Ask a manager to print the credentials for you.'}
          </Alert>
          <ul
            className="mt-4 grid max-h-80 grid-cols-1 gap-2 overflow-y-auto rounded-card border border-border bg-white p-3 font-mono text-sm sm:grid-cols-2 lg:grid-cols-4"
            aria-label="Generated usernames"
          >
            {result.vouchers.map((v) => (
              <li key={v.id} className="min-w-0">
                <Link
                  to={`/vouchers/${v.id}`}
                  className="block rounded-lg border border-brand-100 bg-brand-50/50 p-3 break-all text-brand-700 hover:bg-brand-100 hover:underline"
                >
                  {v.username}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              leadingIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
              onClick={startAnother}
            >
              Generate another batch
            </Button>
            <Button variant="secondary" onClick={() => navigate('/vouchers?status=unused')}>
              View in list
            </Button>
            {canPrint && (
              <Button
                leadingIcon={<Printer className="h-4 w-4" aria-hidden />}
                loading={printer.printing}
                onClick={() => void printer.print(ids)}
              >
                {printer.progress
                  ? `Preparing ${printer.progress.done}/${printer.progress.total}`
                  : 'Print all'}
              </Button>
            )}
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Generate vouchers"
        description="Choose a plan, set your batch size and review the value before creating access codes."
        backTo="/vouchers"
        crumbs={[{ label: 'Vouchers', to: '/vouchers' }, { label: 'Generate' }]}
      />
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <h2 className="text-lg font-semibold text-brand-950">1. Choose a plan</h2>
            <p className="mt-1 mb-5 text-sm text-ink-500">
              Compare duration, speed and data allowance. Only active plans are listed.
            </p>
            <Controller
              control={form.control}
              name="plan_id"
              render={({ field, fieldState }) => (
                <>
                  <PlanPicker
                    plans={plans.data}
                    loading={plans.isPending}
                    error={plans.error}
                    onRetry={() => void plans.refetch()}
                    value={Number(field.value) || null}
                    onChange={(id) => field.onChange(id)}
                    invalid={Boolean(fieldState.error)}
                    describedBy="plan-error"
                  />
                  {fieldState.error && (
                    <p id="plan-error" className="mt-2 text-sm text-danger-700" role="alert">
                      {fieldState.error.message}
                    </p>
                  )}
                </>
              )}
            />
          </Card>
          <Card>
            <h2 className="text-lg font-semibold text-brand-950">2. Set up your batch</h2>
            <p className="mt-1 mb-5 text-sm text-ink-500">
              Choose a preset or enter 1 to 100 vouchers. Add a prefix to help identify this batch.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="quantity"
                render={({ field, fieldState }) => (
                  <FormField label="Quantity" required error={fieldState.error?.message}>
                    <div className="flex flex-col gap-2">
                      <SegmentedControl
                        ariaLabel="Quantity presets"
                        size="sm"
                        options={QUANTITY_PRESETS.map((n) => ({
                          value: String(n),
                          label: String(n),
                        }))}
                        value={
                          QUANTITY_PRESETS.includes(
                            Number(field.value) as (typeof QUANTITY_PRESETS)[number],
                          )
                            ? String(field.value)
                            : ''
                        }
                        onChange={(v) => field.onChange(Number(v))}
                      />
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        inputMode="numeric"
                        value={field.value as number}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        invalid={Boolean(fieldState.error)}
                        aria-label="Custom quantity"
                      />
                    </div>
                  </FormField>
                )}
              />
              <FormField
                label="Username prefix"
                optionalLabel
                hint={prefixPlaceholder}
                error={form.formState.errors.prefix?.message}
              >
                <Input
                  maxLength={10}
                  className="font-mono uppercase"
                  placeholder="e.g. WK"
                  {...form.register('prefix')}
                />
              </FormField>
            </div>
          </Card>
          {message && <Alert tone="danger">{message}</Alert>}
        </div>
        <aside
          className="min-w-0 xl:sticky xl:top-20 xl:self-start"
          aria-labelledby="batch-review-title"
        >
          <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
            <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Ticket className="size-5" aria-hidden />
            </span>
            <h2 id="batch-review-title" className="text-lg font-semibold text-brand-950">
              3. Review your batch
            </h2>
            <p className="mt-1 text-sm text-ink-500">
              Check the package and quantity before generating.
            </p>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Plan</dt>
                <dd className="min-w-0 text-right font-medium break-words text-ink-900">
                  {selectedPlan?.name ?? '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Price per voucher</dt>
                <dd className="font-medium text-ink-900 tabular-nums">
                  {selectedPlan ? formatKobo(selectedPlan.price) : 'Choose a plan'}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-500">Quantity</dt>
                <dd className="font-medium text-ink-900 tabular-nums">
                  {validQuantity ? quantity : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-2">
                <dt className="text-ink-500">Face value</dt>
                <dd className="font-semibold text-ink-900 tabular-nums">
                  {selectedPlan && validQuantity ? formatKobo(selectedPlan.price * quantity) : '—'}
                </dd>
              </div>
            </dl>
            {selectedPlan && (
              <div className="mt-4 rounded-lg border border-brand-100 bg-white p-3">
                <PlanSummary plan={selectedPlan} />
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-ink-500">
              Face value is the combined selling price of this batch, not a payment collected.
            </p>
            <Button
              type="submit"
              block
              className="mt-4"
              loading={form.formState.isSubmitting}
              disabled={plans.isPending || (plans.data?.length ?? 0) === 0}
            >
              Generate {validQuantity ? quantity : ''} vouchers
            </Button>
            <p className="mt-2 text-xs text-ink-500">
              Once generation is confirmed, review the returned codes and print their credentials.
              Retries of the same request reuse the existing batch protection.
            </p>
          </Card>
        </aside>
      </form>
    </>
  );
}
