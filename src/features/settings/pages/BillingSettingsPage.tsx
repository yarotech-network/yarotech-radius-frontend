import { voucherCodeFormatOptions } from '@/lib/voucherCodeFormats';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { CreditCard, KeyRound, RefreshCw } from 'lucide-react';
import { Button, Card, FormField, Input, Select, PasswordInput, Skeleton } from '@/components/ui';
import { Alert, ErrorState, useToast } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { formatDateTime } from '@/lib/formatting/dates';
import type { TenantSetting } from '@/types/api';
import { useTenantSettings, useUpdateTenantSettings } from '../queries';
import { SettingsCard } from '../components/SettingsCard';
import {
  billingSettingsSchema,
  settingsFormToPatch,
  settingsToForm,
  type BillingSettingsInput,
  type BillingSettingsOutput,
} from '../settingsSchemas';

export default function BillingSettingsPage() {
  useEffect(() => {
    document.title = 'Billing and payouts | Yarotech RADIUS';
  }, []);
  const settings = useTenantSettings();
  return (
    <div className="space-y-6">
      <Card className="border-brand-200 bg-gradient-to-br from-brand-50/70 via-surface to-sky-50/50 dark:from-brand-950/40 dark:via-surface dark:to-slate-900/40">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-md">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-ink-900">
              Payment preferences for your business
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Manage customer-payment credentials, voucher defaults and agent wallet funding limits.
            </p>
            <nav
              aria-label="Billing settings shortcuts"
              className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-brand-600 dark:text-brand-400"
            >
              <a href="#paystack" className="hover:underline">
                Paystack credentials
              </a>
              <a href="#vouchers" className="hover:underline">
                Voucher and agent rules
              </a>
              <Link to="/settings/subscription" className="hover:underline">
                Business subscription
              </Link>
            </nav>
          </div>
        </div>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-500">Changes apply after you save.</p>
        <Button
          variant="secondary"
          size="sm"
          disabled={settings.isFetching}
          onClick={() => void settings.refetch()}
          leadingIcon={
            <RefreshCw
              className={settings.isFetching ? 'size-4 animate-spin motion-reduce:animate-none' : 'size-4'}
              aria-hidden
            />
          }
        >
          {settings.isFetching ? 'Refreshing...' : 'Refresh billing settings'}
        </Button>
      </div>
      {settings.isError && settings.data && (
        <Alert tone="warning" title="Billing settings could not be refreshed">
          Your unsaved entries are preserved. Showing the last loaded settings.
        </Alert>
      )}
      {settings.data ? (
        <BillingForm key={settings.data.id} settings={settings.data} />
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
  'paystack_secret_key',
] as const;

function BillingForm({ settings }: { settings: TenantSetting }) {
  const toast = useToast();
  const update = useUpdateTenantSettings();
  const form = useForm<BillingSettingsInput, unknown, BillingSettingsOutput>({
    resolver: zodResolver(billingSettingsSchema),
    defaultValues: settingsToForm(settings),
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, FIELDS);

  async function onSubmit(data: BillingSettingsOutput) {
    resetErrors();
    const patch = settingsFormToPatch(data, settings);
    if (Object.keys(patch).length === 0) {
      toast.info('No changes to save');
      return;
    }
    try {
      await update.mutateAsync(patch);
      toast.success('Billing preferences saved');
      form.reset(data);
    } catch (error) {
      captureError(error, 'Could not save billing preferences');
    }
  }

  return (
    <form onSubmit={(e) => void form.handleSubmit(onSubmit)(e)} noValidate className="space-y-6">
      {message && (
        <Alert tone="danger" title={message.title}>
          {message.description}
        </Alert>
      )}
      <SettingsCard
        id="paystack"
        title="Paystack credentials"
        description="Used to process online storefront payments and wallet funding. Keep your secret key secure."
      >
        <div className="space-y-4">
          <FormField
            label="Paystack secret key"
            description={
              settings.paystack_secret_key_configured
                ? `Currently configured (${settings.paystack_secret_key_masked ?? 'saved'}). Enter a new secret key to replace it, or leave blank to keep existing.`
                : 'Enter your secret key from your Paystack API keys dashboard.'
            }
            error={form.formState.errors.paystack_secret_key?.message}
          >
            <PasswordInput
              {...form.register('paystack_secret_key')}
              placeholder={
                settings.paystack_secret_key_configured
                  ? '••••••••••••••••'
                  : 'sk_live_... or sk_test_...'
              }
              autoComplete="off"
            />
          </FormField>
          {settings.paystack_secret_key_configured && (
            <p className="text-xs text-ink-500">
              Key updated: {formatDateTime(settings.updated_at)}
            </p>
          )}
        </div>
      </SettingsCard>

      <SettingsCard
        id="vouchers"
        title="Voucher and agent rules"
        description="Set global voucher code formatting and agent funding fees for your workspace."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            label="Voucher prefix"
            description="Default prefix added to generated codes."
            error={form.formState.errors.voucher_prefix?.message}
          >
            <Input {...form.register('voucher_prefix')} placeholder="e.g. HOTSPOT" />
          </FormField>
          <FormField
            label="Code format"
            description="Character set for access codes."
            error={form.formState.errors.default_voucher_code_format?.message}
          >
            <Select
              {...form.register('default_voucher_code_format')}
              options={voucherCodeFormatOptions}
            />
          </FormField>
          <FormField
            label="Agent funding percentage fee (%)"
            description="Fee percentage deducted on agent wallet deposits."
            error={form.formState.errors.agent_funding_fee_percent?.message}
          >
            <Input
              type="number"
              step="0.01"
              {...form.register('agent_funding_fee_percent', { valueAsNumber: true })}
            />
          </FormField>
          <FormField
            label="Agent funding flat fee (Kobo)"
            description="Flat fee in Kobo for wallet deposits."
            error={form.formState.errors.agent_funding_flat_fee?.message}
          >
            <Input
              type="number"
              {...form.register('agent_funding_flat_fee', { valueAsNumber: true })}
            />
          </FormField>
          <FormField
            label="Agent commission rate (%)"
            description="Default commission percentage for sales."
            error={form.formState.errors.agent_commission_percent?.message}
          >
            <Input
              type="number"
              step="0.01"
              {...form.register('agent_commission_percent', { valueAsNumber: true })}
            />
          </FormField>
        </div>
      </SettingsCard>

      <div className="flex justify-end gap-3 border-t border-border/60 pt-4">
        <Button
          type="submit"
          loading={form.formState.isSubmitting}
          disabled={!form.formState.isDirty}
        >
          Save preferences
        </Button>
      </div>
    </form>
  );
}
