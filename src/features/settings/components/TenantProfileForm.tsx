import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, FormField, Input, Textarea } from '@/components/ui';
import { Alert, useToast } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import type { TenantProfile } from '@/types/api';
import { useUpdateTenantProfile } from '../queries';
import {
  profileFormToPatch,
  profileToForm,
  tenantProfileSchema,
  type TenantProfileInput,
  type TenantProfileOutput,
} from '../settingsSchemas';

const FIELDS = ['name', 'business_name', 'email', 'phone', 'address'] as const;

export function TenantProfileForm({ profile }: { profile: TenantProfile }) {
  const toast = useToast();
  const update = useUpdateTenantProfile();
  const form = useForm<TenantProfileInput, unknown, TenantProfileOutput>({
    resolver: zodResolver(tenantProfileSchema),
    defaultValues: profileToForm(profile),
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, FIELDS);
  const errors = form.formState.errors;

  // Re-sync when a background refetch brings newer data and the user has not started editing.
  useEffect(() => {
    if (!form.formState.isDirty) form.reset(profileToForm(profile));
  }, [profile, form]);

  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    const patch = profileFormToPatch(values, profile);
    // A background refresh must not turn untouched draft fields into writes.
    for (const field of FIELDS) {
      if (!form.formState.dirtyFields[field]) delete patch[field];
    }
    if (Object.keys(patch).length === 0) {
      toast.info('Nothing to save');
      return;
    }
    try {
      const saved = await update.mutateAsync(patch);
      form.reset(profileToForm(saved));
      toast.success('Business profile saved');
    } catch (error) {
      captureError(error);
    }
  });

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="flex flex-col gap-4"
      aria-label="Business profile"
    >
      {message && <Alert tone="danger">{message}</Alert>}
      <fieldset disabled={update.isPending} className="flex min-w-0 flex-col gap-4">
        <legend className="sr-only">Business contact details</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Workspace name"
            required
            hint="Customers see this on your storefront, receipts and emails."
            error={errors.name?.message}
          >
            <Input autoComplete="organization" {...form.register('name')} />
          </FormField>
          <FormField
            label="Business display name"
            optionalLabel
            hint="Your full registered or trading name, if different."
            error={errors.business_name?.message}
          >
            <Input {...form.register('business_name')} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Contact email"
            optionalLabel
            hint="Used as the support contact when no phone is set."
            error={errors.email?.message}
          >
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              {...form.register('email')}
            />
          </FormField>
          <FormField
            label="Contact phone"
            optionalLabel
            hint="Shown to customers as your support line on access-code emails."
            error={errors.phone?.message}
          >
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+234 803 000 0000"
              {...form.register('phone')}
            />
          </FormField>
        </div>
        <FormField
          label="Address"
          optionalLabel
          hint="Your shop or office address."
          error={errors.address?.message}
        >
          <Textarea rows={3} autoComplete="street-address" {...form.register('address')} />
        </FormField>
      </fieldset>
      <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p role="status" className="text-xs text-ink-500">
          {update.isPending
            ? 'Saving business details...'
            : form.formState.isDirty
              ? 'You have unsaved changes.'
              : 'No unsaved changes.'}
        </p>
        <div className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              resetErrors();
              form.reset(profileToForm(profile));
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
    </form>
  );
}
