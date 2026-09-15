import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Dialog, FormField, Input, Switch, Textarea } from '@/components/ui';
import { Alert, useToast } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type { Tenant } from '@/types/api';
import { useCreateTenant, useUpdateTenant } from '../queries';
import { slugify } from '../platformVocabulary';
import {
  tenantFormToCreate,
  tenantFormToPatch,
  tenantSchema,
  tenantToForm,
  type TenantInput,
  type TenantOutput,
} from '../platformSchemas';

const FIELDS = [
  'name',
  'business_name',
  'owner_email',
  'owner_username',
  'slug',
  'email',
  'phone',
  'address',
  'is_active',
] as const;

/** Create or edit a tenant. The slug is the public storefront address, so it is auto-suggested from the name until edited. */
export function TenantDialog({
  open,
  onClose,
  tenant,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  tenant?: Tenant;
  onSaved?: (tenant: Tenant) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={tenant ? `Edit ${tenant.name}` : 'New tenant'}
      description={
        tenant
          ? 'Contact details. The existing storefront address is preserved.'
          : 'Create a workspace and its owner account together. The owner receives a password setup link.'
      }
      size="md"
    >
      {/* Mounted only while open so every opening starts from a clean form state. */}
      {open && (
        <TenantForm
          key={tenant?.updated_at ?? 'new'}
          onClose={onClose}
          {...(tenant ? { tenant } : {})}
          {...(onSaved ? { onSaved } : {})}
        />
      )}
    </Dialog>
  );
}

function TenantForm({
  tenant,
  onClose,
  onSaved,
}: {
  tenant?: Tenant;
  onClose: () => void;
  onSaved?: (tenant: Tenant) => void;
}) {
  const toast = useToast();
  const create = useCreateTenant();
  const update = useUpdateTenant();
  const [idempotencyKey, setIdempotencyKey] = useState(() => newIdempotencyKey('tenant'));
  const [slugTouched, setSlugTouched] = useState(Boolean(tenant));
  const form = useForm<TenantInput, unknown, TenantOutput>({
    resolver: zodResolver(tenantSchema),
    defaultValues: tenantToForm(tenant),
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, FIELDS);
  const errors = form.formState.errors;
  const isActive = useWatch({ control: form.control, name: 'is_active' });

  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    if (!tenant && (!values.owner_email || !values.owner_username)) {
      form.setError('owner_email', { message: 'Owner email and username are required.' });
      return;
    }
    try {
      let saved: Tenant;
      if (tenant) {
        const patch = tenantFormToPatch(tenant, values);
        if (Object.keys(patch).length === 0) {
          toast.info('Nothing to save');
          onClose();
          return;
        }
        saved = await update.mutateAsync({ id: tenant.id, payload: patch });
        toast.success('Tenant updated');
      } else {
        saved = await create.mutateAsync({ payload: tenantFormToCreate(values), idempotencyKey });
        setIdempotencyKey(newIdempotencyKey('tenant'));
        if (saved.owner_delivery_status === 'failed')
          toast.info(
            'Tenant created; invitation not sent',
            'Retry owner setup from the tenant details page.',
          );
        else toast.success('Tenant created', 'The owner has been sent a password setup link.');
      }
      onSaved?.(saved);
      onClose();
    } catch (error) {
      if (!tenant) setIdempotencyKey(newIdempotencyKey('tenant'));
      captureError(error);
    }
  });

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="flex flex-col gap-4"
      aria-label={tenant ? 'Edit tenant' : 'New tenant'}
    >
      {message && <Alert tone="danger">{message}</Alert>}
      {!tenant && (
        <fieldset className="space-y-3">
          <legend>Owner account</legend>
          <FormField label="Owner email" required error={errors.owner_email?.message}>
            <Input type="email" {...form.register('owner_email')} />
          </FormField>
          <FormField label="Owner username" required error={errors.owner_username?.message}>
            <Input autoComplete="off" {...form.register('owner_username')} />
          </FormField>
        </fieldset>
      )}
      <FormField label="Business display name" error={errors.business_name?.message}>
        <Input {...form.register('business_name')} />
      </FormField>
      <fieldset className="min-w-0 space-y-4 rounded-xl border border-border p-4">
        <legend className="px-2 text-sm font-semibold text-brand-950">Business identity</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Workspace name" required error={errors.name?.message}>
            <Input
              autoFocus
              {...form.register('name', {
                onChange: (e: { target: { value: string } }) => {
                  // Suggest a slug from the name until the admin edits the slug by hand.
                  if (!slugTouched && !tenant)
                    form.setValue('slug', slugify(e.target.value), {
                      shouldValidate: form.formState.isSubmitted,
                    });
                },
              })}
            />
          </FormField>
          <FormField
            label="Storefront slug"
            required
            error={errors.slug?.message}
            hint="Customers buy at /s/<slug>."
          >
            <Input
              autoCapitalize="none"
              spellCheck={false}
              readOnly={Boolean(tenant)}
              {...form.register('slug', { onChange: () => setSlugTouched(true) })}
            />
          </FormField>
        </div>
      </fieldset>
      <fieldset className="min-w-0 space-y-4 rounded-xl border border-border p-4">
        <legend className="px-2 text-sm font-semibold text-brand-950">Contact information</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Contact email" optionalLabel error={errors.email?.message}>
            <Input type="email" inputMode="email" {...form.register('email')} />
          </FormField>
          <FormField label="Phone" optionalLabel error={errors.phone?.message}>
            <Input type="tel" inputMode="tel" {...form.register('phone')} />
          </FormField>
        </div>
        <FormField label="Address" optionalLabel error={errors.address?.message}>
          <Textarea rows={2} {...form.register('address')} />
        </FormField>
      </fieldset>
      <div className="flex items-start justify-between gap-4 rounded-control border border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-ink-900">Active</p>
          <p className="text-xs text-ink-500">
            Inactive tenants cannot sign in, sell or accept payments; their storefront returns not
            found.
          </p>
        </div>
        <Switch
          checked={Boolean(isActive)}
          onCheckedChange={(checked) => form.setValue('is_active', checked, { shouldDirty: true })}
          label="Active"
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          {tenant ? 'Save changes' : 'Create tenant'}
        </Button>
      </div>
    </form>
  );
}
