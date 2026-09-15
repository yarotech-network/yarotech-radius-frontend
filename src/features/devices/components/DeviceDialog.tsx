import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Checkbox, Dialog, FormField, Input, Select } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { useRouterOptions } from '@/features/routers/queries';
import { usePlanOptions } from '@/features/plans/queries';
import type { MacDevice } from '@/types/api';
import { useCreateDevice, useUpdateDevice } from '../queries';
import {
  deviceDefaults,
  deviceSchema,
  deviceToForm,
  formToPatch,
  formToPayload,
  type DeviceInput,
  type DeviceOutput,
} from '../deviceSchemas';

const FIELDS = [
  'device_name',
  'mac_address',
  'plan',
  'expires_at',
  'is_active',
  'router',
  'access_type',
  'vlan_id',
  'description',
] as const;

export function DeviceDialog({
  open,
  device,
  onClose,
  onSaved,
}: {
  open: boolean;
  device?: MacDevice;
  onClose: () => void;
  onSaved: (device: MacDevice) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      variant="dialog"
      size="lg"
      title={device ? `Edit ${device.device_name}` : 'Add IoT / MAC Device'}
      description={
        device
          ? 'Changes apply the next time the device authenticates.'
          : 'Register device access by MAC address. Network authentication must be configured separately.'
      }
    >
      {open && (
        <DeviceForm
          key={device?.id ?? 'new'}
          {...(device ? { device } : {})}
          onCancel={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}

function DeviceForm({
  device,
  onCancel,
  onSaved,
}: {
  device?: MacDevice;
  onCancel: () => void;
  onSaved: (device: MacDevice) => void;
}) {
  const create = useCreateDevice();
  const update = useUpdateDevice();
  const plans = usePlanOptions(true, 'all');
  const routers = useRouterOptions();
  const [idempotencyKey] = useState(() => newIdempotencyKey('device'));
  const form = useForm<DeviceInput, unknown, DeviceOutput>({
    resolver: zodResolver(deviceSchema),
    defaultValues: device ? deviceToForm(device) : deviceDefaults(),
    mode: 'onTouched',
  });
  const { message, reset: resetErrors, captureError } = useFormSubmit(form.setError, FIELDS);
  const errors = form.formState.errors;
  const accessType = useWatch({ control: form.control, name: 'access_type' });

  const submit = form.handleSubmit(async (values) => {
    resetErrors();
    try {
      if (device) {
        const patch = formToPatch(values, device);
        if (Object.keys(patch).length === 0) {
          onCancel();
          return;
        }
        onSaved(await update.mutateAsync({ id: device.id, payload: patch }));
      } else {
        onSaved(await create.mutateAsync({ payload: formToPayload(values), idempotencyKey }));
      }
    } catch (error) {
      captureError(error);
    }
  });

  const planOptions = [
    { value: '', label: plans.isPending ? 'Loading plans…' : 'Choose a plan' },
    ...(plans.data ?? []).map((p) => ({
      value: String(p.id),
      label: `${p.name} · ${p.price_display}`,
    })),
  ];
  // Keep the current plan selectable even if it has since been deactivated.
  if (device && plans.data && !plans.data.some((p) => p.id === device.plan))
    planOptions.push({ value: String(device.plan), label: `${device.plan_name} (inactive)` });

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      {message && <Alert tone="danger">{message}</Alert>}
      {plans.isError && (
        <Alert
          tone="warning"
          actions={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => void plans.refetch()}
            >
              Retry plans
            </Button>
          }
        >
          Plans could not be loaded — you can still fill in the other fields.
        </Alert>
      )}
      <FormField label="Device name" required error={errors.device_name?.message}>
        <Input autoFocus placeholder="e.g. Lobby smart TV" {...form.register('device_name')} />
      </FormField>
      <FormField
        label="MAC address"
        required
        hint="Any common format; it is stored as AA:BB:CC:DD:EE:FF."
        error={errors.mac_address?.message}
      >
        <Input
          autoComplete="off"
          spellCheck={false}
          placeholder="AA:BB:CC:DD:EE:FF"
          className="font-mono uppercase"
          {...form.register('mac_address')}
        />
      </FormField>
      {routers.isError && (
        <Alert
          tone="warning"
          actions={
            <Button type="button" onClick={() => void routers.refetch()}>
              Retry routers
            </Button>
          }
        >
          Routers could not be loaded.
        </Alert>
      )}
      <FormField label="Router" required error={errors.router?.message}>
        <Select
          {...form.register('router')}
          disabled={routers.isPending}
          options={[
            { value: '', label: routers.isPending ? 'Loading routers...' : 'Choose a router' },
            ...(routers.data ?? []).map((r) => ({ value: r.id, label: r.name })),
          ]}
        />
      </FormField>
      <FormField
        label="Plan"
        required
        hint="Speed and data limits applied to the device."
        error={errors.plan?.message}
      >
        <Select options={planOptions} disabled={plans.isPending} {...form.register('plan')} />
      </FormField>
      <FormField label="Access type" required error={errors.access_type?.message}>
        <Select
          {...form.register('access_type')}
          options={[
            { value: 'permanent', label: 'Permanent' },
            { value: 'timed', label: 'Time limited' },
          ]}
        />
      </FormField>
      {accessType === 'timed' && (
        <FormField label="Access expires" required error={errors.expires_at?.message}>
          <Input type="datetime-local" {...form.register('expires_at')} />
        </FormField>
      )}
      <FormField
        label="VLAN ID"
        optionalLabel
        hint="Optional: 1 to 4094. The router must support this VLAN policy."
        error={errors.vlan_id?.message}
      >
        <Input type="number" min={1} max={4094} {...form.register('vlan_id')} />
      </FormField>
      <FormField label="Description" optionalLabel error={errors.description?.message}>
        <textarea
          className="min-h-24 w-full rounded-xl border border-border bg-white p-3 text-sm"
          maxLength={2000}
          {...form.register('description')}
        />
      </FormField>
      <Controller
        control={form.control}
        name="is_active"
        render={({ field }) => (
          <Checkbox
            checked={field.value}
            onChange={(e) => field.onChange(e.target.checked)}
            label="Active"
            description="Inactive devices are refused even before they expire."
          />
        )}
      />
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={form.formState.isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" loading={form.formState.isSubmitting}>
          {device ? 'Save changes' : 'Save device'}
        </Button>
      </div>
    </form>
  );
}
