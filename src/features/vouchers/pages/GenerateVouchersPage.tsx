import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Printer, RotateCcw } from 'lucide-react';
import { Button, Card, FormField, Input, Select } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { PageHeader } from '@/components/layout';

import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { formatKobo } from '@/lib/formatting/money';
import { can } from '@/services/auth/principal';
import { usePrincipal } from '@/app/auth/useAuth';
import { usePlanOptions } from '@/features/plans/queries';
import type { Voucher } from '@/types/api';
import { PlanCombobox } from '../components/PlanCombobox';
import { usePrintVouchers } from '../hooks/usePrintVouchers';
import { useGenerateVouchers } from '../queries';
import {
  generateSchema,
  type GenerateInput,
  type GenerateOutput,
} from '../voucherSchemas';

const FIELDS = ['plan_id', 'quantity', 'device_limit'] as const;

interface BatchResult {
  vouchers: Voucher[];
  replayed: boolean;
}

export default function GenerateVouchersPage({ embedded = false, onDone }: { embedded?: boolean; onDone?: () => void }) {
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
      device_limit: 1,
      prefix: '',
    },
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, FIELDS);
  const [planIdRaw, quantityRaw, deviceLimitRaw] = useWatch({
    control: form.control,
    name: ['plan_id', 'quantity', 'device_limit'],
  });
  const planId = Number(planIdRaw);
  const quantity = Number(quantityRaw);
  const deviceLimit = Number(deviceLimitRaw ?? 1);
  const [previousPayload, setPreviousPayload] = useState('');
  const selectedPlan = useMemo(
    () => plans.data?.find((p) => p.id === planId),
    [plans.data, planId],
  );
  const maxDevices = Math.max(1, Math.min(10, selectedPlan?.max_devices ?? 1));
  // Clamp the device selection when the selected plan changes to one with a
  // lower ceiling, so a stale value can never be submitted.
  useEffect(() => {
    if (selectedPlan && deviceLimit > maxDevices) {
      form.setValue('device_limit', maxDevices, { shouldValidate: true });
    }
  }, [form, selectedPlan, maxDevices, deviceLimit]);
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 100;

  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    try {
      if (!plans.data?.some((plan) => plan.id === values.plan_id)) {
        form.setError('plan_id', { message: 'Choose an active plan.' });
        return;
      }
      if (values.device_limit > maxDevices) {
        form.setError('device_limit', {message: `Choose at most ${maxDevices} device(s).`});
        return;
      }
      const payload = {
        plan_id: values.plan_id,
        quantity: values.quantity,
        ...(values.device_limit > 1 ? {device_limit: values.device_limit} : {}),
        ...(values.prefix ? { prefix: values.prefix } : {}),
      };
      const fingerprint = JSON.stringify(payload);
      const key = previousPayload && previousPayload !== fingerprint ? newIdempotencyKey('gen') : idempotencyKey;
      setPreviousPayload(fingerprint);
      if (key !== idempotencyKey) setIdempotencyKey(key);
      const res = await generate.mutateAsync({ payload, idempotencyKey: key });
      setResult(res);
    } catch (error) {
      captureError(error);
    }
  });

  function startAnother() {
    setResult(null);
    setIdempotencyKey(newIdempotencyKey('gen'));
    form.reset({ plan_id: planId, quantity, prefix: '', device_limit: deviceLimit });
    setPreviousPayload('');
  }

  if (result) {
    const ids = result.vouchers.map((v) => v.id);
    const first = result.vouchers[0];
    return (
      <div className="space-y-6 rv-portal">
        {!embedded && <PageHeader
          className="rv-portal-header"
          title="Vouchers generated"
          backTo="/vouchers"
          crumbs={[{ label: 'Vouchers', to: '/vouchers' }, { label: 'Generate' }]}
        />}
        <Card className="rv-portal-card">
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
          <div className="rv-portal-table mt-4">
            <table>
              <caption className="sr-only">Generated vouchers</caption>
              <thead>
                <tr>
                  <th scope="col">Voucher code</th>
                  <th scope="col">Plan</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.vouchers.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link
                        to={`/vouchers/${v.id}`}
                        className="font-mono text-sm font-bold tracking-wider break-all text-brand-700 hover:underline"
                      >
                        {v.username}
                      </Link>
                    </td>
                    <td>
                      <span className="font-semibold text-ink-900">{v.plan_name}</span>
                      <span className="mt-0.5 block text-xs text-ink-500">
                        {v.device_limit} device{v.device_limit === 1 ? '' : 's'}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        to={`/vouchers/${v.id}`}
                        aria-label={`View ${v.username}`}
                        className="text-sm font-semibold text-brand-700 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              leadingIcon={<RotateCcw className="h-4 w-4" aria-hidden />}
              onClick={startAnother}
            >
              Generate another batch
            </Button>
            <Button variant="secondary" onClick={() => embedded ? onDone?.() : navigate('/vouchers?status=unused')}>
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
      </div>
    );
  }

  return (
    <div className="space-y-6 rv-portal">
      {/* The same form serves the inventory dialog and bookmarked route. */}
      {!embedded && <div className="rv-portal-header">
        <div className="rv-portal-header-text">
          <p className="rv-portal-eyebrow">Batch Generation</p>
          <h1 className="rv-portal-title">Generate Vouchers</h1>
          <p className="rv-portal-desc">
            Choose a plan and quantity, then generate your access codes.
          </p>
        </div>
        <div className="rv-portal-actions">
          <Link
            to="/vouchers"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-semibold text-ink-700 transition hover:bg-surface-muted"
          >
            Back to Voucher Desk
          </Link>
        </div>
      </div>}
      <form
        onSubmit={(e) => void submit(e)}
        noValidate
        className="max-w-2xl"
      >
        <Card className="rv-portal-card space-y-5">
          {plans.isError && <Alert tone="danger" actions={<Button type="button" variant="secondary" size="sm" onClick={() => void plans.refetch()}>Retry</Button>}>
            Plans could not be loaded.
          </Alert>}
          {!plans.isPending && !plans.isError && !plans.data?.length && <Alert tone="info">
            No active hotspot plans are available. Create or activate a plan before generating vouchers.
          </Alert>}
          <Controller
            control={form.control}
            name="plan_id"
            render={({ field, fieldState }) => (
              <FormField label="Plan" required error={fieldState.error?.message}
                hint={plans.isPending ? 'Loading active plans…' : 'Type to search your active plans.'}>
                <PlanCombobox
                  plans={plans.data ?? []}
                  value={Number(field.value) || 0}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={plans.isPending || plans.isError || generate.isPending}
                />
              </FormField>
            )}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="quantity"
                render={({ field, fieldState }) => (
                  <FormField label="Quantity" required hint="1 to 100 vouchers per batch." error={fieldState.error?.message}>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      inputMode="numeric"
                      value={field.value as number}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                    />
                  </FormField>
                )}
              />
              <FormField
                label="Devices per voucher"
                error={form.formState.errors.device_limit?.message}
                hint={!selectedPlan
                  ? 'Choose a plan to see how many devices each voucher can allow.'
                  : maxDevices === 1
                    ? 'This plan currently allows one device. To offer more, raise Maximum devices in the plan’s Additional settings and enable multi-device vouchers on the backend.'
                    : `Choose 1 to ${maxDevices} devices. Each added device increases the voucher’s face value.`}
              >
                <Select {...form.register('device_limit')} options={Array.from({length: maxDevices}, (_, i) => ({value:String(i+1), label:`${i+1} device${i ? 's' : ''}`}))} disabled={generate.isPending || maxDevices <= 1} />
              </FormField>
          </div>
          <div className="rounded-control border border-border bg-surface-muted p-3 text-sm text-ink-700" aria-live="polite">
            Face value: <strong className="text-ink-900">{selectedPlan && validQuantity ? formatKobo(selectedPlan.price * deviceLimit * quantity) : 'Choose a plan and quantity'}</strong>
            <p className="mt-1 text-xs text-ink-500">Potential selling value, not money collected.</p>
          </div>
          {message && <Alert tone="danger">{message}</Alert>}
          <Button
            type="submit"
            block
            loading={form.formState.isSubmitting}
            disabled={plans.isPending || plans.isError || (plans.data?.length ?? 0) === 0}
          >
            Generate {validQuantity ? quantity : ''} vouchers
          </Button>
        </Card>
      </form>
    </div>
  );
}
