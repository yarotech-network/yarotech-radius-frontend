import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router';
import { CreditCard, KeyRound, RefreshCw } from 'lucide-react';
import { Button, Card, FormField, Input, PasswordInput, Skeleton } from '@/components/ui';
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
      <Card className="border-brand-100 bg-gradient-to-br from-brand-50 via-white to-sky-50">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <CreditCard className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-brand-950">
              Payment preferences for your business
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-600">
              Manage customer-payment credentials, voucher defaults and agent wallet funding limits.
            </p>
            <nav
              aria-label="Billing settings shortcuts"
              className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-brand-700"
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
              className={settings.isFetching ? 'size-4 animate-spin' : 'size-4'}
              aria-hidden
            />
          }
        >
          Refresh billing settings
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
        <Skeleton className="h-96 w-full" />
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
  'agent_commission_percent',
  'voucher_prefix',
  'max_funding_amount',
  'paystack_public_key',
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
  const errors = form.formState.errors;

  useEffect(() => {
    if (!form.formState.isDirty) form.reset(settingsToForm(settings));
  }, [settings, form]);

  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    const patch = settingsFormToPatch(values, settings);
    for (const field of FIELDS) {
      if (!form.formState.dirtyFields[field]) delete patch[field];
    }
    if (Object.keys(patch).length === 0) {
      toast.info('Nothing to save');
      return;
    }
    try {
      const saved = await update.mutateAsync(patch);
      form.reset(settingsToForm(saved));
      toast.success(
        'Billing settings saved',
        patch.paystack_secret_key || patch.paystack_public_key
          ? 'Replacement keys saved. Saved keys are not displayed on this page.'
          : undefined,
      );
    } catch (error) {
      captureError(error);
    }
  });

  return (
    <form onSubmit={(e) => void submit(e)} noValidate aria-label="Billing and payouts">
      {message && (
        <Alert tone="danger" className="mb-4">
          {message}
        </Alert>
      )}
      <SettingsCard
        id="paystack"
        title="Paystack"
        description="Configure Paystack credentials for customer payments and agent wallet funding. Your business subscription is managed in the Subscription section."
      >
        <div className="mb-4 flex items-start gap-2 rounded-card border border-border bg-surface-muted p-3 text-xs text-ink-600">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
          <span>
            For security the stored keys are never displayed. Leave a field blank to keep the
            current key; type a new one to replace it. Blank fields do not confirm whether keys are
            configured.
          </span>
        </div>
        <fieldset disabled={update.isPending} className="grid min-w-0 gap-4 sm:grid-cols-2">
          <legend className="sr-only">Replace Paystack credentials</legend>
          <FormField
            label="Public key"
            hint="Starts with pk_test_ or pk_live_"
            error={errors.paystack_public_key?.message}
          >
            <Input
              autoComplete="off"
              spellCheck={false}
              placeholder="Unchanged"
              {...form.register('paystack_public_key')}
            />
          </FormField>
          <FormField
            label="Secret key"
            hint="Starts with sk_test_ or sk_live_"
            error={errors.paystack_secret_key?.message}
          >
            <PasswordInput
              autoComplete="new-password"
              placeholder="Unchanged"
              {...form.register('paystack_secret_key')}
            />
          </FormField>
        </fieldset>
      </SettingsCard>
      <SettingsCard
        id="vouchers"
        title="Vouchers & agents"
        description="Defaults applied when vouchers are generated and when agents sell on your behalf."
      >
        <fieldset
          disabled={update.isPending}
          className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3"
        >
          <legend className="sr-only">Voucher and agent rules</legend>
          <FormField
            label="Voucher prefix"
            hint="Up to 10 letters/digits, e.g. WH"
            error={errors.voucher_prefix?.message}
          >
            <Input
              autoCapitalize="characters"
              maxLength={10}
              {...form.register('voucher_prefix')}
            />
          </FormField>
          <FormField
            label="Agent commission"
            hint="Recorded for reporting; not applied to wallets automatically"
            error={errors.agent_commission_percent?.message}
          >
            <Input
              inputMode="decimal"
              trailingSlot={
                <span className="px-2 text-sm text-ink-400" aria-hidden>
                  %
                </span>
              }
              {...form.register('agent_commission_percent')}
            />
          </FormField>
          <FormField
            label="Max wallet top-up"
            hint="Per agent funding request"
            error={errors.max_funding_amount?.message}
          >
            <Input inputMode="decimal" prefix="NGN" {...form.register('max_funding_amount')} />
          </FormField>
        </fieldset>
        <p role="status" className="mt-5 text-xs text-ink-500">
          {update.isPending
            ? 'Saving billing settings...'
            : form.formState.isDirty
              ? 'You have unsaved billing changes.'
              : 'No unsaved billing changes.'}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-ink-500">
            Last updated {formatDateTime(settings.updated_at)}
          </span>
          <div className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                resetErrors();
                form.reset(settingsToForm(settings));
              }}
              disabled={!form.formState.isDirty || update.isPending}
            >
              Discard
            </Button>
            <Button type="submit" loading={update.isPending} disabled={!form.formState.isDirty}>
              Save changes
            </Button>
          </div>
        </div>
      </SettingsCard>
    </form>
  );
}
