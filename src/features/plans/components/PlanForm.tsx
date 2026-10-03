import { planCodeFormatOptions } from '@/lib/voucherCodeFormats';
import { useRouterOptions } from '@/features/routers/queries';
import { useEffect, useId, useState } from 'react';
import { Controller, useForm, useWatch, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Checkbox, FormField, Input, Select } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { isApiError } from '@/services/api/errors';
import { describeDuration, DURATION_UNITS, formToPlan, planFormSchema, planToForm, SPEED_UNITS, type PlanFormInput, type PlanFormOutput } from '../planSchema';
import type { InternetPlan } from '@/types/api';
import { useCreatePlan, useUpdatePlan } from '../queries';

const FIELDS = [
  'plan_type',
  'public_router',
  'is_public',
  'agent_enabled',
  'name',
  'price',
  'duration_value',
  'duration_unit',
  'data_mode',
  'upload_value',
  'upload_unit',
  'download_value',
  'download_unit',
  'data_limit_mb',
  'voucher_prefix',
  'voucher_code_format',
  'is_active',
  'max_devices',
] as const;
const ALIASES = {
  data_limit: 'data_limit_mb',
  duration_hours: 'duration_value',
  rate_limit: 'upload_value',
};
const STEP_ONE_FIELDS = ['name', 'price', 'duration_value', 'duration_unit', 'data_mode', 'data_limit_mb'] as const;
const STEP_ONE_INPUT_IDS: Record<(typeof STEP_ONE_FIELDS)[number], string> = {
  name: 'plan-name',
  price: 'plan-price',
  duration_value: 'plan-duration-value',
  duration_unit: 'plan-duration-unit',
  data_mode: 'plan-data-unlimited',
  data_limit_mb: 'plan-data-limit',
};

/** Fields rendered inside the expandable Additional settings section. */
const ADDITIONAL_FIELDS = [
  'voucher_prefix',
  'voucher_code_format',
  'plan_type',
  'public_router',
  'is_public',
  'agent_enabled',
] as const;

/** Input ids used to move focus into Additional settings after a failed submit. */
const ADDITIONAL_INPUT_IDS: Record<(typeof ADDITIONAL_FIELDS)[number], string> = {
  voucher_prefix: 'plan-voucher-prefix',
  voucher_code_format: 'plan-code-format',
  plan_type: 'plan-service-type',
  public_router: 'plan-assigned-router',
  is_public: 'plan-public-sales',
  agent_enabled: 'plan-agent-sales',
};

export function PlanForm({
  plan,
  onSaved,
  onCancel,
  onDirtyChange,
  onBusyChange,
}: {
  plan?: InternetPlan;
  onSaved: (plan: InternetPlan) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const [idempotencyKey] = useState(() => newIdempotencyKey('plan'));
  const form = useForm<PlanFormInput, unknown, PlanFormOutput>({
    resolver: zodResolver(planFormSchema),
    defaultValues: planToForm(plan),
    mode: 'onTouched',
  });
  const {
    message,
    reset: resetErrors,
    captureError,
  } = useFormSubmit(form.setError, FIELDS, ALIASES);
  const planType = useWatch({ control: form.control, name: 'plan_type' });
  const dataMode = useWatch({ control: form.control, name: 'data_mode' });
  const durationValue = useWatch({ control: form.control, name: 'duration_value' });
  const durationUnit = useWatch({ control: form.control, name: 'duration_unit' });
  const customRate = useWatch({ control: form.control, name: 'custom_rate_limit' });
  const [rateServerError, setRateServerError] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1>(0);
  const stepHeadingId = useId();

  function showStep(next: 0 | 1) {
    setStep(next);
    window.setTimeout(() => document.getElementById(stepHeadingId)?.focus(), 0);
  }

  async function goNext() {
    if (await form.trigger(STEP_ONE_FIELDS, { shouldFocus: true })) showStep(1);
  }

  function focusStepOneError(field: (typeof STEP_ONE_FIELDS)[number]) {
    showStep(0);
    window.setTimeout(() => document.getElementById(STEP_ONE_INPUT_IDS[field])?.focus(), 60);
  }

  useEffect(() => {
    form.reset(planToForm(plan));
  }, [plan, form]);

  const { isDirty, isSubmitting } = form.formState;
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(isSubmitting);
  }, [isSubmitting, onBusyChange]);

  function focusAdditionalError(errors: FieldErrors<PlanFormInput>) {
    const hit = ADDITIONAL_FIELDS.find((field) => errors[field]);
    if (!hit) return;
    const id = ADDITIONAL_INPUT_IDS[hit];
    window.setTimeout(() => document.getElementById(id)?.focus(), 60);
  }

  const submit = form.handleSubmit(
    async (values) => {
      resetErrors();
      setRateServerError(null);
      try {
        const saved = plan
          ? await update.mutateAsync({ id: plan.id, payload: formToPlan(values) })
          : await create.mutateAsync({ payload: formToPlan(values), idempotencyKey });
        onSaved(saved);
      } catch (error) {
        captureError(error);
        // A backend rate_limit error lands on the upload input via aliases in
        // split mode; in custom mode that input is hidden, so surface it here.
        const rateLimitError =
          isApiError(error) && error.fields['rate_limit']?.join(' ');
        if (rateLimitError && (form.getValues('custom_rate_limit') ?? '').trim()) {
          setRateServerError(rateLimitError);
        }
        // Field errors on hidden Additional-settings inputs auto-expand that
        // section (via hasAdditionalErrors); move focus there as well.
        window.setTimeout(() => {
          const firstStepError = STEP_ONE_FIELDS.find((field) => form.getFieldState(field).error);
          if (firstStepError) {
            focusStepOneError(firstStepError);
            return;
          }
          const hit = ADDITIONAL_FIELDS.find((field) => form.getFieldState(field).error);
          if (hit) {
            setAdvanced(true);
            window.setTimeout(
              () => document.getElementById(ADDITIONAL_INPUT_IDS[hit])?.focus(),
              60,
            );
          }
        }, 60);
      }
    },
    (errors) => {
      const firstStepError = STEP_ONE_FIELDS.find((field) => errors[field]);
      if (firstStepError) {
        focusStepOneError(firstStepError);
        return;
      }
      if (ADDITIONAL_FIELDS.some((field) => errors[field])) {
        setAdvanced(true);
        focusAdditionalError(errors);
      }
    },
  );

  const [advanced, setAdvanced] = useState(plan?.plan_type === 'iot_mac');
  const busy = form.formState.isSubmitting;
  const hasAdditionalErrors = ADDITIONAL_FIELDS.some((field) => form.formState.errors[field]);
  const configuredDevices = plan?.configured_max_devices ?? plan?.max_devices ?? 1;
  const effectiveDevices = plan?.max_devices ?? configuredDevices;

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="plan-editor">
      {message && <Alert tone="danger">{message}</Alert>}
      <ol aria-label="Plan setup progress" className="plan-editor-progress">
        {['Plan essentials', 'Access and availability'].map((label, index) => (
          <li key={label} aria-current={step === index ? 'step' : undefined} className={step === index ? 'plan-editor-current-step' : ''}>
            <span aria-hidden>{index + 1}</span> {label}
          </li>
        ))}
      </ol>
      <p className="plan-editor-step-label" role="status">Step {step + 1} of 2: {step === 0 ? 'Plan essentials' : 'Access and availability'}</p>
      <div className="plan-editor-fields">
        {step === 0 ? <>
          <h3 id={stepHeadingId} tabIndex={-1} className="sr-only">Plan essentials</h3>
          <fieldset className="min-w-0 space-y-4 rounded-xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold text-brand-950">Plan essentials</legend>
            <FormField label="Plan name" required error={form.formState.errors.name?.message}>
              <Input
                autoFocus
                id="plan-name"
                placeholder="e.g. 1 Day Unlimited"
                maxLength={100}
                {...form.register('name')}
              />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Price"
                required
                hint="Enter the price in naira (NGN). Customers and agents pay this amount."
                error={form.formState.errors.price?.message}
              >
                <Input
                  id="plan-price"
                  inputMode="decimal"
                  prefix="₦"
                  placeholder="500"
                  {...form.register('price')}
                />
              </FormField>
              <div>
                <span id="plan-duration-label" className="mb-1.5 block text-sm font-medium text-ink-700">
                  Duration <span className="ml-0.5 text-danger-600" aria-hidden>*</span>
                </span>
                <div
                  className="plan-duration-row"
                  role="group"
                  aria-labelledby="plan-duration-label"
                >
                  <Input
                    id="plan-duration-value"
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    placeholder="Amount"
                    aria-label="Duration amount"
                    {...form.register('duration_value')}
                  />
                  <Select
                    id="plan-duration-unit"
                    aria-label="Duration unit"
                    {...form.register('duration_unit')}
                    options={DURATION_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                  />
                </div>
                {(form.formState.errors.duration_value || form.formState.errors.duration_unit) && (
                  <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
                    {form.formState.errors.duration_value?.message ??
                      form.formState.errors.duration_unit?.message}
                  </p>
                )}
                {!form.formState.errors.duration_value && (
                  <p className="mt-1.5 text-xs text-ink-500">
                    {Number(durationValue) > 0
                      ? `Lasts ${describeDuration(Number(durationValue), durationUnit ?? 'hours')} once activated.`
                      : 'How long access lasts once activated.'}
                  </p>
                )}
              </div>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-ink-700">
                Data allowance <span className="ml-0.5 text-danger-600" aria-hidden>*</span>
              </legend>
              <div className="mt-2 flex flex-wrap gap-4" role="radiogroup" aria-label="Data allowance">
                <label htmlFor="plan-data-unlimited" className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    id="plan-data-unlimited"
                    type="radio"
                    value="unlimited"
                    className="size-4 accent-brand-600"
                    {...form.register('data_mode')}
                  />
                  Unlimited data
                </label>
                <label htmlFor="plan-data-limited" className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    id="plan-data-limited"
                    type="radio"
                    value="limited"
                    className="size-4 accent-brand-600"
                    {...form.register('data_mode')}
                  />
                  Limited data
                </label>
              </div>
              <p className="mt-1.5 text-xs text-ink-500">Choose whether this plan has a data cap.</p>
              {form.formState.errors.data_mode && (
                <p role="alert" className="mt-1 text-xs font-medium text-danger-600">
                  {form.formState.errors.data_mode.message}
                </p>
              )}
            </fieldset>
            {dataMode === 'limited' && (
              <FormField
                label="Data limit"
                required
                hint="Only shown for limited plans. Enter whole megabytes, e.g. 1024 for 1 GB."
                error={form.formState.errors.data_limit_mb?.message}
              >
                <Input
                  id="plan-data-limit"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  placeholder="e.g. 1024"
                  trailingSlot={<span className="text-xs text-ink-500">MB</span>}
                  {...form.register('data_limit_mb')}
                />
              </FormField>
            )}
          </fieldset>
        </> : <>
          <h3 id={stepHeadingId} tabIndex={-1} className="sr-only">Access and availability</h3>
          <fieldset className="min-w-0 space-y-4 rounded-xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold text-brand-950">
              Speed
            </legend>
            <p className="text-xs text-ink-500">
              Speeds are measured from the customer&apos;s perspective: upload leaves the
              customer device, download arrives at it. Applies to newly issued access.
            </p>
            {customRate?.trim() ? (
              <div className="space-y-3">
                <Alert tone="warning" title="Custom speed expression">
                  This plan uses <code className="font-mono">{customRate.trim()}</code>, which
                  these fields cannot represent. It stays unchanged until you replace it below.
                </Alert>
                {rateServerError && (
                  <p role="alert" className="text-xs font-medium text-danger-600">
                    {rateServerError}
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    form.setValue('custom_rate_limit', '', { shouldDirty: true });
                    setRateServerError(null);
                    window.setTimeout(
                      () => document.getElementById('plan-upload-speed')?.focus(),
                      60,
                    );
                  }}
                >
                  Enter upload and download speeds
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="plan-upload-speed"
                      className="mb-1.5 block text-sm font-medium text-ink-700"
                    >
                      Upload speed
                    </label>
                    <div className="plan-speed-row">
                      <Input
                        id="plan-upload-speed"
                        inputMode="decimal"
                        placeholder="5"
                        aria-label="Upload speed amount"
                        {...form.register('upload_value')}
                      />
                      <Select
                        id="plan-upload-unit"
                        aria-label="Upload speed unit"
                        {...form.register('upload_unit')}
                        options={SPEED_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                      />
                    </div>
                    {form.formState.errors.upload_value && (
                      <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
                        {form.formState.errors.upload_value.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      htmlFor="plan-download-speed"
                      className="mb-1.5 block text-sm font-medium text-ink-700"
                    >
                      Download speed
                    </label>
                    <div className="plan-speed-row">
                      <Input
                        id="plan-download-speed"
                        inputMode="decimal"
                        placeholder="10"
                        aria-label="Download speed amount"
                        {...form.register('download_value')}
                      />
                      <Select
                        id="plan-download-unit"
                        aria-label="Download speed unit"
                        {...form.register('download_unit')}
                        options={SPEED_UNITS.map((u) => ({ value: u.value, label: u.label }))}
                      />
                    </div>
                    {form.formState.errors.download_value && (
                      <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600">
                        {form.formState.errors.download_value.message}
                      </p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-ink-500">
                  Leave both blank for no plan speed limit.
                </p>
              </>
            )}
          </fieldset>
          <FormField
            label="Maximum devices"
            hint={effectiveDevices < configuredDevices
              ? `Saved setting: ${configuredDevices} devices. Platform policy currently limits new vouchers to ${effectiveDevices}; the administrator must enable multi-device vouchers before the higher limit takes effect.`
              : 'Maximum devices that can use one newly issued voucher at the same time.'}
            error={form.formState.errors.max_devices?.message}
          >
            <Select
              id="plan-max-devices"
              {...form.register('max_devices')}
              options={Array.from({ length: 10 }, (_, i) => ({
                value: String(i + 1),
                label: `${i + 1} device${i ? 's' : ''}`,
              }))}
            />
          </FormField>
          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <Checkbox
                id="plan-active-status"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                label="Active"
                description="Inactive plans cannot be sold or used to generate vouchers, but existing vouchers keep working."
              />
            )}
          />
          <details
            className="plan-advanced"
            open={advanced || hasAdditionalErrors}
            onToggle={(e) => setAdvanced(e.currentTarget.open)}
          >
            <summary>Additional settings</summary>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  label="Voucher prefix"
                  optionalLabel
                  hint="Prepended to generated usernames (letters and digits, max 10)."
                  error={form.formState.errors.voucher_prefix?.message}
                >
                  <Input
                    id="plan-voucher-prefix"
                    placeholder="e.g. DAY"
                    maxLength={10}
                    className="font-mono uppercase"
                    {...form.register('voucher_prefix')}
                  />
                </FormField>
                <FormField
                  label="Voucher code format"
                  hint="Applies to future vouchers. Existing codes stay unchanged."
                  error={form.formState.errors.voucher_code_format?.message}
                >
                  <Select
                    id="plan-code-format"
                    {...form.register('voucher_code_format')}
                    options={planCodeFormatOptions}
                  />
                </FormField>
              </div>
              <Controller
                control={form.control}
                name="is_public"
                render={({ field }) => (
                  <Checkbox
                    id="plan-public-sales"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    label="Public sales"
                    description="Publish to the storefront for public hotspot checkout. IoT access remains device-managed."
                  />
                )}
              />
              <Controller
                control={form.control}
                name="agent_enabled"
                render={({ field }) => (
                  <Checkbox
                    id="plan-agent-sales"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    label="Agent sales"
                    description="Allow agents to issue hotspot vouchers from this plan."
                  />
                )}
              />
              <FormField label="Service type" error={form.formState.errors.plan_type?.message}>
                <Select
                  id="plan-service-type"
                  {...form.register('plan_type')}
                  options={[
                    { value: 'voucher', label: 'Hotspot voucher' },
                    { value: 'iot_mac', label: 'IoT / MAC device' },
                  ]}
                />
              </FormField>
              {planType === 'iot_mac' && (
                <Controller
                  control={form.control}
                  name="public_router"
                  render={({ field }) => (
                    <PlanRouterField
                      value={field.value}
                      onChange={field.onChange}
                      error={form.formState.errors.public_router?.message}
                    />
                  )}
                />
              )}
            </div>
          </details>
        </>}
      </div>
      <div className="plan-editor-footer">
        <p>Changes apply to newly issued access.</p>
        {step === 0 ? <>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button type="button" onClick={() => void goNext()} disabled={busy}>Next</Button>
        </> : <>
          <Button type="button" variant="secondary" onClick={() => showStep(0)} disabled={busy}>Back</Button>
          <Button type="button" onClick={() => void submit()} loading={busy}>{plan ? 'Save changes' : 'Create plan'}</Button>
        </>}
      </div>
    </form>
  );
}

function PlanRouterField({
  value,
  onChange,
  error,
}: {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  error: string | undefined;
}) {
  const routers = useRouterOptions();
  return (
    <div>
      <FormField
        label="Assigned router"
        error={error}
        hint="IoT access is restricted to this router; required when Public sales is selected."
      >
        <Select
          id="plan-assigned-router"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={routers.isPending}
          options={[
            {
              value: '',
              label: routers.isPending ? 'Loading routers...' : 'No router restriction',
            },
            ...(routers.data ?? []).map((r) => ({ value: r.id, label: r.name })),
            ...(value && !routers.data?.some((r) => r.id === value)
              ? [{ value, label: 'Current router' }]
              : []),
          ]}
        />
      </FormField>
      {routers.isError && (
        <Button type="button" variant="ghost" onClick={() => void routers.refetch()}>
          Retry routers
        </Button>
      )}
    </div>
  );
}
