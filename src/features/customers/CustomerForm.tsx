import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button, Input, Textarea } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { errorMessage, isApiError } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { customersApi, type Customer, type CustomerWrite } from './api';

export function CustomerForm({
  customer,
  onSaved,
  onBusy,
  onCancel,
}: {
  customer?: Customer;
  onSaved: () => void;
  onBusy: (value: boolean) => void;
  onCancel: () => void;
}) {
  const [data, setData] = useState<CustomerWrite>({
    reference: customer?.reference ?? '',
    name: customer?.name ?? '',
    email: customer?.email ?? '',
    phone: customer?.phone ?? '',
    address: customer?.address ?? '',
    notes: customer?.notes ?? '',
  });
  const [key, setKey] = useState(() => newIdempotencyKey('customer'));
  const save = useMutation({
    mutationFn: () =>
      customer ? customersApi.update(customer.id, data) : customersApi.create(data, key),
    onSuccess: onSaved,
    onSettled: () => onBusy(false),
  });
  const change = (field: keyof CustomerWrite, value: string) => {
    setData({ ...data, [field]: value });
    setKey(newIdempotencyKey('customer'));
    save.reset();
  };
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onBusy(true);
        save.mutate();
      }}
    >
      {save.isError && (
        <Alert tone="danger" title="Customer could not be saved">
          {errorMessage(save.error)}
        </Alert>
      )}
      <fieldset disabled={save.isPending} className="min-w-0 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              { field: 'reference', label: 'Customer reference', max: 40, required: true },
              { field: 'name', label: 'Full name or business name', max: 200, required: true },
              { field: 'email', label: 'Email address', max: 254 },
              { field: 'phone', label: 'Phone number', max: 30 },
            ] as const
          ).map((item) => {
            const error = isApiError(save.error) ? save.error.fieldMessage(item.field) : undefined;
            return (
              <label key={item.field} className="block space-y-1 text-sm font-medium">
                {item.label}
                <Input
                  aria-label={item.label}
                  value={data[item.field]}
                  required={'required' in item}
                  maxLength={item.max}
                  type={item.field === 'email' ? 'email' : 'text'}
                  readOnly={item.field === 'reference' && !!customer}
                  pattern={item.field === 'reference' ? '[A-Za-z0-9_-]+' : undefined}
                  invalid={!!error}
                  aria-describedby={error ? `error-${item.field}` : undefined}
                  onChange={(e) => change(item.field, e.target.value)}
                />
                {error && (
                  <span id={`error-${item.field}`} className="block text-xs text-danger-600">
                    {error}
                  </span>
                )}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-ink-500">
          Use a unique reference such as CUST-001. It stays fixed and is reserved even after
          archiving.
        </p>
        <label className="block space-y-1 text-sm font-medium">
          Address
          <Textarea
            maxLength={500}
            value={data.address}
            onChange={(e) => change('address', e.target.value)}
          />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Internal notes
          <Textarea
            maxLength={2000}
            value={data.notes}
            onChange={(e) => change('notes', e.target.value)}
          />
        </label>
        <p className="text-sm text-ink-500">
          This saves a customer record. Internet service is not assigned or activated.
        </p>
      </fieldset>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        <Button variant="secondary" disabled={save.isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {customer ? 'Save customer' : 'Create customer'}
        </Button>
      </div>
    </form>
  );
}
