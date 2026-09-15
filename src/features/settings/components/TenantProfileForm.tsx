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
        <FormField label="Workspace name" required error={errors.name?.message}>
          <Input autoComplete="organization" {...form.register('name')} />
        </FormField>
        <FormField label="Business display name" error={errors.business_name?.message}>
          <Input {...form.register('business_name')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Contact email" optionalLabel error={errors.email?.message}>
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              {...form.register('email')}
            />
          </FormField>
          <FormField label="Contact phone" optionalLabel error={errors.phone?.message}>
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
          hint="Business location or correspondence address."
          error={errors.address?.message}
        >
          <Textarea rows={3} autoComplete="street-address" {...form.register('address')} />
        </FormField>
      </fieldset>
      <p role="status" className="text-xs text-ink-500">
        {update.isPending
          ? 'Saving business details...'
          : form.formState.isDirty
            ? 'You have unsaved changes.'
            : 'No unsaved changes.'}
      </p>
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <dl className="text-xs text-ink-500">
          <span className="inline-flex min-w-0 flex-wrap gap-1">
            <dt>Storefront slug:</dt>
            <dd className="font-mono break-all text-ink-700">{profile.slug}</dd>
          </span>
        </dl>
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
