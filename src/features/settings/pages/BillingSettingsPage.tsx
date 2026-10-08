import { useEffect } from 'react';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Percent, RefreshCw, Ticket, Wallet } from 'lucide-react';
import { Button, FormField, Input, PasswordInput, Select, Skeleton } from '@/components/ui';
import { Alert, ErrorState, useToast } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { formatDateTime } from '@/lib/formatting/dates';
import { formatKobo, parseNairaToKobo } from '@/lib/formatting/money';
import { voucherCodeFormatOptions } from '@/lib/voucherCodeFormats';
import type { TenantSetting } from '@/types/api';
import { useTenantSettings, useUpdateTenantSettings } from '../queries';
import { SettingsCard } from '../components/SettingsCard';
import { CustomerGatewaySettings } from '../components/CustomerGatewaySettings';
import { PortalSettings } from '../components/PortalSettings';
import {
  billingSettingsSchema,
  settingsFormToPatch,
  settingsToForm,
  type BillingSettingsInput,
  type BillingSettingsOutput,
} from '../settingsSchemas';

/** Example used to show what the fee settings mean in naira. */
const EXAMPLE_TOP_UP = 1_000_000; // ₦10,000 in kobo
const EXAMPLE_SALE = 50_000; // ₦500 in kobo

export default function BillingSettingsPage() {
  useEffect(() => {
    document.title = 'Billing and payouts | Yarotech RADIUS';
  }, []);
  const settings = useTenantSettings();
  return (
    <div className="space-y-6">
      <CustomerGatewaySettings />
      <PortalSettings />
      {settings.isError && settings.data && (
        <Alert tone="warning" title="Billing settings could not be refreshed">
          Your unsaved entries are preserved. Showing the last loaded settings.
        </Alert>
      )}
      {settings.data ? (
        <BillingForm
          key={settings.data.id}
          settings={settings.data}
          refreshing={settings.isFetching}
          onRefresh={() => void settings.refetch()}
        />
      ) : settings.isPending ? (
        <Skeleton className="h-96 w-full rounded-xl" />
      ) : (
        <ErrorState
          error={settings.error}
          onRetry={() => void settings.refetch()}
          title="Settings could not be loaded"
        />
      )}
    </div>
  );
}

const FIELDS = [
  'agent_funding_fee_percent',
  'agent_funding_flat_fee',
  'agent_commission_percent',
  'voucher_prefix',
  'default_voucher_code_format',
  'max_funding_amount',
  'paystack_public_key',
  'paystack_secret_key',
] as const;

function BillingForm({
  settings,
  refreshing,
  onRefresh,
}: {
  settings: TenantSetting;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const update = useUpdateTenantSettings();
  const form = useForm<BillingSettingsInput, unknown, BillingSettingsOutput>({
    resolver: zodResolver(billingSettingsSchema),
    defaultValues: settingsToForm(settings),
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, FIELDS);
  const errors = form.formState.errors;
  const dirty = form.formState.isDirty;

  async function onSubmit(data: BillingSettingsOutput) {
    resetErrors();
    const patch = settingsFormToPatch(data, settings);
    // A background refresh must not turn untouched fields into writes.
    for (const field of FIELDS) {
      if (!form.formState.dirtyFields[field]) delete patch[field];
    }
    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save');
      return;
    }
    try {
      const saved = await update.mutateAsync(patch);
      toast.success('Billing settings saved');
      form.reset(settingsToForm(saved));
    } catch (error) {
      captureError(error);
    }
  }

  return (
    <form
      aria-label="Billing and payouts"
      onSubmit={(e) => void form.handleSubmit(onSubmit)(e)}
      noValidate
      className="space-y-6"
    >
      {message && <Alert tone="danger">{message}</Alert>}

      <SettingsCard
        id="agent-paystack"
        title="Agent wallet Paystack account"
        icon={<Wallet />}
        description="Agents top up their wallets through this Paystack account. Until you add your keys, top-ups use Yarotech's default Paystack account."
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={refreshing}
            onClick={onRefresh}
            leadingIcon={
              <RefreshCw
                className={refreshing ? 'animate-spin motion-reduce:animate-none' : undefined}
                aria-hidden
              />
            }
          >
            {refreshing ? 'Refreshing...' : 'Refresh billing settings'}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Public key" optionalLabel error={errors.paystack_public_key?.message}>
            <PasswordInput
              autoComplete="off"
              placeholder="pk_live_..."
              {...form.register('paystack_public_key')}
            />
          </FormField>
          <FormField label="Secret key" optionalLabel error={errors.paystack_secret_key?.message}>
            <PasswordInput
              autoComplete="off"
              placeholder="sk_live_..."
              {...form.register('paystack_secret_key')}
            />
          </FormField>
        </div>
        <p className="mt-3 text-xs text-ink-500">
          Keys are write-only: they are never shown again after saving. Blank fields do not confirm
          whether keys are configured; leave them blank to keep the saved keys. Find them in
          Paystack under Settings → API Keys &amp; Webhooks.
        </p>
      </SettingsCard>

      <SettingsCard
        id="agent-funding"
        title="Agent wallet top-ups"
        icon={<Wallet />}
        description="Limits and fees when agents add money to their wallets. Fees are added on top of the amount the agent tops up."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField
            label="Max wallet top-up (₦)"
            hint="Largest single top-up. The minimum is ₦500."
            error={errors.max_funding_amount?.message}
          >
            <Input inputMode="decimal" {...form.register('max_funding_amount')} />
          </FormField>
          <FormField
            label="Agent funding percentage fee (%)"
            error={errors.agent_funding_fee_percent?.message}
          >
            <Input inputMode="decimal" {...form.register('agent_funding_fee_percent')} />
          </FormField>
          <FormField
            label="Agent funding flat fee (Naira)"
            error={errors.agent_funding_flat_fee?.message}
          >
            <Input inputMode="decimal" {...form.register('agent_funding_flat_fee')} />
          </FormField>
        </div>
        <FundingExample control={form.control} />
      </SettingsCard>

      <SettingsCard
        id="agent-commission"
        title="Agent commission"
        icon={<Percent />}
        description="The share of each voucher sale an agent keeps. New agents start with this rate; you can change it for each agent."
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:items-start">
          <FormField
            label="Agent commission rate (%)"
            error={errors.agent_commission_percent?.message}
          >
            <Input inputMode="decimal" {...form.register('agent_commission_percent')} />
          </FormField>
          <CommissionExample control={form.control} />
        </div>
      </SettingsCard>

      <SettingsCard
        id="vouchers"
        title="Voucher codes"
        icon={<Ticket />}
        description="Defaults for new access codes. Individual plans can use their own format."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Voucher prefix"
            hint="Letters and numbers added to the start of new codes."
            error={errors.voucher_prefix?.message}
          >
            <Input placeholder="e.g. WH" {...form.register('voucher_prefix')} />
          </FormField>
          <FormField
            label="Code format"
            hint="Characters used in new codes."
            error={errors.default_voucher_code_format?.message}
          >
            <Select
              options={voucherCodeFormatOptions}
              {...form.register('default_voucher_code_format')}
            />
          </FormField>
        </div>
      </SettingsCard>

      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-card border border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-sm text-ink-600">
          {update.isPending
            ? 'Saving…'
            : dirty
              ? 'You have unsaved changes.'
              : `All changes saved · last updated ${formatDateTime(settings.updated_at)}`}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            disabled={!dirty || update.isPending}
            onClick={() => {
              resetErrors();
              form.reset(settingsToForm(settings));
            }}
          >
            Discard
          </Button>
          <Button type="submit" loading={update.isPending} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </div>
    </form>
  );
}

const asNumber = (value: unknown) => {
  const parsed = Number(String(value ?? '').trim());
  return Number.isFinite(parsed) ? parsed : null;
};

function FundingExample({ control }: { control: Control<BillingSettingsInput, unknown, BillingSettingsOutput> }) {
  const [percentRaw, flatRaw] = useWatch({
    control,
    name: ['agent_funding_fee_percent', 'agent_funding_flat_fee'],
  });
  const percent = asNumber(percentRaw);
  const flat = parseNairaToKobo(String(flatRaw ?? ''));
  if (percent === null || flat === null) return null;
  const fee = Math.round((EXAMPLE_TOP_UP * percent) / 100) + flat;
  return (
    <p className="mt-4 rounded-control bg-surface-muted px-3 py-2.5 text-sm text-ink-700">
      Example: to add <strong>{formatKobo(EXAMPLE_TOP_UP, { compact: true })}</strong> to their
      wallet, an agent pays <strong>{formatKobo(EXAMPLE_TOP_UP + fee)}</strong>
      {fee > 0 ? ` (${formatKobo(fee)} fee)` : ' (no fee)'}.
    </p>
  );
}

function CommissionExample({ control }: { control: Control<BillingSettingsInput, unknown, BillingSettingsOutput> }) {
  const rate = asNumber(useWatch({ control, name: 'agent_commission_percent' }));
  if (rate === null || rate < 0 || rate > 100) return null;
  const earned = Math.round((EXAMPLE_SALE * rate) / 100);
  return (
    <p className="rounded-control bg-surface-muted px-3 py-2.5 text-sm text-ink-700 sm:mt-7">
      Example: on a <strong>{formatKobo(EXAMPLE_SALE, { compact: true })}</strong> voucher, the
      agent keeps <strong>{formatKobo(earned)}</strong> and pays you{' '}
      <strong>{formatKobo(EXAMPLE_SALE - earned)}</strong>.
    </p>
  );
}
