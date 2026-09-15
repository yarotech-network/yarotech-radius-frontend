import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { errorMessage } from '@/services/api/errors';
import { Alert, QueryBoundary } from '@/components/feedback';
import { Button, Card, Checkbox, ConfirmDialog, FormField, Input, Skeleton } from '@/components/ui';
import type { Paginated } from '@/types/api';

interface ReminderSettings {
  version: string | null;
  enabled: boolean; unused_enabled: boolean; expiry_enabled: boolean;
  unused_hours: number; short_lead_hours: number; medium_lead_hours: number; long_lead_hours: number;
  unused_template: string; expiry_template: string; language: string;
}
interface Order {
  id: number; state: string; payment_status: string; fulfilled: boolean;
  error_code: string; delivery_state: string | null; created_at: string;
}

export function WorkflowControls({ scope }: { scope: number | null }) {
  const principal = usePrincipal();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<{ id: number; type: 'recheck' | 'resend'; requestId: string } | null>(null);
  const [notice, setNotice] = useState('');
  const reminderQuery = useQuery({ queryKey: ['whatsapp-reminders', principal.user.id, scope],
    queryFn: () => http.get<ReminderSettings>('/whatsapp/reminders/'), enabled: open && scope !== null });
  const orderQuery = useQuery({ queryKey: ['whatsapp-orders', principal.user.id, scope, page],
    queryFn: () => http.get<Paginated<Order>>(`/whatsapp/orders/?page=${page}`), enabled: open && scope !== null });
  return <Card className="space-y-4 p-5">
    <h2 className="text-lg font-semibold">Orders and voucher reminders</h2>
    <Button variant="secondary" onClick={() => setOpen(!open)}>{open ? 'Hide orders and reminders' : 'Manage orders and reminders'}</Button>
    {open && <>
      {notice && <Alert tone="success" title="Request recorded">{notice}</Alert>}
      <QueryBoundary query={reminderQuery} skeleton={<Skeleton className="h-24" />}>
        {(data) => <ReminderForm key={`${scope}:${data.version}`} data={data} reload={() => reminderQuery.refetch()} />}
      </QueryBoundary>
      <QueryBoundary query={orderQuery} skeleton={<Skeleton className="h-24" />}>
        {(data) => <div className="space-y-3">
          <h3 className="font-semibold">WhatsApp purchases</h3>
          {!data.results.length && <p>No WhatsApp orders yet.</p>}
          {data.results.map((order) => <div key={order.id} className="space-y-2 rounded border p-3">
            <p>Order #{order.id} Â· Payment: {order.payment_status} Â· Processing: {order.state}</p>
            <p>Voucher: {order.fulfilled ? 'Issued' : 'Not issued'} Â· Delivery: {order.delivery_state || 'Not queued'}</p>
            {order.error_code && <p className="text-sm">Needs review: {order.error_code.replaceAll('_', ' ')}</p>}
            <div className="flex flex-wrap gap-2">
              {!order.fulfilled && <Button variant="secondary" onClick={() => setAction({ id: order.id, type: 'recheck', requestId: crypto.randomUUID() })}>Recheck order #{order.id}</Button>}
              {order.fulfilled && <Button variant="secondary" onClick={() => setAction({ id: order.id, type: 'resend', requestId: crypto.randomUUID() })}>Resend voucher #{order.id}</Button>}
            </div>
          </div>)}
          <div className="flex gap-2">
            <Button variant="secondary" disabled={data.current_page <= 1} onClick={() => setPage(page-1)}>Previous orders</Button>
            <Button variant="secondary" disabled={data.current_page >= data.total_pages} onClick={() => setPage(page+1)}>Next orders</Button>
            <Button variant="secondary" onClick={() => void orderQuery.refetch()}>Refresh orders</Button>
          </div>
        </div>}
      </QueryBoundary>
    </>}
    <ConfirmDialog open={action !== null} onClose={() => setAction(null)}
      title={action?.type === 'resend' ? 'Send this voucher again?' : 'Recheck this existing payment?'}
      description={action?.type === 'resend' ? 'The customer may receive another copy if a previous attempt succeeded. Delivery still requires a valid WhatsApp reply window.' : 'This checks the original payment reference. It does not create another charge.'}
      confirmLabel={action?.type === 'resend' ? 'Confirm resend' : 'Confirm recheck'}
      onConfirm={async () => {
        if (!action) return;
        await http.post(`/whatsapp/orders/${action.id}/recover/`, { action: action.type, request_id: action.requestId, acknowledge_duplicate_risk: action.type === 'resend' });
        setNotice('The worker will process the recovery request. Refresh the order to check its outcome.');
        await orderQuery.refetch();
      }} />
  </Card>;
}

function ReminderForm({ data, reload }: { data: ReminderSettings; reload: () => Promise<unknown> }) {
  const [form, setForm] = useState(data);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  if (!data.version) return <p>Create your shared-number business link before configuring reminders.</p>;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try {
      const { version, ...values } = form;
      await http.put('/whatsapp/reminders/', { ...values, expected_version: version });
      await reload();
    } catch (err) { setError(errorMessage(err)); }
    finally { saving.current = false; setBusy(false); }
  }
  return <form onSubmit={(event) => void save(event)} className="space-y-4">
    <h3 className="font-semibold">Voucher reminders</h3>
    <p>Customers opt in with REMINDERS ON and opt out with REMINDERS OFF. Use template names approved in your Meta account.</p>
    {error && <Alert tone="danger" title="Could not save reminders">{error}</Alert>}
    <fieldset disabled={busy} className="space-y-4">
      {([['enabled', 'Enable reminders'], ['unused_enabled', 'Unused voucher reminders'], ['expiry_enabled', 'Expiring voucher reminders']] as const).map(([key, label]) =>
        <Checkbox key={key} label={label} checked={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />)}
      {([['unused_hours', 'Unused voucher delay (hours)', 720], ['short_lead_hours', 'Short plan expiry notice (hours)', 24], ['medium_lead_hours', 'Medium plan expiry notice (hours)', 168], ['long_lead_hours', 'Long plan expiry notice (hours)', 720]] as const).map(([key, label, max]) =>
        <FormField key={key} label={label}><Input type="number" min={1} max={max} required value={form[key]} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} /></FormField>)}
      {([['unused_template', 'Approved unused-voucher template'], ['expiry_template', 'Approved expiry template'], ['language', 'Template language']] as const).map(([key, label]) =>
        <FormField key={key} label={label}><Input maxLength={key === 'language' ? 10 : 80} value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></FormField>)}
      <Button type="submit">Save reminder settings</Button>
      <Button type="button" variant="secondary" onClick={() => void reload()}>Reload reminder settings</Button>
    </fieldset>
  </form>;
}
