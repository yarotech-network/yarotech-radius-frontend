import { planCodeFormatOptions } from '@/lib/voucherCodeFormats';
import { useRouterOptions } from '@/features/routers/queries';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Checkbox, FormField, Input, Select } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { formatHours } from '@/lib/formatting/units';
import { PlanPreview } from './PlanPreview';
import type { InternetPlan } from '@/types/api';
import {
  DURATION_PRESETS,
  formToPlan,
  planFormSchema,
  planToForm,
  type PlanFormInput,
  type PlanFormOutput,
} from '../planSchema';
import { BandwidthPicker } from './BandwidthPicker';
import { useCreatePlan, useUpdatePlan } from '../queries';

const FIELDS = [
  'plan_type',
  'public_router',
  'is_public',
  'agent_enabled',
  'bandwidth_profile',
  'name',
  'price',
  'duration_hours',
  'rate_limit',
  'data_limit_mb',
  'voucher_prefix',
  'voucher_code_format',
  'is_active',
] as const;
const ALIASES = { data_limit: 'data_limit_mb' };

export function PlanForm({
  plan,
  onSaved,
  onCancel,
}: {
  plan?: InternetPlan;
  onSaved: (plan: InternetPlan) => void;
  onCancel: () => void;
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
  const profileId = useWatch({ control: form.control, name: 'bandwidth_profile' });
  const [chooseProfile, setChooseProfile] = useState(!!plan?.bandwidth_profile);
  const duration = useWatch({ control: form.control, name: 'duration_hours' });
  const presetValue = useMemo(
    () =>
      DURATION_PRESETS.some((p) => p.hours === Number(duration)) ? String(duration) : 'custom',
    [duration],
  );
  const [customDuration, setCustomDuration] = useState(presetValue === 'custom');

  useEffect(() => {
    form.reset(planToForm(plan));
  }, [plan, form]);

  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    if (chooseProfile && !values.bandwidth_profile) {
      form.setError('bandwidth_profile', {
        message: 'Choose a profile, or switch to custom speed.',
      });
      return;
    }
    try {
      const saved = plan
        ? await update.mutateAsync({ id: plan.id, payload: formToPlan(values) })
        : await create.mutateAsync({ payload: formToPlan(values), idempotencyKey });
      onSaved(saved);
    } catch (error) {
      captureError(error);
    }
  });

  const [advanced, setAdvanced] = useState(plan?.plan_type === 'iot_mac');
  const busy = form.formState.isSubmitting;
  const draft = useWatch({ control: form.control });

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="plan-editor">
      {message && <Alert tone="danger">{message}</Alert>}
      <div className="plan-editor-layout">
        <div className="plan-editor-fields">
          <fieldset className="min-w-0 space-y-4 rounded-xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold text-brand-950">Package details</legend>
            <div className="plan-name-row">
              <FormField label="Plan name" required error={form.formState.errors.name?.message}>
                <Input
                  autoFocus
                  placeholder="e.g. 1 Day Unlimited"
                  maxLength={100}
                  {...form.register('name')}
                />
              </FormField>
              <FormField
                label="Voucher prefix"
                optionalLabel
                hint="Prepended to generated usernames (letters and digits, max 10)."
                error={form.formState.errors.voucher_prefix?.message}
              >
                <Input
                  placeholder="e.g. DAY"
                  maxLength={10}
                  className="font-mono uppercase"
                  {...form.register('voucher_prefix')}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Price"
                required
                hint="Enter the price in naira (NGN). Customers and agents pay this amount."
                error={form.formState.errors.price?.message}
              >
                <Input
                  inputMode="decimal"
                  prefix="₦"
                  placeholder="500"
                  {...form.register('price')}
                />
              </FormField>
              <FormField
                label="Duration"
                required
                error={form.formState.errors.duration_hours?.message}
              >
                {customDuration ? (
                  <Input
                    type="number"
                    min={0.000139}
                    step="any"
                    inputMode="decimal"
                    placeholder="Hours"
                    trailingSlot={<span className="text-xs text-ink-500">hours</span>}
                    {...form.register('duration_hours')}
                  />
                ) : (
                  <Select
                    value={presetValue}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setCustomDuration(true);
                        return;
                      }
                      form.setValue('duration_hours', Number(e.target.value), {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    options={[
                      ...DURATION_PRESETS.map((p) => ({ value: String(p.hours), label: p.label })),
                      { value: 'custom', label: 'Custom…' },
                    ]}
                  />
                )}
              </FormField>
            </div>
            {customDuration && (
              <p className="-mt-3 text-xs text-ink-500">
                {Number(duration) > 0
                  ? `= ${formatHours(Number(duration))}`
                  : 'Enter the number of hours the plan lasts once activated.'}{' '}
                <button
                  type="button"
                  className="text-brand-600 hover:underline"
                  onClick={() => setCustomDuration(false)}
                >
                  Use a preset
                </button>
              </p>
            )}
          </fieldset>
          <fieldset className="min-w-0 space-y-4 rounded-xl border border-border p-4">
            <legend className="px-2 text-sm font-semibold text-brand-950">
              MikroTik Rate Profile
            </legend>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={chooseProfile ? 'primary' : 'secondary'}
                onClick={() => setChooseProfile(true)}
              >
                Use bandwidth profile
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!chooseProfile ? 'primary' : 'secondary'}
                onClick={() => {
                  setChooseProfile(false);
                  form.setValue('bandwidth_profile', null, { shouldDirty: true });
                }}
              >
                Use custom speed
              </Button>
            </div>
            {chooseProfile && (
              <BandwidthPicker
                value={profileId}
                onChange={(profile) => {
                  form.setValue('bandwidth_profile', profile?.id ?? null, { shouldDirty: true });
                  if (profile)
                    form.setValue('rate_limit', profile.rate_limit, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                }}
              />
            )}
            {form.formState.errors.bandwidth_profile && (
              <p role="alert" className="text-sm text-danger-700">
                {form.formState.errors.bandwidth_profile.message}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField
                label="Speed limit"
                hint="Upload/download, e.g. 5M/10M. Applies to newly issued access; leave blank for no plan speed limit."
                error={form.formState.errors.rate_limit?.message}
              >
                <Input
                  placeholder="5M/10M"
                  readOnly={chooseProfile && !!profileId}
                  className="font-mono"
                  {...form.register('rate_limit')}
                />
              </FormField>
              <FormField
                label="Data cap"
                hint="0 = unlimited."
                error={form.formState.errors.data_limit_mb?.message}
              >
                <Input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  trailingSlot={<span className="text-xs text-ink-500">MB</span>}
                  {...form.register('data_limit_mb')}
                />
              </FormField>
            </div>
          </fieldset>
          <Controller
            control={form.control}
            name="is_public"
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                label="Public sales"
                description="Publish to the storefront for public hotspot checkout. IoT access remains device-managed."
              />
            )}
          />
          <details
            className="plan-advanced"
            open={
              advanced ||
              Boolean(
                form.formState.errors.public_router ||
                form.formState.errors.plan_type ||
                form.formState.errors.voucher_code_format,
              )
            }
            onToggle={(e) => setAdvanced(e.currentTarget.open)}
          >
            <summary>Additional plan settings</summary>
            <div className="space-y-4 pt-4">
              <FormField label="Service type" error={form.formState.errors.plan_type?.message}>
                <Select
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
              <FormField
                label="Voucher code format"
                hint="Applies to future vouchers. Existing codes stay unchanged. Numbers or letters describe the random part after any prefix."
                error={form.formState.errors.voucher_code_format?.message}
              >
                <Select {...form.register('voucher_code_format')} options={planCodeFormatOptions} />
              </FormField>
              {(['agent_enabled'] as const).map((name) => (
                <Controller
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      label="Agent sales"
                      description="Allow agents to issue hotspot vouchers from this plan."
                    />
                  )}
                />
              ))}
              <Controller
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <Checkbox
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    label="Active"
                    description="Inactive plans cannot be sold or used to generate vouchers, but existing vouchers keep working."
                  />
                )}
              />
            </div>
          </details>
        </div>
        <PlanPreview draft={draft} />
      </div>
      <div className="plan-editor-footer">
        <p>Changes apply to newly issued access.</p>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {plan ? 'Save changes' : 'Create plan'}
        </Button>
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
