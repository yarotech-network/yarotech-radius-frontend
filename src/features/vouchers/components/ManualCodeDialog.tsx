import { useState, type FormEvent } from 'react';
import { Dialog, Button, FormField, Input, Select } from '@/components/ui';
import { Alert, useToast } from '@/components/feedback';
import { usePlanOptions } from '@/features/plans/queries';
import { formatKobo } from '@/lib/formatting/money';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { errorMessage } from '@/services/api/errors';
import { vouchersApi } from '../api';
import { useQueryClient } from '@tanstack/react-query';
import { voucherKeys } from '../queries';

export function ManualCodeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const plans = usePlanOptions(true);
  const client = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [planId, setPlanId] = useState(0);
  const [devices, setDevices] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [key, setKey] = useState(() => newIdempotencyKey('manual'));
  const plan = plans.data?.find((item) => item.id === planId);
  const maxDevices = Math.max(1, Math.min(10, plan?.max_devices ?? 1));
  const normalized = code.trim().toUpperCase();
  const valid = /^[A-Z0-9_-]{8,32}$/.test(normalized) && !normalized.startsWith('YRP-');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || !plan || devices > maxDevices || busy) return;
    setBusy(true);
    setError('');
    try {
      await vouchersApi.manualCode({ code: normalized, plan_id: plan.id, device_limit: devices }, key);
      await client.invalidateQueries({ queryKey: voucherKeys.all });
      toast.success('Manual voucher created', normalized);
      setCode('');
      setPlanId(0);
      setDevices(1);
      setKey(newIdempotencyKey('manual'));
      onClose();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onClose={onClose} dismissible={!busy} title="Manual Voucher"
      description="Create one access code. The same code is used for username and password." size="md">
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <FormField label="Access code" required hint="8–32 letters, numbers, hyphens or underscores">
          <Input value={code} maxLength={32} autoComplete="off" className="font-mono uppercase"
            onChange={(event) => { setCode(event.target.value.toUpperCase()); setKey(newIdempotencyKey('manual')); }}
            aria-invalid={code.length > 0 && !valid} />
        </FormField>
        <FormField label="Hotspot plan" required>
          <Select value={planId || ''} onChange={(event) => { setPlanId(Number(event.target.value)); setDevices(1); setKey(newIdempotencyKey('manual')); }}
            options={[{ value: '', label: 'Choose a plan' }, ...(plans.data ?? []).map((item) => ({ value: String(item.id), label: item.name }))]} />
        </FormField>
        <FormField label="Devices per voucher">
          <Select value={devices} onChange={(event) => { setDevices(Number(event.target.value)); setKey(newIdempotencyKey('manual')); }}
            options={Array.from({ length: maxDevices }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} />
        </FormField>
        <p className="rounded-lg border border-border bg-surface-muted p-3 text-sm text-ink-700">
          Face value: <strong>{plan ? formatKobo(plan.price * devices) : 'Choose a plan'}</strong>.
          {' '}This is not collected or activated revenue.
        </p>
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!valid || !plan || devices > maxDevices}>Create voucher</Button>
        </div>
      </form>
    </Dialog>
  );
}
